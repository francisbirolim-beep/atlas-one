import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  mapearReferenciasComponentesExatas,
  processarBaseTecnicaWVetroDia,
  resumoBaseTecnicaWVetro,
  sincronizarCatalogoEsquadriasWVetro,
  sincronizarCustosProdutosWVetro,
} from '@/lib/wvetroBaseTecnicaServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

function dataOk(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

function somarDia(data: string) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function ultimaExecucao() {
  const { data, error } = await supabaseAdmin
    .from('wvetro_base_tecnica_execucoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  try {
    return NextResponse.json({
      ok: true,
      resumo: await resumoBaseTecnicaWVetro(),
      execucao: await ultimaExecucao(),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao resumir a base técnica W.Vetro.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await master(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  let body: any = {}
  try { body = await req.json() } catch {}
  const acao = String(body?.acao || '')
  try {
    if (acao === 'mapear_componentes') {
      return NextResponse.json({ ok: true, resultado: await mapearReferenciasComponentesExatas(), resumo: await resumoBaseTecnicaWVetro() })
    }
    if (acao === 'sincronizar_custos') {
      return NextResponse.json({ ok: true, resultado: await sincronizarCustosProdutosWVetro(), resumo: await resumoBaseTecnicaWVetro() })
    }
    if (acao === 'catalogo_esquadrias') {
      return NextResponse.json({ ok: true, resultado: await sincronizarCatalogoEsquadriasWVetro(), resumo: await resumoBaseTecnicaWVetro() })
    }
    if (acao === 'periodo') {
      if (!dataOk(body?.data)) return NextResponse.json({ error: 'Informe a data no formato YYYY-MM-DD.' }, { status: 400 })
      return NextResponse.json({ ok: true, resultado: await processarBaseTecnicaWVetroDia(body.data), resumo: await resumoBaseTecnicaWVetro() })
    }
    if (acao === 'iniciar_historico') {
      const inicio = String(body?.inicio || '')
      const fim = String(body?.fim || '')
      if (!dataOk(inicio) || !dataOk(fim) || inicio > fim) {
        return NextResponse.json({ error: 'Informe um período válido no formato YYYY-MM-DD.' }, { status: 400 })
      }
      const { data: execucao, error } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').insert({
        periodo_inicio: inicio,
        periodo_fim: fim,
        cursor_data: inicio,
        status: 'em_andamento',
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
        ultima_mensagem: `Carga preparada para ${inicio} até ${fim}.`,
      }).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao, resumo: await resumoBaseTecnicaWVetro() })
    }
    if (acao === 'retomar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
        status: 'em_andamento', erro: null, updated_at: new Date().toISOString(), finalizado_em: null,
      }).eq('id', id).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao })
    }
    if (acao === 'cancelar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
        status: 'cancelada', ultima_mensagem: 'Carga cancelada pelo usuário.', updated_at: new Date().toISOString(), finalizado_em: new Date().toISOString(),
      }).eq('id', id).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, execucao })
    }
    if (acao === 'continuar_historico') {
      const id = String(body?.execucaoId || '')
      if (!id) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      const { data: execucao, error } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').select('*').eq('id', id).single()
      if (error || !execucao) return NextResponse.json({ error: 'Execução não encontrada.' }, { status: 404 })
      if (execucao.status !== 'em_andamento') return NextResponse.json({ error: `Execução está ${execucao.status}.` }, { status: 409 })
      const data = String(execucao.cursor_data)
      if (data > String(execucao.periodo_fim)) {
        const { data: concluida, error: erroFim } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
          status: 'concluida', ultima_mensagem: 'Carga histórica concluída.', updated_at: new Date().toISOString(), finalizado_em: new Date().toISOString(),
        }).eq('id', id).select('*').single()
        if (erroFim) throw erroFim
        return NextResponse.json({ ok: true, concluida: true, execucao: concluida, resumo: await resumoBaseTecnicaWVetro() })
      }

      try {
        const resultado = await processarBaseTecnicaWVetroDia(data)
        const proxima = somarDia(data)
        const terminou = proxima > String(execucao.periodo_fim)
        const { data: atualizada, error: erroUpdate } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
          cursor_data: proxima,
          status: terminou ? 'concluida' : 'em_andamento',
          dias_processados: Number(execucao.dias_processados || 0) + 1,
          itens_processados: Number(execucao.itens_processados || 0) + Number(resultado.itens || 0),
          tipologias_processadas: Number(execucao.tipologias_processadas || 0) + Number(resultado.tipologias || 0),
          componentes_processados: Number(execucao.componentes_processados || 0) + Number(resultado.componentes || 0),
          ultima_mensagem: `${data}: ${resultado.itens} item(ns), ${resultado.tipologias} tipologia(s), ${resultado.componentes} componente(s).`,
          erro: null,
          updated_at: new Date().toISOString(),
          finalizado_em: terminou ? new Date().toISOString() : null,
        }).eq('id', id).select('*').single()
        if (erroUpdate) throw erroUpdate
        return NextResponse.json({ ok: true, concluida: terminou, resultado, execucao: atualizada, resumo: await resumoBaseTecnicaWVetro() })
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'Falha ao processar o dia.'
        await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
          status: 'erro', erro: mensagem, ultima_mensagem: `${data}: falha; o cursor foi preservado para retomada.`, updated_at: new Date().toISOString(),
        }).eq('id', id)
        throw e
      }
    }
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro na base técnica W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao processar a base técnica W.Vetro.' }, { status: 500 })
  }
}
