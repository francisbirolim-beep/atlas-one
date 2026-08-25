import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  processarLoteProdutosWVetro,
  processarPeriodoWVetro,
  sincronizarLinhasApiWVetro,
} from '@/lib/wvetroAuditoriaServer'
import { resumoAuditoriaWVetroExato } from '@/lib/wvetroResumoExatoServer'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import { processarLoteImagensWVetro } from '@/lib/wvetroImagensServer'

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
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function dataOk(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
}

function obsObjeto(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? { ...(valor as Record<string, any>) } : {}
}

async function execucaoRetomavel(periodoInicio?: string, periodoFim?: string) {
  let q = supabaseAdmin
    .from('wvetro_auditoria_execucoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
  if (periodoInicio) q = q.eq('periodo_inicio', periodoInicio)
  if (periodoFim) q = q.eq('periodo_fim', periodoFim)
  const { data } = await q.maybeSingle()
  if (!data || !['em_execucao', 'erro'].includes(String(data.status))) return null
  return data
}

async function reconstruirVariaveisExplicitas() {
  const { error } = await supabaseAdmin.rpc('fn_wvetro_reconstruir_variaveis_explicitas')
  if (error) throw error
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  try {
    const [resumo, retomavel] = await Promise.all([
      resumoAuditoriaWVetroExato(),
      execucaoRetomavel(),
    ])
    return NextResponse.json({ ok: true, resumo, execucaoRetomavel: retomavel })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao resumir auditoria.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await master(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}
  const acao = String(body?.acao || '')

  try {
    if (acao === 'iniciar') {
      const periodoInicio = dataOk(body.periodoInicio) ? body.periodoInicio : '2023-01-01'
      const periodoFim = dataOk(body.periodoFim) ? body.periodoFim : new Date().toISOString().slice(0, 10)
      if (periodoInicio > periodoFim) return NextResponse.json({ error: 'Período inicial maior que o final.' }, { status: 400 })

      const existente = await execucaoRetomavel()
      if (existente) {
        await supabaseAdmin
          .from('wvetro_auditoria_execucoes')
          .update({ status: 'em_execucao', erro: null })
          .eq('id', existente.id)
        return NextResponse.json({ ok: true, execucao: { ...existente, status: 'em_execucao', erro: null }, retomada: true, descobertaCatalogo: null })
      }

      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .insert({
          status: 'em_execucao',
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          cursor_data: null,
          iniciado_por_id: usuario.id,
          iniciado_por_nome: usuario.nome,
          observacoes: { pendencias: [] },
        })
        .select('*')
        .single()
      if (error) throw error

      const linhas = await sincronizarLinhasApiWVetro()
      const [descobertaP, descobertaA] = await Promise.all([
        descobrirEImportarCatalogoWVetro('P'),
        descobrirEImportarCatalogoWVetro('A'),
      ])

      return NextResponse.json({ ok: true, execucao, retomada: false, linhas, descobertaCatalogo: { perfis: descobertaP, acessorios: descobertaA } })
    }

    if (acao === 'periodo') {
      const execucaoId = String(body.execucaoId || '')
      const inicio = body.inicio
      const fim = body.fim
      if (!execucaoId || !dataOk(inicio) || !dataOk(fim)) return NextResponse.json({ error: 'Execução e período são obrigatórios.' }, { status: 400 })
      if (inicio !== fim) return NextResponse.json({ error: 'Cada chamada histórica deve processar exatamente 1 dia.' }, { status: 400 })

      const resultado = await processarPeriodoWVetro(inicio, fim)
      await supabaseAdmin.from('wvetro_auditoria_execucoes').update({ cursor_data: fim, status: 'em_execucao', erro: null }).eq('id', execucaoId)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'avancar_pendente') {
      const execucaoId = String(body.execucaoId || '')
      const data = body.data
      const motivo = String(body.motivo || 'Timeout W.Vetro')
      if (!execucaoId || !dataOk(data)) return NextResponse.json({ error: 'Execução e data são obrigatórias.' }, { status: 400 })

      const { data: execucao } = await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .select('observacoes')
        .eq('id', execucaoId)
        .maybeSingle()
      const observacoes = obsObjeto(execucao?.observacoes)
      const pendencias = Array.isArray(observacoes.pendencias) ? [...observacoes.pendencias] : []
      if (!pendencias.some((p: any) => p?.data === data)) {
        pendencias.push({ data, motivo, registrado_em: new Date().toISOString() })
      }
      observacoes.pendencias = pendencias

      await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .update({ cursor_data: data, status: 'em_execucao', erro: null, observacoes })
        .eq('id', execucaoId)
      return NextResponse.json({ ok: true, pendencias: pendencias.length })
    }

    if (acao === 'produtos') {
      const offset = Math.max(0, Number(body.offset || 0))
      const resultado = await processarLoteProdutosWVetro(offset, 1)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'imagens') {
      const offset = Math.max(0, Number(body.offset || 0))
      const resultado = await processarLoteImagensWVetro(offset, 1)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'finalizar') {
      const execucaoId = String(body.execucaoId || '')
      if (!execucaoId) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      await reconstruirVariaveisExplicitas()
      const resumo = await resumoAuditoriaWVetroExato()
      const { data: execucao } = await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .select('observacoes')
        .eq('id', execucaoId)
        .maybeSingle()
      const observacoes = obsObjeto(execucao?.observacoes)
      const pendencias = Array.isArray(observacoes.pendencias) ? observacoes.pendencias : []
      await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .update({ status: 'concluida', totais: resumo, erro: null, finalizado_em: new Date().toISOString(), observacoes })
        .eq('id', execucaoId)
      return NextResponse.json({ ok: true, resumo, pendencias })
    }

    return NextResponse.json({ error: 'Ação de auditoria inválida.' }, { status: 400 })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha na auditoria W.Vetro.'
    const timeoutWvetro = /Timeout W\.Vetro/i.test(mensagem)
    if (body?.execucaoId) {
      await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .update({ status: timeoutWvetro ? 'em_execucao' : 'erro', erro: mensagem })
        .eq('id', String(body.execucaoId))
    }
    return NextResponse.json({ error: mensagem }, { status: timeoutWvetro ? 504 : 500 })
  }
}
