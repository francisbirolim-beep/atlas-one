import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { consultarOpenCode, statusOpenCode } from '@/lib/ai/opencode'
import { especialistaDoModulo } from '@/lib/ai/specialists'
import type { AIModulo } from '@/lib/ai/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODULOS = new Set<AIModulo>([
  'gestao', 'comercial', 'orcamento', 'medicao_final', 'engenharia', 'compras', 'estoque',
  'producao', 'instalacao', 'financeiro', 'marketing', 'rh', 'qualidade', 'pd',
])

function contextoId(modulo: AIModulo) {
  return `especialista:${modulo}`
}

type EscopoIA = 'nenhum' | 'proprio' | 'setor' | 'empresa'

type AcessoIA = {
  permitido: boolean
  escopo: EscopoIA
  origem: 'master' | 'configurado' | 'setor' | 'negado'
  motivo: string
}

async function resolverAcesso(usuario: UsuarioTenant, modulo: AIModulo): Promise<AcessoIA> {
  if (usuario.role === 'master') {
    return { permitido: true, escopo: 'empresa', origem: 'master', motivo: 'Usuário Master.' }
  }

  const especialista = especialistaDoModulo(modulo)
  if (!especialista?.setorIds.length) {
    return { permitido: false, escopo: 'nenhum', origem: 'negado', motivo: 'Especialista sem setor configurado.' }
  }

  const { data, error } = await supabaseAdmin
    .from('permissoes')
    .select('setor_id,nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .in('setor_id', especialista.setorIds)

  if (error || !(data || []).some(p => ['consulta', 'edicao'].includes(String(p.nivel)))) {
    return { permitido: false, escopo: 'nenhum', origem: 'negado', motivo: 'Usuário sem acesso ao setor deste especialista.' }
  }

  // A permissão do Atlas é o teto. Configuração específica da IA só pode restringir,
  // nunca liberar um setor que o usuário não possua no sistema.
  const escopoBase: EscopoIA = modulo === 'comercial' ? 'proprio' : 'setor'
  const { data: override } = await supabaseAdmin
    .from('ia_acessos_dominio')
    .select('escopo,permitido')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('dominio', modulo)
    .maybeSingle()

  if (override) {
    const escopoConfigurado = String(override.escopo || 'nenhum') as EscopoIA
    if (override.permitido !== true || escopoConfigurado === 'nenhum') {
      return { permitido: false, escopo: 'nenhum', origem: 'configurado', motivo: 'Domínio restringido pelo Master.' }
    }

    const ordem: Record<EscopoIA, number> = { nenhum: 0, proprio: 1, setor: 2, empresa: 3 }
    const escopo = ordem[escopoConfigurado] < ordem[escopoBase] ? escopoConfigurado : escopoBase
    return {
      permitido: true,
      escopo,
      origem: 'configurado',
      motivo: 'Permissão herdada do Atlas com restrição adicional da IA.',
    }
  }

  return { permitido: true, escopo: escopoBase, origem: 'setor', motivo: 'Permissão herdada do setor do Atlas.' }
}

async function acessoAuxiliar(usuario: UsuarioTenant, dominio: string) {
  if (usuario.role === 'master') return true
  const { data } = await supabaseAdmin
    .from('ia_acessos_dominio')
    .select('escopo,permitido')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('dominio', dominio)
    .maybeSingle()
  return Boolean(data?.permitido && data?.escopo && data.escopo !== 'nenhum')
}

async function auditarAcesso(
  usuario: UsuarioTenant,
  modulo: AIModulo,
  acesso: AcessoIA,
  contexto: string,
) {
  try {
    await supabaseAdmin.from('ia_auditoria_dados').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: usuario.id,
      dominio: modulo,
      escopo_aplicado: acesso.escopo,
      acao: acesso.permitido ? 'permitido' : 'bloqueado',
      motivo: acesso.motivo,
      contexto: contexto.slice(0, 500),
    })
  } catch {
    // Auditoria não pode derrubar a conversa.
  }
}

async function validarSessao(usuario: UsuarioTenant, modulo: AIModulo, sessionId: string | null) {
  const id = String(sessionId || '').trim()
  if (!id) return null
  const { data } = await supabaseAdmin
    .from('ai_interacoes')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('contexto', contextoId(modulo))
    .contains('contexto_json', { opencode_session_id: id })
    .limit(1)
  return data?.length ? id : null
}

