import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'

export async function middleware(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) {
    return NextResponse.json(
      { error: 'Acesso W.Vetro não autorizado para esta empresa.' },
      { status: 403 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/integracoes/wvetro/preview'],
}
