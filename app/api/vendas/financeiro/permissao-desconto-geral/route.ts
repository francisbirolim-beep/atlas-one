import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { permitidoConferirVenda } from '@/lib/conferenciaFinanceiraPermissaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Consulta a mesma autorização que protege a operação de desconto. */
export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const permitido = await permitidoConferirVenda(req, usuario)
    return NextResponse.json({ permitido }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível conferir a permissão de desconto.' }, { status: 503 })
  }
}
