import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function digits(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

function assinaturaValida(raw: string, assinatura: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true
  if (!assinatura?.startsWith('sha256=')) return false
  const esperado = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(esperado)
  const b = Buffer.from(assinatura)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && esperado && token === esperado && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Webhook não verificado' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!assinaturaValida(raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  try {
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {}

        for (const msg of value?.messages || []) {
          const telefone = digits(msg?.from)
          const messageId = typeof msg?.id === 'string' ? msg.id : null
          if (!telefone || !messageId) continue

          const { data: repetida } = await supabaseAdmin
            .from('atendimento_mensagens')
            .select('id')
            .eq('whatsapp_message_id', messageId)
            .maybeSingle()
          if (repetida) continue

          const { data: cliente } = await supabaseAdmin
            .from('clientes')
            .select('id')
            .or(`whatsapp.eq.${telefone},telefone.eq.${telefone}`)
            .limit(1)
            .maybeSingle()

          let { data: conversa } = await supabaseAdmin
            .from('atendimento_conversas')
            .select('id,cliente_id')
            .eq('telefone', telefone)
            .neq('status', 'finalizado')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const agora = new Date().toISOString()
          if (!conversa) {
            const criada = await supabaseAdmin
              .from('atendimento_conversas')
              .insert({ canal: 'whatsapp', telefone, cliente_id: cliente?.id || null, status: 'aguardando', ultima_mensagem_em: agora, updated_at: agora })
              .select('id,cliente_id')
              .single()
            if (criada.error) throw criada.error
            conversa = criada.data
          } else {
            const patch: Record<string, any> = { ultima_mensagem_em: agora, updated_at: agora }
            if (!conversa.cliente_id && cliente?.id) patch.cliente_id = cliente.id
            await supabaseAdmin.from('atendimento_conversas').update(patch).eq('id', conversa.id)
          }

          const tipo = typeof msg?.type === 'string' ? msg.type : 'texto'
          const texto = msg?.text?.body || msg?.button?.text || msg?.interactive?.button_reply?.title || msg?.interactive?.list_reply?.title || null
          const media = msg?.image || msg?.audio || msg?.video || msg?.document || msg?.sticker
          const mediaId = media?.id || null

          const inserida = await supabaseAdmin.from('atendimento_mensagens').insert({
            conversa_id: conversa.id,
            direcao: 'entrada',
            tipo: tipo === 'text' ? 'texto' : tipo,
            texto,
            media_url: mediaId ? `meta-media:${mediaId}` : null,
            whatsapp_message_id: messageId,
          })
          if (inserida.error) throw inserida.error
        }

        for (const status of value?.statuses || []) {
          const messageId = typeof status?.id === 'string' ? status.id : ''
          if (!messageId) continue
          const { data: mensagem } = await supabaseAdmin
            .from('atendimento_mensagens')
            .select('conversa_id')
            .eq('whatsapp_message_id', messageId)
            .maybeSingle()
          if (!mensagem?.conversa_id) continue
          await supabaseAdmin.from('atendimento_eventos').insert({
            conversa_id: mensagem.conversa_id,
            tipo: 'whatsapp_status',
            dados: { whatsapp_message_id: messageId, status: status?.status || null, timestamp: status?.timestamp || null },
          })
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('whatsapp webhook', error)
    return NextResponse.json({ error: 'Falha ao processar webhook' }, { status: 500 })
  }
}
