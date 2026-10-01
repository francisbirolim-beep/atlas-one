import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import {
  enviarMidiaWhatsApp,
  prepararUploadMidiaAtendimento,
} from '@/lib/whatsappServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const acao = String(body?.acao || '')
    const conversaId = String(body?.conversaId || '')

    if (!conversaId) {
      return NextResponse.json({ error: 'Conversa nao informada.' }, { status: 400 })
    }

    if (acao === 'preparar') {
      const resultado = await prepararUploadMidiaAtendimento(
        conversaId,
        {
          nome: body.nome || null,
          mimeType: body.mimeType || null,
          tamanho: Number(body.tamanho || 0),
        },
        usuario,
      )
      return NextResponse.json({ ok: true, ...resultado })
    }

    if (acao === 'enviar') {
      const resultado = await enviarMidiaWhatsApp(
        conversaId,
        {
          mediaPath: String(body.mediaPath || ''),
          mimeType: String(body.mimeType || ''),
          fileName: body.fileName || null,
          tamanho: Number(body.tamanho || 0),
          legenda: body.legenda || null,
          ptt: body.ptt !== false,
        },
        usuario,
      )
      return NextResponse.json({ ok: true, ...resultado })
    }

    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao processar a midia.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
