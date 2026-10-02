import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

function autorizado(req: NextRequest) {
  const esperado = String(process.env.ATLAS_AI_RUNTIME_REGISTRATION_TOKEN || '')
  const recebido = String(req.headers.get('x-atlas-ai-runtime-token') || '')
  if (!esperado || !recebido) return false

  const a = Buffer.from(esperado)
  const b = Buffer.from(recebido)
  return a.length === b.length && timingSafeEqual(a, b)
}

function normalizarGatewayUrl(valor: unknown) {
  const raw = String(valor || '').trim()
  const url = new URL(raw)

  if (url.protocol !== 'https:') throw new Error('O gateway precisa usar HTTPS.')
  if (url.username || url.password || url.port) throw new Error('URL de gateway inválida.')
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Informe somente a origem do gateway.')

  const host = url.hostname.toLowerCase()
  const extras = String(process.env.ATLAS_AI_RUNTIME_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  if (!host.endsWith('.trycloudflare.com') && !extras.includes(host)) {
    throw new Error('Host do gateway não autorizado.')
  }

  return `https://${host}`
}

async function validarHealth(baseUrl: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)

  try {
    const resp = await fetch(`${baseUrl}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!resp.ok) return false
    const data = await resp.json().catch(() => null)
    return data?.ok === true && data?.service === 'atlas-ai-gateway'
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const baseUrl = normalizarGatewayUrl(body?.baseUrl)

    if (!(await validarHealth(baseUrl))) {
      return NextResponse.json(
        { error: 'O endpoint informado não respondeu como Atlas AI Gateway.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('ai_runtime_endpoints')
      .upsert(
        {
          chave: 'opencode_gateway',
          base_url: baseUrl,
          ativo: true,
          observacao:
            'Gateway OpenCode da IA Comercial do Atlas One; OpenCode -> FreeLLMAPI; registro automático do runtime.',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'chave' },
      )
      .select('chave,base_url,ativo,updated_at')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, endpoint: data })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao registrar runtime.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
