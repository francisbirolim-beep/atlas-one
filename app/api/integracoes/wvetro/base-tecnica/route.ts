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

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, resumo: await resumoBaseTecnicaWVetro() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao resumir a base técnica W.Vetro.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
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
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro na base técnica W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao processar a base técnica W.Vetro.' }, { status: 500 })
  }
}
