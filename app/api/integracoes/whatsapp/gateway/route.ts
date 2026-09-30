import { NextRequest, NextResponse } from 'next/server'
import {
  autenticarGatewayWhatsApp,
  atualizarEstadoGateway,
  confirmarSaidaGateway,
  proximaSaidaGateway,
  registrarEntradaGateway,
} from '@/lib/whatsappServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenGateway(req: NextRequest) {
  return req.headers.get('x-atlas-gateway-token')
}

export async function GET(req: NextRequest) {
  const config = await autenticarGatewayWhatsApp(tokenGateway(req))
  if (!config) {
    return NextResponse.json({ error: 'Gateway nao autorizado.' }, { status: 401 })
  }

  try {
    const item = await proximaSaidaGateway(config)
    return NextResponse.json({
      ok: true,
      item,
      numeroPrincipal: config.numero_principal,
    })
  } catch (error) {
    console.error('Erro ao buscar fila WhatsApp QR:', error)
    return NextResponse.json({ error: 'Falha ao consultar fila.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const config = await autenticarGatewayWhatsApp(tokenGateway(req))
  if (!config) {
    return NextResponse.json({ error: 'Gateway nao autorizado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const tipo = String(body?.type || '')

    if (tipo === 'state') {
      await atualizarEstadoGateway(config, {
        status: body.status,
        qrDataUrl: body.qrDataUrl || null,
        connectedJid: body.connectedJid || null,
        deviceName: body.deviceName || 'Atlas One Mac Gateway',
      })
      return NextResponse.json({ ok: true })
    }

    if (tipo === 'inbound') {
      const resultado = await registrarEntradaGateway(config, {
        telefone: String(body.telefone || ''),
        contatoNome: body.contatoNome || null,
        whatsappMessageId: body.whatsappMessageId || null,
        tipo: body.messageType || 'text',
        texto: body.texto || null,
        timestamp: body.timestamp || null,
        payload: body.payload || null,
      })
      return NextResponse.json({ ok: true, ...resultado })
    }

    if (tipo === 'sent') {
      const resultado = await confirmarSaidaGateway(config, {
        filaId: String(body.filaId || ''),
        sucesso: body.sucesso === true,
        whatsappMessageId: body.whatsappMessageId || null,
        erro: body.erro || null,
      })
      return NextResponse.json(resultado)
    }

    return NextResponse.json({ error: 'Evento de gateway invalido.' }, { status: 400 })
  } catch (error) {
    console.error('Erro no gateway WhatsApp QR:', error)
    const mensagem = error instanceof Error ? error.message : 'Falha no gateway.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}