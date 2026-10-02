import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

const RUNTIME_TOKEN_SHA256 = '0413cfd7c64307c11557c1504aa285a6df978e8e210019cb335c75ce837aedfe'

function tokenValido(recebido: string) {
  if (!recebido) return false
  const calculado = crypto.createHash('sha256').update(recebido).digest('hex')
  const a = Buffer.from(RUNTIME_TOKEN_SHA256, 'hex')
  const b = Buffer.from(calculado, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function normalizarBaseUrl(valor: unknown) {
  const bruto = String(valor || '').trim().replace(/\/$/, '')
  const url = new URL(bruto)
  if (url.protocol !== 'https:') throw new Error('O gateway precisa usar HTTPS.')

  const hostExtra = String(process.env.ATLAS_AI_RUNTIME_ALLOWED_HOST || '').trim().toLowerCase()
  const host = url.hostname.toLowerCase()
  const permitido = host.endsWith('.trycloudflare.com') || (hostExtra && host === hostExtra)
  if (!permitido) throw new Error('Host de gateway não permitido.')
  return url.origin
}

export async function POST(req: NextRequest) {
  try {
    const recebido = String(req.headers.get('x-atlas-runtime-token') || '').trim()
    if (!tokenValido(recebido)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const baseUrl = normalizarBaseUrl(body?.baseUrl)
    const { error } = await supabaseAdmin
      .from('ai_runtime_endpoints')
      .upsert({
        chave: 'opencode_gateway',
        base_url: baseUrl,
        ativo: true,
        observacao: 'Gateway OpenCode da IA Comercial do Atlas One; OpenCode -> FreeLLMAPI',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || 'Falha ao registrar runtime').slice(0, 300) },
      { status: 400 },
    )
  }
}
