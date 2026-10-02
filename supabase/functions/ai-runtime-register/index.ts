import { createClient } from 'jsr:@supabase/supabase-js@2'

const RUNTIME_TOKEN_SHA256 = '0413cfd7c64307c11557c1504aa285a6df978e8e210019cb335c75ce837aedfe'

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getSecretKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modern) {
    const parsed = JSON.parse(modern)
    if (parsed?.default) return String(parsed.default)
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

function normalizeBaseUrl(value: unknown) {
  const url = new URL(String(value || '').trim().replace(/\/$/, ''))
  if (url.protocol !== 'https:') throw new Error('HTTPS obrigatório.')
  if (!url.hostname.toLowerCase().endsWith('.trycloudflare.com')) {
    throw new Error('Host de gateway não permitido.')
  }
  return url.origin
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405 })
  }

  try {
    const token = String(req.headers.get('x-atlas-runtime-token') || '').trim()
    if (!token || await sha256(token) !== RUNTIME_TOKEN_SHA256) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const baseUrl = normalizeBaseUrl(body?.baseUrl)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const secretKey = getSecretKey()
    if (!supabaseUrl || !secretKey) throw new Error('Configuração Supabase indisponível.')

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await admin.from('ai_runtime_endpoints').upsert({
      chave: 'opencode_gateway',
      base_url: baseUrl,
      ativo: true,
      observacao: 'Gateway OpenCode da IA Comercial do Atlas One; OpenCode -> FreeLLMAPI',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })

    if (error) throw error
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: String(error instanceof Error ? error.message : error).slice(0, 300) },
      { status: 400 },
    )
  }
})
