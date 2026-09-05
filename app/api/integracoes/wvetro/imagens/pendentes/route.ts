import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'

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
    .select('id,role')
    .eq('id', data.user.id)
    .maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  const { count: pendentes } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id', { count: 'exact', head: true })
    .eq('imagem_status', 'pendente')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)
  const { count: erros } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id', { count: 'exact', head: true })
    .eq('imagem_status', 'erro')
  return NextResponse.json({ ok: true, pendentes: pendentes || 0, erros: erros || 0 })
}

export async function POST(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const limite = Math.min(30, Math.max(1, Number(body?.limite || 20)))
    const resultado = await processarPendenciasImagensWVetro(limite)
    return NextResponse.json({ ok: true, resultado })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar imagens.' }, { status: 500 })
  }
}
