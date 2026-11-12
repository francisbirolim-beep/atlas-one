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
    const antesRaw = req.nextUrl.searchParams.get('antes') || ''
    let antes: { createdAt: string; id: string } | null = null
    if (antesRaw) {
      const partes = antesRaw.split('|')
      const [createdAt, id] = partes
      if (
        partes.length !== 2 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        !Number.isFinite(Date.parse(createdAt))
      ) {
        return NextResponse.json({ error: 'Cursor de historico invalido.' }, { status: 400 })
      }
      antes = { createdAt, id }
    }
    const resultado = await listarMensagensAtendimento(conversaId, usuario, antes)
    if (!resultado) {
      return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, ...resultado })
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