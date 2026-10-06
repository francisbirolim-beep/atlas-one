import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function contarStatus(status: string) {
  const { count, error } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id', { count: 'exact', head: true })
    .eq('imagem_status', status)
  if (error) throw error
  return count || 0
}

export async function GET(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  const [
    pendentes,
    copiadas,
    preservadas,
    indisponiveis,
    invalidas,
    semImagemOrigem,
    erros,
  ] = await Promise.all([
    contarStatus('pendente'),
    contarStatus('copiada'),
    contarStatus('preservada_atlas'),
    contarStatus('indisponivel_origem'),
    contarStatus('url_invalida_origem'),
    contarStatus('sem_imagem_origem'),
    contarStatus('erro'),
  ])

  return NextResponse.json({
    ok: true,
    pendentes,
    copiadas,
    preservadas,
    indisponiveis,
    invalidas,
    semImagemOrigem,
    erros,
  })
}

export async function POST(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const limite = Math.min(30, Math.max(1, Number(body?.limite || 20)))
    const resultado = await processarPendenciasImagensWVetro(limite)
    return NextResponse.json({ ok: true, resultado })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Falha ao sincronizar imagens.',
    }, { status: 500 })
  }
}
