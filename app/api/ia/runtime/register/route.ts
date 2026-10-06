import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

const RUNTIME_TOKEN_SHA256 = '0413cfd7c64307c11557c1504aa285a6df978e8e210019cb335c75ce837aedfe'
const CHAVES_RUNTIME = new Set(['opencode_gateway','whisper_gateway','image_gateway'])

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
    const chave = String(body?.chave || 'opencode_gateway').trim()
    if (!CHAVES_RUNTIME.has(chave)) throw new Error('Tipo de runtime não permitido.')

    const observacoes: Record<string,string> = {
      opencode_gateway: 'Gateway OpenCode do Atlas; ordem gratuita: Ollama local -> FreeLLMAPI.',
      whisper_gateway: 'Whisper local compatível com /v1/audio/transcriptions; custo por token zero.',
      image_gateway: 'Stable Diffusion WebUI/Forge local; geração de imagem sem API paga.',
    }

    const { error } = await supabaseAdmin
      .from('ai_runtime_endpoints')
      .upsert({
        chave,
        base_url: baseUrl,
        ativo: true,
        observacao: observacoes[chave] || 'Runtime gratuito Atlas',
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
