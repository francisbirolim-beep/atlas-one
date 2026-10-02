import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import {
  iniciarConversaWhatsApp,
  listarDiretorioWhatsApp,
} from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  try {
    const canalId = String(req.nextUrl.searchParams.get('canalId') || '')
    const busca = String(req.nextUrl.searchParams.get('busca') || '')
    if (!canalId) {
      return NextResponse.json({ error: 'Canal nao informado.' }, { status: 400 })
    }

    const itens = await listarDiretorioWhatsApp(usuario, canalId, busca)
    return NextResponse.json({ ok: true, itens })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao buscar contatos.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const conversa = await iniciarConversaWhatsApp(usuario, {
      canalId: String(body?.canalId || ''),
      tipo: body?.tipo === 'grupo' ? 'grupo' : 'contato',
      jid: String(body?.jid || ''),
      telefone: body?.telefone ? String(body.telefone) : null,
      nome: body?.nome ? String(body.nome) : null,
    })
    return NextResponse.json({ ok: true, conversa })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao iniciar conversa.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}