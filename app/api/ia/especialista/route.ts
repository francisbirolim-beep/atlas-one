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

async function temAcesso(usuario: UsuarioTenant, modulo: AIModulo) {
  if (usuario.role === 'master') return true
  const especialista = especialistaDoModulo(modulo)
  if (!especialista?.setorIds.length) return false
  const { data, error } = await supabaseAdmin
    .from('permissoes')
    .select('setor_id,nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .in('setor_id', especialista.setorIds)

  if (error) return false
  return (data || []).some(p => ['consulta', 'edicao'].includes(String(p.nivel)))
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

async function dadosRecentes(usuario: UsuarioTenant, modulo: AIModulo) {
  const empresaId = usuario.empresa_id
  const recentes = async (table: string, select: string, order = 'created_at', limit = 20) => {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .eq('empresa_id', empresaId)
      .order(order, { ascending: false })
      .limit(limit)
    return error ? [] : data || []
  }
  if (modulo === 'comercial') {
    return {
      clientes: await recentes('clientes', 'id,nome,cidade,origem,responsavel,created_at', 'created_at', 25),
      orcamentos: await recentes('orcamentos', 'id,cliente_nome,cidade,status,temperatura,valor_estimado,created_at,criado_por_nome', 'created_at', 25),
    }
  }
  if (modulo === 'orcamento') {
    return {
      orcamentos: await recentes('orcamentos', 'id,cliente_nome,cidade,status,acabamento,contramarco,tipo_medida,valor_estimado,custo_estimado,created_at', 'created_at', 20),
      produtos: await recentes('produtos', 'id,nome,codigo,categoria,unidade,preco,custo,linha_id,updated_at', 'updated_at', 40),
    }
  }
  if (modulo === 'medicao_final') {
    return {
      medicoes: await recentes('medicoes_finais', 'id,orcamento_id,cliente_nome,cidade,status_operacional,responsavel_nome,versao,created_at,concluido_em,aprovado_em', 'created_at', 25),
    }
  }
  if (modulo === 'engenharia') {
    return {
      produtos_tecnicos: await recentes('produtos', 'id,nome,codigo,categoria,unidade,linha_id,peso_kg_m,tamanho_barra_mm,status_validacao,updated_at', 'updated_at', 50),
    }
  }
  if (modulo === 'compras') {
    return {
      necessidades: await recentes('compras_necessidades', 'id,status,descricao,categoria,quantidade,unidade,prioridade,data_limite,obra_referencia,responsavel_nome,created_at', 'created_at', 30),
      fornecedores: await recentes('fornecedores', 'id,nome,cidade,ativo,pedido_minimo,prazo_medio_dias,prazo_entrega_dias,condicao_pagamento_padrao,updated_at', 'updated_at', 30),
    }
  }
  if (modulo === 'estoque') {
    return {
      saldos: await recentes('estoque_saldos', 'produto_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,updated_at', 'updated_at', 50),
      produtos: await recentes('produtos', 'id,nome,codigo,categoria,unidade,estoque_minimo,estoque_ideal,updated_at', 'updated_at', 50),
    }
  }
  if (modulo === 'producao') {
    return {
      ordens: await recentes('ordens_producao', 'id,numero,cliente_id,obra_id,orcamento_id,tipo_producao,titulo,quantidade,largura_mm,altura_mm,status,bloqueada,bloqueio_motivo,created_at,updated_at', 'updated_at', 35),
    }
  }
  if (modulo === 'instalacao' || modulo === 'qualidade') {
    return {
      assistencias: await recentes('assistencias', 'id,numero,cliente_nome,cidade,descricao_problema,status,tecnico_nome,data_atendimento,servico_realizado,created_at,atendimento_concluido_em', 'created_at', 30),
    }
  }
  if (modulo === 'financeiro') {
    return {
      contas_receber: await recentes('financeiro_contas_receber', 'id,cliente_nome,documento,parcela,total_parcelas,vencimento,valor,status,forma,data_pagamento,valor_pago,created_at', 'created_at', 35),
      contas_pagar: await recentes('financeiro_contas_pagar', 'id,fornecedor_nome,documento,parcela,descricao,vencimento,valor,status,data_pagamento,valor_pago,created_at', 'created_at', 35),
    }
  }
  if (modulo === 'gestao') {
    return {
      orcamentos: await recentes('orcamentos', 'id,cliente_nome,cidade,status,temperatura,valor_estimado,custo_estimado,created_at,criado_por_nome', 'created_at', 30),
      producao: await recentes('ordens_producao', 'id,numero,titulo,status,bloqueada,bloqueio_motivo,created_at,updated_at', 'updated_at', 30),
      receber: await recentes('financeiro_contas_receber', 'id,cliente_nome,vencimento,valor,status,valor_pago,created_at', 'created_at', 30),
      pagar: await recentes('financeiro_contas_pagar', 'id,fornecedor_nome,vencimento,valor,status,valor_pago,created_at', 'created_at', 30),
    }
  }

  return {}
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
    if (!(await temAcesso(usuario, modulo))) {
      return NextResponse.json({ error: 'Você não possui acesso a este especialista.' }, { status: 403 })
    }

    const status = await statusOpenCode()
    if (!status.configurado) {
      return NextResponse.json({ error: 'Gateway seguro do OpenCode indisponível.', codigo: 'OPENCODE_CONFIG_MISSING' }, { status: 503 })
    }
    const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const sessionId = await validarSessao(usuario, modulo, String(body?.sessionId || '') || null)
    const [dados, setores, memoria] = await Promise.all([
      dadosRecentes(usuario, modulo),
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
      'OpenCode orquestra a conversa e FreeLLMAPI executa/roteia o modelo.',
    ].join('\n')

    const contexto = {
      especialista: { modulo, nome: especialista.nome, objetivo: especialista.objetivo },
      usuario: { nome: usuario.nome, role: usuario.role },
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