async function dadosRecentes(usuario: UsuarioTenant, modulo: AIModulo, escopo: EscopoIA) {
  const empresaId = usuario.empresa_id
  const podeCustos = await acessoAuxiliar(usuario, 'custos_precos')
  const podeFornecedores = await acessoAuxiliar(usuario, 'fornecedores')

  const contar = async (
    table: string,
    proprioColumn?: string,
    status?: string,
  ) => {
    if (escopo === 'nenhum') return 0
    if (escopo === 'proprio' && !proprioColumn) return null

    let query = supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (escopo === 'proprio' && proprioColumn) {
      query = query.eq(proprioColumn, usuario.id)
    }
    if (status) query = query.eq('status', status)

    const { count, error } = await query
    return error ? null : Number(count || 0)
  }

  const resumoOrcamentos = async () => {
    const [total, rascunho, enviado, vendido, convertido] = await Promise.all([
      contar('orcamentos', 'criado_por_id'),
      contar('orcamentos', 'criado_por_id', 'rascunho'),
      contar('orcamentos', 'criado_por_id', 'enviado'),
      contar('orcamentos', 'criado_por_id', 'vendido'),
      contar('orcamentos', 'criado_por_id', 'convertido'),
    ])
    return { total, rascunho, enviado, vendido, convertido }
  }

  const recentes = async (
    table: string,
    select: string,
    order = 'created_at',
    limit = 20,
    proprioColumn?: string,
  ) => {
    if (escopo === 'nenhum') return []
    if (escopo === 'proprio' && !proprioColumn) return []

    let query = supabaseAdmin
      .from(table)
      .select(select)
      .eq('empresa_id', empresaId)

    if (escopo === 'proprio' && proprioColumn) {
      query = query.eq(proprioColumn, usuario.id)
    }

    const { data, error } = await query
      .order(order, { ascending: false })
      .limit(limit)
    return error ? [] : data || []
  }

  if (modulo === 'comercial') {
    const clientes = escopo === 'proprio'
      ? await supabaseAdmin
          .from('clientes')
          .select('id,nome,cidade,origem,responsavel,created_at')
          .eq('empresa_id', empresaId)
          .eq('responsavel', usuario.nome)
          .order('created_at', { ascending: false })
          .limit(25)
      : await supabaseAdmin
          .from('clientes')
          .select('id,nome,cidade,origem,responsavel,created_at')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(25)

    return {
      escopo_aplicado: escopo,
      resumo_orcamentos: await resumoOrcamentos(),
      clientes_recentes: clientes.error ? [] : clientes.data || [],
      orcamentos_recentes: await recentes(
        'orcamentos',
        'id,cliente_nome,cidade,status,temperatura,valor_estimado,created_at,criado_por_nome,criado_por_id',
        'created_at',
        25,
        'criado_por_id',
      ),
    }
  }

  if (modulo === 'orcamento') {
    const selectOrc = podeCustos
      ? 'id,cliente_nome,cidade,status,acabamento,contramarco,tipo_medida,valor_estimado,custo_estimado,created_at,criado_por_id'
      : 'id,cliente_nome,cidade,status,acabamento,contramarco,tipo_medida,valor_estimado,created_at,criado_por_id'
    const selectProd = podeCustos
      ? 'id,nome,codigo,categoria,unidade,preco,custo,linha_id,updated_at'
      : 'id,nome,codigo,categoria,unidade,linha_id,updated_at'

    return {
      escopo_aplicado: escopo,
      custos_precos_liberados: podeCustos,
      resumo_orcamentos: await resumoOrcamentos(),
      orcamentos_recentes: await recentes('orcamentos', selectOrc, 'created_at', 20, 'criado_por_id'),
      produtos_recentes: escopo === 'proprio' ? [] : await recentes('produtos', selectProd, 'updated_at', 40),
    }
  }

  if (modulo === 'medicao_final') {
    return {
      escopo_aplicado: escopo,
      medicoes: await recentes(
        'medicoes_finais',
        'id,orcamento_id,cliente_nome,cidade,status_operacional,responsavel_nome,versao,created_at,concluido_em,aprovado_em,criado_por_id',
        'created_at',
        25,
        'criado_por_id',
      ),
    }
  }

  if (modulo === 'engenharia') {
    return {
      escopo_aplicado: escopo,
      produtos_tecnicos: await recentes(
        'produtos',
        'id,nome,codigo,categoria,unidade,linha_id,peso_kg_m,tamanho_barra_mm,status_validacao,updated_at',
        'updated_at',
        50,
      ),
    }
  }

  if (modulo === 'compras') {
    return {
      escopo_aplicado: escopo,
      necessidades: await recentes(
        'compras_necessidades',
        'id,status,descricao,categoria,quantidade,unidade,prioridade,data_limite,obra_referencia,responsavel_nome,created_at,criado_por_id',
        'created_at',
        30,
        'criado_por_id',
      ),
      fornecedores: podeFornecedores && escopo !== 'proprio'
        ? await recentes('fornecedores', 'id,nome,cidade,ativo,pedido_minimo,prazo_medio_dias,prazo_entrega_dias,condicao_pagamento_padrao,updated_at', 'updated_at', 30)
        : [],
    }
  }

  if (modulo === 'estoque') {
    const selectSaldo = podeCustos
      ? 'produto_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,updated_at'
      : 'produto_id,unidade,quantidade,quantidade_reservada,updated_at'
    return {
      escopo_aplicado: escopo,
      custos_precos_liberados: podeCustos,
      saldos: escopo === 'proprio' ? [] : await recentes('estoque_saldos', selectSaldo, 'updated_at', 50),
      produtos: escopo === 'proprio' ? [] : await recentes('produtos', 'id,nome,codigo,categoria,unidade,estoque_minimo,estoque_ideal,updated_at', 'updated_at', 50),
    }
  }

  if (modulo === 'producao') {
    return {
      escopo_aplicado: escopo,
      resumo_producao: {
        total_ordens: await contar('ordens_producao', 'criado_por_id'),
      },
      ordens_recentes: await recentes(
        'ordens_producao',
        'id,numero,cliente_id,obra_id,orcamento_id,tipo_producao,titulo,quantidade,largura_mm,altura_mm,status,bloqueada,bloqueio_motivo,created_at,updated_at,criado_por_id',
        'updated_at',
        35,
        'criado_por_id',
      ),
    }
  }

  if (modulo === 'instalacao' || modulo === 'qualidade') {
    return {
      escopo_aplicado: escopo,
      assistencias: await recentes(
        'assistencias',
        'id,numero,cliente_nome,cidade,descricao_problema,status,tecnico_nome,data_atendimento,servico_realizado,created_at,atendimento_concluido_em,criado_por_id',
        'created_at',
        30,
        'criado_por_id',
      ),
    }
  }

  if (modulo === 'financeiro') {
    const [receberTotal, receberAberto, pagarTotal, pagarAberto] = await Promise.all([
      contar('financeiro_contas_receber', 'criado_por_id'),
      contar('financeiro_contas_receber', 'criado_por_id', 'aberto'),
      contar('financeiro_contas_pagar', 'criado_por_id'),
      contar('financeiro_contas_pagar', 'criado_por_id', 'aberto'),
    ])
    return {
      escopo_aplicado: escopo,
      resumo_financeiro: {
        contas_receber_total: receberTotal,
        contas_receber_abertas: receberAberto,
        contas_pagar_total: pagarTotal,
        contas_pagar_abertas: pagarAberto,
      },
      contas_receber_recentes: await recentes(
        'financeiro_contas_receber',
        'id,cliente_nome,documento,parcela,total_parcelas,vencimento,valor,status,forma,data_pagamento,valor_pago,created_at,criado_por_id',
        'created_at',
        35,
        'criado_por_id',
      ),
      contas_pagar_recentes: await recentes(
        'financeiro_contas_pagar',
        'id,fornecedor_nome,documento,parcela,descricao,vencimento,valor,status,data_pagamento,valor_pago,created_at,criado_por_id',
        'created_at',
        35,
        'criado_por_id',
      ),
    }
  }

  if (modulo === 'gestao') {
    const selectOrc = podeCustos
      ? 'id,cliente_nome,cidade,status,temperatura,valor_estimado,custo_estimado,created_at,criado_por_nome,criado_por_id'
      : 'id,cliente_nome,cidade,status,temperatura,valor_estimado,created_at,criado_por_nome,criado_por_id'

    const [orcamentosResumo, producaoTotal, receberTotal, receberAberto, pagarTotal, pagarAberto] = await Promise.all([
      resumoOrcamentos(),
      contar('ordens_producao', 'criado_por_id'),
      contar('financeiro_contas_receber', 'criado_por_id'),
      contar('financeiro_contas_receber', 'criado_por_id', 'aberto'),
      contar('financeiro_contas_pagar', 'criado_por_id'),
      contar('financeiro_contas_pagar', 'criado_por_id', 'aberto'),
    ])

    return {
      escopo_aplicado: escopo,
      custos_precos_liberados: podeCustos,
      resumo_orcamentos: orcamentosResumo,
      resumo_producao: { total_ordens: producaoTotal },
      resumo_financeiro: {
        contas_receber_total: receberTotal,
        contas_receber_abertas: receberAberto,
        contas_pagar_total: pagarTotal,
        contas_pagar_abertas: pagarAberto,
      },
      orcamentos_recentes: await recentes('orcamentos', selectOrc, 'created_at', 30, 'criado_por_id'),
      producao_recente: await recentes('ordens_producao', 'id,numero,titulo,status,bloqueada,bloqueio_motivo,created_at,updated_at,criado_por_id', 'updated_at', 30, 'criado_por_id'),
      receber_recentes: await recentes('financeiro_contas_receber', 'id,cliente_nome,vencimento,valor,status,valor_pago,created_at,criado_por_id', 'created_at', 30, 'criado_por_id'),
      pagar_recentes: await recentes('financeiro_contas_pagar', 'id,fornecedor_nome,vencimento,valor,status,valor_pago,created_at,criado_por_id', 'created_at', 30, 'criado_por_id'),
    }
  }

  return { escopo_aplicado: escopo }
}

