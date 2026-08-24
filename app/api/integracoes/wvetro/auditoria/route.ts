import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  processarLoteProdutosWVetro,
  processarPeriodoWVetro,
  resumoAuditoriaWVetro,
  sincronizarLinhasApiWVetro,
} from '@/lib/wvetroAuditoriaServer'
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

function dias(inicio: string, fim: string) {
  return Math.floor((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000)
}

async function reconstruirVariaveisExplicitas() {
  const { error } = await supabaseAdmin.rpc('fn_wvetro_reconstruir_variaveis_explicitas')
  if (error) throw error
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, resumo: await resumoAuditoriaWVetro() })
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

      const { data: execucao, error } = await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .insert({
          status: 'em_execucao',
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          cursor_data: periodoInicio,
          iniciado_por_id: usuario.id,
          iniciado_por_nome: usuario.nome,
        })
        .select('*')
        .single()
      if (error) throw error

      const linhas = await sincronizarLinhasApiWVetro()
      const [descobertaP, descobertaA] = await Promise.all([
        descobrirEImportarCatalogoWVetro('P'),
        descobrirEImportarCatalogoWVetro('A'),
      ])

      return NextResponse.json({ ok: true, execucao, linhas, descobertaCatalogo: { perfis: descobertaP, acessorios: descobertaA } })
    }

    if (acao === 'periodo') {
      const execucaoId = String(body.execucaoId || '')
      const inicio = body.inicio
      const fim = body.fim
      if (!execucaoId || !dataOk(inicio) || !dataOk(fim)) return NextResponse.json({ error: 'Execução e período são obrigatórios.' }, { status: 400 })
      if (inicio > fim || dias(inicio, fim) > 89) return NextResponse.json({ error: 'Cada lote deve ter no máximo 90 dias.' }, { status: 400 })

      const resultado = await processarPeriodoWVetro(inicio, fim)
      await reconstruirVariaveisExplicitas()
      await supabaseAdmin.from('wvetro_auditoria_execucoes').update({ cursor_data: fim }).eq('id', execucaoId)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'produtos') {
      const offset = Math.max(0, Number(body.offset || 0))
      const limite = Math.min(25, Math.max(1, Number(body.limite || 12)))
      const resultado = await processarLoteProdutosWVetro(offset, limite)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'imagens') {
      const offset = Math.max(0, Number(body.offset || 0))
      const limite = Math.min(15, Math.max(1, Number(body.limite || 10)))
      const resultado = await processarLoteImagensWVetro(offset, limite)
      return NextResponse.json({ ok: true, resultado })
    }

    if (acao === 'finalizar') {
      const execucaoId = String(body.execucaoId || '')
      if (!execucaoId) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })
      await reconstruirVariaveisExplicitas()
      const resumo = await resumoAuditoriaWVetro()
      await supabaseAdmin
        .from('wvetro_auditoria_execucoes')
        .update({ status: 'concluida', totais: resumo, finalizado_em: new Date().toISOString() })
        .eq('id', execucaoId)
      return NextResponse.json({ ok: true, resumo })
    }

    return NextResponse.json({ error: 'Ação de auditoria inválida.' }, { status: 400 })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha na auditoria W.Vetro.'
    if (body?.execucaoId) {
      await supabaseAdmin.from('wvetro_auditoria_execucoes').update({ status: 'erro', erro: mensagem }).eq('id', String(body.execucaoId))
    }
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
