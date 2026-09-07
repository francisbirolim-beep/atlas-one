import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) return NextResponse.json({ error: 'Acesso W.Vetro não autorizado para esta empresa.' }, { status: 403 })
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
  if (!await autenticarMasterWVetro(req)) return NextResponse.json({ error: 'Acesso W.Vetro não autorizado para esta empresa.' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const limite = Math.min(30, Math.max(1, Number(body?.limite || 20)))
    const resultado = await processarPendenciasImagensWVetro(limite)
    return NextResponse.json({ ok: true, resultado })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar imagens.' }, { status: 500 })
  }
}