async function instrucoesSetor(usuario: UsuarioTenant, modulo: AIModulo) {
  const especialista = especialistaDoModulo(modulo)
  if (!especialista) return []
  const { data } = await supabaseAdmin
    .from('setores')
    .select('id,nome,instrucoes_ia')
    .in('id', especialista.setorIds)
  return (data || []).filter(s => String(s.instrucoes_ia || '').trim())
}
async function memoriaEspecialista(usuario: UsuarioTenant, modulo: AIModulo) {
  const escopo = contextoId(modulo)
  const [mem, inter, feedback] = await Promise.all([
    supabaseAdmin
      .from('ai_memorias')
      .select('titulo,conteudo,updated_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('escopo', escopo)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(15),
    supabaseAdmin
      .from('ai_interacoes')
      .select('id,pergunta,resposta,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('contexto', escopo)
      .eq('status', 'ok')
      .order('created_at', { ascending: false })
      .limit(15),
    supabaseAdmin
      .from('ai_feedback')
      .select('interacao_id,avaliacao,correcao,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  const feedbackMap = new Map((feedback.data || []).map((f: any) => [f.interacao_id, f]))
  const exemplos = (inter.data || [])
    .map((i: any) => ({ ...i, feedback: feedbackMap.get(i.id) }))
    .filter((i: any) => i.feedback?.avaliacao === 'aprovado' || i.feedback?.avaliacao === 'corrigido')
    .slice(0, 6)
    .map((i: any) => ({
      pergunta: i.pergunta,
      resposta_aprovada: i.feedback?.avaliacao === 'corrigido' && i.feedback?.correcao
        ? i.feedback.correcao
        : i.resposta,
    }))

  return { memorias: mem.data || [], exemplos }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const modulo = String(body?.modulo || '').trim() as AIModulo
    const pergunta = String(body?.pergunta || '').trim()
    if (!MODULOS.has(modulo)) return NextResponse.json({ error: 'Especialista inválido.' }, { status: 400 })
    if (!pergunta) return NextResponse.json({ error: 'Digite uma pergunta.' }, { status: 400 })
    if (pergunta.length > 5000) return NextResponse.json({ error: 'Pergunta muito longa.' }, { status: 400 })

    const especialista = especialistaDoModulo(modulo)
    if (!especialista) return NextResponse.json({ error: 'Especialista não configurado.' }, { status: 404 })
    const acesso = await resolverAcesso(usuario, modulo)
    await auditarAcesso(usuario, modulo, acesso, pergunta)
    if (!acesso.permitido) {
      return NextResponse.json({ error: 'Você não possui acesso a estes dados no Atlas IA.' }, { status: 403 })
    }

    const status = await statusOpenCode()
    if (!status.configurado) {
      return NextResponse.json({ error: 'Gateway seguro do OpenCode indisponível.', codigo: 'OPENCODE_CONFIG_MISSING' }, { status: 503 })
    }
    const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const sessionId = await validarSessao(usuario, modulo, String(body?.sessionId || '') || null)
    const [dados, setores, memoria] = await Promise.all([
      dadosRecentes(usuario, modulo, acesso.escopo),
      instrucoesSetor(usuario, modulo),
      memoriaEspecialista(usuario, modulo),
    ])

    const system = [
      `Você é ${especialista.nome}, especialista do Atlas One, sistema interno da Esquadrifácio.`,
      `Missão: ${especialista.objetivo}`,
      'Responda sempre em português do Brasil, com objetividade e precisão.',
      'Use somente o CONTEXTO ATLAS fornecido e conhecimento geral não sensível quando necessário para explicar conceitos.',
      'Nunca invente clientes, valores, medidas, prazos, códigos, saldos, status ou regras internas.',
      'Se a informação operacional não estiver no contexto, diga claramente que não encontrou esse dado no Atlas.',
      'Não execute ações, não altere registros e não use shell, terminal, arquivos locais ou ferramentas externas.',
      'Para cálculos determinísticos, fórmulas técnicas, cortes, folgas, acessórios, custos e regras do MEE, explique que o cálculo oficial pertence ao Motor Atlas/MEE.',
      'Correções humanas e memórias aprovadas têm prioridade sobre inferências.',
      'Respeite estritamente o escopo do especialista selecionado e as permissões do usuário.',
      'Se escopo_dados for proprio, nunca conclua ou estime números da empresa inteira a partir dos dados pessoais fornecidos.',
      'Se um campo sensível não estiver no CONTEXTO ATLAS, informe que o usuário não possui acesso ou que o dado não foi disponibilizado.',
      'Campos com nome resumo_* contêm totais agregados confiáveis para o escopo atual.',
      'Campos com nome *_recentes, *_recente ou listas operacionais são amostras limitadas para contexto; NUNCA use a quantidade de itens dessas listas como total da empresa, do setor ou do usuário.',
      'Se a pergunta pedir total, quantidade geral ou visão consolidada e não houver um resumo_* correspondente, diga que o total consolidado não foi disponibilizado em vez de estimar pela amostra.',
      'OpenCode orquestra a conversa e FreeLLMAPI executa/roteia o modelo.',
    ].join('\n')

    const contexto = {
      especialista: { modulo, nome: especialista.nome, objetivo: especialista.objetivo },
      usuario: { nome: usuario.nome, role: usuario.role, escopo_dados: acesso.escopo },
      instrucoes_setor: setores,
      dados_operacionais: dados,
      memorias_aprovadas: memoria.memorias,
      exemplos_aprovados: memoria.exemplos,
    }

    let resultado: Awaited<ReturnType<typeof consultarOpenCode>>
    try {
      resultado = await consultarOpenCode({
        accessToken,
        sessionId,
        tituloSessao: `${especialista.nome} - ${usuario.nome || usuario.id}`,
        system,
        prompt: `CONTEXTO ATLAS:\n${JSON.stringify(contexto)}\n\nPERGUNTA DO USUÁRIO:\n${pergunta}`,
      })
    } catch (e: any) {
      const detalhe = String(e?.message || 'Falha ao consultar o OpenCode').slice(0, 800)
      await supabaseAdmin.from('ai_interacoes').insert({
        empresa_id: usuario.empresa_id,
        contexto: contextoId(modulo),
        usuario_id: usuario.id,
        usuario_nome: usuario.nome || null,
        pergunta,
        resposta: detalhe,
        modelo: `${status.providerId}/${status.modelId}`,
        contexto_json: { erro_opencode: true, modulo, orquestrador: 'opencode', motor: 'freellmapi' },
        status: 'erro',
      })
      return NextResponse.json({ error: detalhe, codigo: 'OPENCODE_REQUEST_FAILED' }, { status: 502 })
    }
    const modelo = `${resultado.providerId}/${resultado.modelId}`
    const { data: interacao, error: insertError } = await supabaseAdmin
      .from('ai_interacoes')
      .insert({
        empresa_id: usuario.empresa_id,
        contexto: contextoId(modulo),
        usuario_id: usuario.id,
        usuario_nome: usuario.nome || null,
        pergunta,
        resposta: resultado.resposta,
        modelo,
        contexto_json: {
          modulo,
          especialista: especialista.nome,
          opencode_session_id: resultado.sessionId,
          provider_id: resultado.providerId,
          model_id: resultado.modelId,
          orquestrador: 'opencode',
          motor: 'freellmapi',
        },
        status: 'ok',
      })
      .select('id')
      .single()

    if (insertError) console.error('Falha ao registrar interação do especialista:', insertError)

    return NextResponse.json({
      resposta: resultado.resposta,
      interacaoId: interacao?.id || null,
      sessionId: resultado.sessionId,
      modelo,
      modulo,
      especialista: especialista.nome,
      somenteSugestao: true,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro inesperado no especialista Atlas.' },
      { status: 500 },
    )
  }
}