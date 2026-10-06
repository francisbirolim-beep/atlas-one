import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import {
  enviarTextoWhatsApp,
  listarMensagensAtendimento,
  reagirMensagemWhatsApp,
} from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const conversaId = req.nextUrl.searchParams.get('conversaId') || ''
  if (!conversaId) {
    return NextResponse.json({ error: 'Conversa nao informada.' }, { status: 400 })
  }

  try {
    const mensagens = await listarMensagensAtendimento(conversaId, usuario)
    if (!mensagens) {
      return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, mensagens })
  } catch (error) {
    console.error('Erro ao listar mensagens WhatsApp:', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar as mensagens.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const conversaId = String(body?.conversaId || '')
    const acao = String(body?.acao || 'enviar')

    if (!conversaId) {
      return NextResponse.json({ error: 'Conversa obrigatoria.' }, { status: 400 })
    }

    if (acao === 'reagir') {
      const mensagemId = String(body?.mensagemId || '')
      const emoji = String(body?.emoji || '')
      if (!mensagemId || !emoji.trim()) {
        return NextResponse.json({ error: 'Mensagem e emoji sao obrigatorios.' }, { status: 400 })
      }
      const resultado = await reagirMensagemWhatsApp(conversaId, mensagemId, emoji, usuario)
      return NextResponse.json({ ok: true, ...resultado })
    }

    const texto = String(body?.texto || '')
    if (!texto.trim()) {
      return NextResponse.json({ error: 'Mensagem obrigatoria.' }, { status: 400 })
    }
    const respostaMensagemId = String(body?.respostaMensagemId || '') || null
    const resultado = await enviarTextoWhatsApp(conversaId, texto, usuario, respostaMensagemId)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao enviar mensagem.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}