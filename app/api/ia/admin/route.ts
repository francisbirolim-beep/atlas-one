import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ESCOPOS = new Set(['nenhum', 'proprio', 'setor', 'empresa'])
const DOMINIOS = new Set([
  'gestao', 'comercial', 'orcamento', 'medicao_final', 'engenharia', 'compras', 'estoque',
  'producao', 'instalacao', 'financeiro', 'marketing', 'rh', 'qualidade', 'pd',
  'custos_precos', 'fornecedores', 'vendas_empresa', 'pessoas_gestao',
])

function txt(v: unknown, max = 5000) {
  return String(v ?? '').trim().slice(0, max)
}

async function autenticarMaster(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })

  const empresaId = usuario.empresa_id
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    usuariosResp,
    interacoesResp,
    usoResp,
    acessosResp,
    auditoriaResp,
    feedbackResp,
    campanhasResp,
  ] = await Promise.all([
    supabaseAdmin
      .from('usuarios')
      .select('id,nome,email,role,created_at')
      .eq('empresa_id', empresaId)
      .order('nome'),
    supabaseAdmin
      .from('ai_interacoes')
      .select('id,contexto,usuario_id,usuario_nome,pergunta,modelo,status,created_at')
      .eq('empresa_id', empresaId)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(600),
    supabaseAdmin
      .from('ia_uso_log')
      .select('id,usuario_id,usuario_nome,agente_nome,setor_id,provider,modelo,tokens_entrada,tokens_saida,sucesso,duracao_ms,custo_estimado,created_at')
      .eq('empresa_id', empresaId)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1200),
    supabaseAdmin
      .from('ia_acessos_dominio')
      .select('id,usuario_id,dominio,escopo,permitido,updated_at')
      .eq('empresa_id', empresaId),
    supabaseAdmin
      .from('ia_auditoria_dados')
      .select('id,usuario_id,dominio,escopo_aplicado,acao,motivo,contexto,created_at')
      .eq('empresa_id', empresaId)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('ia_feedback_colaborador')
      .select('id,usuario_id,modo_identidade,origem,categoria,texto,deseja_contato,status,created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(120),
    supabaseAdmin
      .from('ia_clima_campanhas')
      .select('id,titulo,descricao,inicia_em,encerra_em,ativo,created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const usuarios = usuariosResp.data || []
  const porId = new Map(usuarios.map((u: any) => [u.id, u]))
  const interacoes = interacoesResp.data || []
  const uso = usoResp.data || []
  const auditoria = auditoriaResp.data || []
  const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const diaSP = (valor: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(valor))
  const usoHoje = uso.filter((item: any) => item.created_at && diaSP(item.created_at) === hojeSP)
  const agentesMap = new Map<string, any>()
  for (const item of uso) {
    const nome = String(item.agente_nome || item.setor_id || 'Atlas IA')
    const atual = agentesMap.get(nome) || {
      nome,
      execucoes30d: 0,
      sucessos30d: 0,
      erros30d: 0,
      custo30d: 0,
      tokensEntrada30d: 0,
      tokensSaida30d: 0,
      duracaoTotalMs: 0,
      ultimaAtividadeEm: null,
      provider: item.provider || null,
      modelo: item.modelo || null,
      setor: item.setor_id || null,
    }
    atual.execucoes30d += 1
    if (item.sucesso) atual.sucessos30d += 1
    else atual.erros30d += 1
    atual.custo30d += Number(item.custo_estimado || 0)
    atual.tokensEntrada30d += Number(item.tokens_entrada || 0)
    atual.tokensSaida30d += Number(item.tokens_saida || 0)
    atual.duracaoTotalMs += Number(item.duracao_ms || 0)
    if (!atual.ultimaAtividadeEm || new Date(item.created_at).getTime() > new Date(atual.ultimaAtividadeEm).getTime()) {
      atual.ultimaAtividadeEm = item.created_at
      atual.provider = item.provider || atual.provider
      atual.modelo = item.modelo || atual.modelo
      atual.setor = item.setor_id || atual.setor
    }
    agentesMap.set(nome, atual)
  }
  const agentes = Array.from(agentesMap.values())
    .map((a: any) => ({
      ...a,
      duracaoMediaMs: a.execucoes30d ? Math.round(a.duracaoTotalMs / a.execucoes30d) : 0,
    }))
    .sort((a: any, b: any) => new Date(b.ultimaAtividadeEm || 0).getTime() - new Date(a.ultimaAtividadeEm || 0).getTime())

  const resumoUsuarios = usuarios.map((u: any) => {
    const minhas = interacoes.filter((i: any) => i.usuario_id === u.id)
    const logs = uso.filter((i: any) => i.usuario_id === u.id)
    const bloqueios = auditoria.filter((a: any) => a.usuario_id === u.id && a.acao === 'bloqueado')
    const contextos: Record<string, number> = {}
    for (const item of minhas) {
      const k = String(item.contexto || 'geral').replace(/^especialista:/, '')
      contextos[k] = (contextos[k] || 0) + 1
    }
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      perguntas30d: minhas.length,
      sucessos30d: minhas.filter((i: any) => i.status === 'ok').length,
      erros30d: minhas.filter((i: any) => i.status !== 'ok').length,
      bloqueios30d: bloqueios.length,
      tokensEntrada30d: logs.reduce((s: number, x: any) => s + Number(x.tokens_entrada || 0), 0),
      tokensSaida30d: logs.reduce((s: number, x: any) => s + Number(x.tokens_saida || 0), 0),
      custo30d: logs.reduce((s: number, x: any) => s + Number(x.custo_estimado || 0), 0),
      contextos,
      ultimaPerguntaEm: minhas[0]?.created_at || null,
    }
  })

  const feedback = (feedbackResp.data || []).map((f: any) => ({
    id: f.id,
    origem: f.origem,
    categoria: f.categoria,
    texto: f.texto,
    deseja_contato: f.deseja_contato,
    status: f.status,
    created_at: f.created_at,
    modo_identidade: f.modo_identidade,
    autor: f.modo_identidade === 'identificado'
      ? (porId.get(f.usuario_id) as any)?.nome || 'Usuário identificado'
      : 'Anônimo para a gestão',
  }))

  const campanhas = campanhasResp.data || []
  let climaResumo: any[] = []
  if (campanhas.length) {
    const ids = campanhas.map((c: any) => c.id)
    const [{ data: perguntas }, { data: respostas }] = await Promise.all([
      supabaseAdmin
        .from('ia_clima_perguntas')
        .select('id,campanha_id,texto,tipo,ordem')
        .in('campanha_id', ids),
      supabaseAdmin
        .from('ia_clima_respostas')
        .select('id,campanha_id,pergunta_id,modo_identidade,resposta_texto,resposta_numero,created_at')
        .eq('empresa_id', empresaId)
        .in('campanha_id', ids),
    ])
    climaResumo = campanhas.map((c: any) => ({
      ...c,
      perguntas: (perguntas || []).filter((p: any) => p.campanha_id === c.id),
      qtdRespostas: (respostas || []).filter((r: any) => r.campanha_id === c.id).length,
    }))
  }

  return NextResponse.json({
    periodoDias: 30,
    resumo: {
      perguntas: interacoes.length,
      usuariosAtivos: resumoUsuarios.filter((u: any) => u.perguntas30d > 0).length,
      bloqueios: auditoria.filter((a: any) => a.acao === 'bloqueado').length,
      erros: interacoes.filter((i: any) => i.status !== 'ok').length,
      custoEstimado: uso.reduce((s: number, x: any) => s + Number(x.custo_estimado || 0), 0),
    },
    resumoHoje: {
      execucoes: usoHoje.length,
      sucessos: usoHoje.filter((x: any) => Boolean(x.sucesso)).length,
      erros: usoHoje.filter((x: any) => !x.sucesso).length,
      custoEstimado: usoHoje.reduce((s: number, x: any) => s + Number(x.custo_estimado || 0), 0),
      tokensEntrada: usoHoje.reduce((s: number, x: any) => s + Number(x.tokens_entrada || 0), 0),
      tokensSaida: usoHoje.reduce((s: number, x: any) => s + Number(x.tokens_saida || 0), 0),
    },
    agentes,
    usoRecentes: uso.slice(0, 120).map((x: any) => ({
      id: x.id,
      agente_nome: x.agente_nome,
      setor_id: x.setor_id,
      provider: x.provider,
      modelo: x.modelo,
      tokens_entrada: x.tokens_entrada,
      tokens_saida: x.tokens_saida,
      sucesso: x.sucesso,
      duracao_ms: x.duracao_ms,
      custo_estimado: x.custo_estimado,
      created_at: x.created_at,
    })),
    usuarios: resumoUsuarios,
    acessos: acessosResp.data || [],
    interacoesRecentes: interacoes.slice(0, 150).map((i: any) => ({
      id: i.id,
      usuario_id: i.usuario_id,
      usuario_nome: i.usuario_nome || (porId.get(i.usuario_id) as any)?.nome || 'Usuário',
      contexto: String(i.contexto || 'geral').replace(/^especialista:/, ''),
      pergunta: i.pergunta,
      modelo: i.modelo,
      status: i.status,
      created_at: i.created_at,
    })),
    auditoria: auditoria.slice(0, 150).map((a: any) => ({
      ...a,
      usuario_nome: (porId.get(a.usuario_id) as any)?.nome || 'Usuário',
    })),
    feedback,
    campanhas: climaResumo,
  })
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })

  try {
    const body = await req.json()
    const acao = txt(body?.acao, 50)

    if (acao === 'salvar_permissao') {
      const usuarioId = txt(body?.usuarioId, 100)
      const dominio = txt(body?.dominio, 80)
      const escopo = txt(body?.escopo, 40)

      if (!usuarioId || !DOMINIOS.has(dominio)) {
        return NextResponse.json({ error: 'Usuário ou domínio inválido.' }, { status: 400 })
      }

      const { data: alvo } = await supabaseAdmin
        .from('usuarios')
        .select('id,role')
        .eq('id', usuarioId)
        .eq('empresa_id', usuario.empresa_id)
        .maybeSingle()
      if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

      if (escopo === 'herdado') {
        const { error } = await supabaseAdmin
          .from('ia_acessos_dominio')
          .delete()
          .eq('empresa_id', usuario.empresa_id)
          .eq('usuario_id', usuarioId)
          .eq('dominio', dominio)
        if (error) throw error
        return NextResponse.json({ ok: true, herdado: true })
      }

      if (!ESCOPOS.has(escopo)) {
        return NextResponse.json({ error: 'Escopo inválido.' }, { status: 400 })
      }

      const { error } = await supabaseAdmin.from('ia_acessos_dominio').upsert({
        empresa_id: usuario.empresa_id,
        usuario_id: usuarioId,
        dominio,
        escopo,
        permitido: escopo !== 'nenhum',
        configurado_por: usuario.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id,usuario_id,dominio' })
      if (error) throw error

      return NextResponse.json({ ok: true, escopo })
    }

    if (acao === 'atualizar_feedback') {
      const id = txt(body?.id, 100)
      const status = txt(body?.status, 40)
      if (!['recebido', 'em_analise', 'encaminhado', 'concluido', 'arquivado'].includes(status)) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('ia_feedback_colaborador')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (acao === 'criar_pesquisa') {
      const titulo = txt(body?.titulo, 160)
      const descricao = txt(body?.descricao, 1000) || null
      const perguntas = Array.isArray(body?.perguntas) ? body.perguntas.slice(0, 30) : []
      if (!titulo || !perguntas.length) {
        return NextResponse.json({ error: 'Informe título e pelo menos uma pergunta.' }, { status: 400 })
      }

      const { data: campanha, error: campanhaError } = await supabaseAdmin
        .from('ia_clima_campanhas')
        .insert({
          empresa_id: usuario.empresa_id,
          titulo,
          descricao,
          inicia_em: body?.iniciaEm || new Date().toISOString(),
          encerra_em: body?.encerraEm || null,
          ativo: true,
          criado_por: usuario.id,
        })
        .select('id')
        .single()
      if (campanhaError) throw campanhaError

      const linhas = perguntas.map((p: any, idx: number) => ({
        campanha_id: campanha.id,
        ordem: idx + 1,
        texto: txt(p?.texto, 500),
        tipo: ['texto', 'escala_1_5', 'sim_nao', 'opcoes'].includes(p?.tipo) ? p.tipo : 'texto',
        opcoes_json: Array.isArray(p?.opcoes) ? p.opcoes.slice(0, 20).map((x: any) => txt(x, 120)) : [],
        obrigatoria: p?.obrigatoria === true,
      })).filter((p: any) => p.texto)

      if (!linhas.length) {
        await supabaseAdmin.from('ia_clima_campanhas').delete().eq('id', campanha.id)
        return NextResponse.json({ error: 'Nenhuma pergunta válida.' }, { status: 400 })
      }

      const { error: perguntasError } = await supabaseAdmin.from('ia_clima_perguntas').insert(linhas)
      if (perguntasError) throw perguntasError
      return NextResponse.json({ ok: true, campanhaId: campanha.id })
    }

    if (acao === 'alternar_pesquisa') {
      const id = txt(body?.id, 100)
      const ativo = body?.ativo === true
      const { error } = await supabaseAdmin
        .from('ia_clima_campanhas')
        .update({ ativo })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) throw error
      return NextResponse.json({ ok: true, ativo })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e: any) {
    console.error('Atlas IA Admin:', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível concluir a ação.' }, { status: 500 })
  }
}