import { NextRequest, NextResponse } from 'next/server'
import { processarEscalonamentoTriagem } from '@/lib/whatsappServer'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }
  try {
    const transferidas = await processarEscalonamentoTriagem()
    return NextResponse.json({ ok: true, transferidas })
  } catch (error) {
    console.error('Falha ao escalonar conversas WhatsApp:', error)
    return NextResponse.json({ error: 'Nao foi possivel processar a triagem.' }, { status: 500 })
  }
}
