import { NextRequest, NextResponse } from 'next/server'
import {
  configuracaoMeta,
  processarWebhookMeta,
  validarAssinaturaMeta,
} from '@/lib/whatsappServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  const esperado = configuracaoMeta().verifyToken

  if (mode === 'subscribe' && esperado && token === esperado && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Webhook nao autorizado.' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const assinatura = req.headers.get('x-hub-signature-256')

  if (!validarAssinaturaMeta(rawBody, assinatura)) {
    return NextResponse.json({ error: 'Assinatura do webhook invalida.' }, { status: 401 })
  }
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  try {
    const resultado = await processarWebhookMeta(payload)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error)
    return NextResponse.json(
      { error: 'Falha ao processar evento do WhatsApp.' },
      { status: 500 },
    )
  }
}