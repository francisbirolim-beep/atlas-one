import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { capturarCasosParidadeWVetroDia } from '@/lib/wvetroBaseTecnicaServer'
import { compararParidadeWVetro, listarParidadeWVetro } from '@/lib/wvetroParidadeServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role')
    .eq('id', data.user.id)
    .maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

function tabelaParidadeAusente(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const texto = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return e.code === '42P01'
    || e.code === 'PGRST205'
    || (texto.includes('wvetro_') && (texto.includes('schema cache') || texto.includes('does not exist') || texto.includes('could not find')))
}

async function schemaParidadePronto() {
  const { error } = await supabaseAdmin
    .from('wvetro_tipologia_casos')
    .select('id', { count: 'exact', head: true })
  if (!error) return true
  if (tabelaParidadeAusente(error)) return false
  throw error
}

function numeroPositivo(v: string | null) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function dataOk(v: unknown): v is string {
  return typeof v === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

function somarDia(data: string) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function ultimaExecucao() {
  const { data, error } = await supabaseAdmin
    .from('wvetro_paridade_execucoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function pendencias(execucaoId: string) {
  const [{ count, error }, { data: proximas, error: erroProximas }] = await Promise.all([
    supabaseAdmin
      .from('wvetro_paridade_pendencias')
      .select('id', { count: 'exact', head: true })
      .eq('execucao_id', execucaoId)
      .eq('status', 'pendente'),
    supabaseAdmin
      .from('wvetro_paridade_pendencias')
      .select('id,data,erro,tentativas,status,resultado,atualizado_em')
      .eq('execucao_id', execucaoId)
      .eq('status', 'pendente')
      .order('data', { ascending: true })
      .limit(20),
  ])
  if (error) throw error
  if (erroProximas) throw erroProximas
  return { total: count || 0, proximas: proximas || [] }
}

async function totalCasos() {
  const { count, error } = await supabaseAdmin
    .from('wvetro_tipologia_casos')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

export async function GET(req: NextRequest) {
  if (!await master(req)) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  try {
    const referenciaId = String(req.nextUrl.searchParams.get('referenciaId') || '').trim()
    if (!referenciaId) {
      const filtro = String(req.nextUrl.searchParams.get('filtro') ?? 'correr').trim()
      const schemaPronto = await schemaParidadePronto()
      const referencias = await listarParidadeWVetro(filtro)
      const [execucao, casos] = schemaPronto
        ? await Promise.all([ultimaExecucao(), totalCasos()])
        : [null, 0]
      const pend = schemaPronto && execucao ? await pendencias(execucao.id) : { total: 0, proximas: [] }
      return NextResponse.json({
        ok: true,
        modo: 'somente-leitura',
        schemaParidadePronto: schemaPronto,
        referencias,
        casosIndividuais: casos,
        execucao,
        pendencias: pend,
      })
    }

    const largura = numeroPositivo(req.nextUrl.searchParams.get('largura'))
    const altura = numeroPositivo(req.nextUrl.searchParams.get('altura'))
    if (!largura || !altura) {
      return NextResponse.json({ error: 'Informe largura e altura positivas em milímetros.' }, { status: 400 })
    }

    let opcoes: Record<string, string> = {}
    const opcoesRaw = req.nextUrl.searchParams.get('opcoes')
    if (opcoesRaw) {
      try {
        const parsed = JSON.parse(opcoesRaw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) opcoes = parsed
      } catch {
        return NextResponse.json({ error: 'Opções inválidas.' }, { status: 400 })
      }
    }

    const schemaPronto = await schemaParidadePronto()
    const comparacao = await compararParidadeWVetro({ referenciaId, largura, altura, opcoes })
    return NextResponse.json({ ok: true, modo: 'somente-leitura', schemaParidadePronto: schemaPronto, comparacao })
  } catch (e) {
    console.error('Erro na paridade W.Vetro × Atlas:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha ao comparar W.Vetro com Atlas.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const usuario = await master(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const acao = String(body?.acao || '')

  try {
    if (!await schemaParidadePronto()) {
      return NextResponse.json({
        error: 'A estrutura de casos de paridade ainda não foi aplicada. A comparação agregada continua disponível, mas a captura histórica permanece bloqueada.',
      }, { status: 409 })
    }
    if (acao === 'iniciar_historico') {
      const inicio = String(body?.inicio || '')
      const fim = String(body?.fim || '')
      if (!dataOk(inicio) || !dataOk(fim) || inicio > fim) {
        return NextResponse.json({ error: 'Informe um período válido no formato YYYY-MM-DD.' }, { status: 400 })
      }
      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_paridade_execucoes')
        .insert({
          periodo_inicio: inicio,
          periodo_fim: fim,
          cursor_data: inicio,
          status: 'em_andamento',
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          ultima_mensagem: `Captura de paridade preparada para ${inicio} até ${fim}.`,
        })
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao, casosIndividuais: await totalCasos() })
    }

    if (acao === 'cancelar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_paridade_execucoes')
        .update({
          status: 'cancelada',
          ultima_mensagem: 'Captura de paridade cancelada pelo usuário.',
          finalizado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao })
    }

    if (acao === 'retomar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_paridade_execucoes')
        .update({ status: 'em_andamento', erro: null, finalizado_em: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao })
    }

    if (acao === 'continuar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_paridade_execucoes')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !execucao) return NextResponse.json({ error: 'Execução não encontrada.' }, { status: 404 })
      if (execucao.status !== 'em_andamento') {
        return NextResponse.json({ error: `Execução está ${execucao.status}.` }, { status: 409 })
      }

      const data = String(execucao.cursor_data)
      if (data > String(execucao.periodo_fim)) {
        const pend = await pendencias(id)
        const { data: concluida, error: erroFim } = await supabaseAdmin
          .from('wvetro_paridade_execucoes')
          .update({
            status: 'concluida',
            dias_pendentes: pend.total,
            ultima_mensagem: pend.total
              ? `Captura histórica concluída com ${pend.total} dia(s) pendente(s).`
              : 'Captura histórica de paridade concluída sem pendências.',
            finalizado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single()
        if (erroFim) throw erroFim
        return NextResponse.json({
          ok: true,
          concluida: true,
          execucao: concluida,
          pendencias: pend,
          casosIndividuais: await totalCasos(),
        })
      }

      try {
        const resultado = await capturarCasosParidadeWVetroDia(data)
        const proxima = somarDia(data)
        const terminou = proxima > String(execucao.periodo_fim)
        const pend = await pendencias(id)
        const { data: atualizada, error: erroUpdate } = await supabaseAdmin
          .from('wvetro_paridade_execucoes')
          .update({
            cursor_data: proxima,
            status: terminou ? 'concluida' : 'em_andamento',
            dias_processados: Number(execucao.dias_processados || 0) + 1,
            dias_pendentes: pend.total,
            itens_processados: Number(execucao.itens_processados || 0) + Number(resultado.itens || 0),
            casos_processados: Number(execucao.casos_processados || 0) + Number(resultado.casos || 0),
            tipologias_processadas: Number(execucao.tipologias_processadas || 0) + Number(resultado.tipologias || 0),
            ultima_mensagem: `${data}: ${resultado.casos} caso(s) individual(is), ${resultado.tipologias} tipologia(s).`,
            erro: null,
            updated_at: new Date().toISOString(),
            finalizado_em: terminou ? new Date().toISOString() : null,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (erroUpdate) throw erroUpdate
        return NextResponse.json({
          ok: true,
          concluida: terminou,
          resultado,
          execucao: atualizada,
          pendencias: pend,
          casosIndividuais: await totalCasos(),
        })
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'Falha ao capturar o dia.'
        const { data: existente } = await supabaseAdmin
          .from('wvetro_paridade_pendencias')
          .select('id,tentativas')
          .eq('execucao_id', id)
          .eq('data', data)
          .maybeSingle()
        const tentativas = Number(existente?.tentativas || 0) + 1
        const { error: erroPendencia } = await supabaseAdmin
          .from('wvetro_paridade_pendencias')
          .upsert({
            execucao_id: id,
            data,
            erro: mensagem,
            tentativas,
            status: 'pendente',
            resultado: { falhou_em: new Date().toISOString() },
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'execucao_id,data' })
        if (erroPendencia) throw erroPendencia

        const proxima = somarDia(data)
        const terminou = proxima > String(execucao.periodo_fim)
        const pend = await pendencias(id)
        const { data: atualizada, error: erroUpdate } = await supabaseAdmin
          .from('wvetro_paridade_execucoes')
          .update({
            cursor_data: proxima,
            status: terminou ? 'concluida' : 'em_andamento',
            dias_processados: Number(execucao.dias_processados || 0) + 1,
            dias_pendentes: pend.total,
            ultima_mensagem: `${data}: falha registrada; captura avançou para ${proxima} sem alterar a base agregada.`,
            erro: null,
            updated_at: new Date().toISOString(),
            finalizado_em: terminou ? new Date().toISOString() : null,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (erroUpdate) throw erroUpdate
        return NextResponse.json({
          ok: true,
          concluida: terminou,
          pendente: true,
          pendencia: { data, erro: mensagem, tentativas },
          execucao: atualizada,
          pendencias: pend,
          casosIndividuais: await totalCasos(),
        })
      }
    }

    if (acao === 'reprocessar_pendencia') {
      const id = String(body?.execucaoId || '')
      const dataAlvo = body?.data ? String(body.data) : ''
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })

      let query = supabaseAdmin
        .from('wvetro_paridade_pendencias')
        .select('*')
        .eq('execucao_id', id)
        .eq('status', 'pendente')
      if (dataAlvo) query = query.eq('data', dataAlvo)
      const { data: pendencia, error } = await query.order('data', { ascending: true }).limit(1).maybeSingle()
      if (error) throw error

      if (!pendencia) {
        return NextResponse.json({
          ok: true,
          concluida: true,
          pendencias: await pendencias(id),
          casosIndividuais: await totalCasos(),
        })
      }

      const tentativas = Number(pendencia.tentativas || 0) + 1
      try {
        const resultado = await capturarCasosParidadeWVetroDia(String(pendencia.data))
        const agora = new Date().toISOString()
        const { error: erroResolve } = await supabaseAdmin
          .from('wvetro_paridade_pendencias')
          .update({
            status: 'resolvida',
            tentativas,
            erro: pendencia.erro,
            resultado,
            resolvido_em: agora,
            atualizado_em: agora,
          })
          .eq('id', pendencia.id)
        if (erroResolve) throw erroResolve

        const pend = await pendencias(id)
        const { data: execucaoAtual, error: erroExec } = await supabaseAdmin
          .from('wvetro_paridade_execucoes')
          .select('*')
          .eq('id', id)
          .single()
        if (erroExec) throw erroExec
        const { data: atualizada, error: erroUpdate } = await supabaseAdmin
          .from('wvetro_paridade_execucoes')
          .update({
            dias_pendentes: pend.total,
            itens_processados: Number(execucaoAtual?.itens_processados || 0) + Number(resultado.itens || 0),
            casos_processados: Number(execucaoAtual?.casos_processados || 0) + Number(resultado.casos || 0),
            tipologias_processadas: Number(execucaoAtual?.tipologias_processadas || 0) + Number(resultado.tipologias || 0),
            ultima_mensagem: pend.total
              ? `${pendencia.data}: pendência resolvida; restam ${pend.total}.`
              : `${pendencia.data}: pendência resolvida; não há pendências.`,
            updated_at: agora,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (erroUpdate) throw erroUpdate

        return NextResponse.json({
          ok: true,
          resultado,
          execucao: atualizada,
          pendencias: pend,
          casosIndividuais: await totalCasos(),
        })
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'Falha ao reprocessar pendência.'
        await supabaseAdmin
          .from('wvetro_paridade_pendencias')
          .update({
            erro: mensagem,
            tentativas,
            resultado: { falhou_em: new Date().toISOString() },
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', pendencia.id)
        return NextResponse.json({ error: mensagem, data: pendencia.data, tentativas }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro no backfill de paridade W.Vetro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha no backfill de paridade W.Vetro.' },
      { status: 500 },
    )
  }
}