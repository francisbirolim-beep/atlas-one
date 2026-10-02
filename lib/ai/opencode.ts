import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Atlas One - cliente server-side do OpenCode para a IA Comercial.
// Em producao, o Atlas chama um gateway autenticado pelo JWT Supabase.
// O gateway e o unico componente que conhece a senha do OpenCode.
// O OpenCode orquestra e o FreeLLMAPI executa/roteia a requisicao de modelo.

export type OpenCodeResultado = {
  sessionId: string
  resposta: string
  providerId: string
  modelId: string
}

type OpenCodeMensagem = {
  info?: {
    id?: string
    providerID?: string
    modelID?: string
    [key: string]: unknown
  }
  parts?: Array<{
    type?: string
    text?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

type OpenCodeConfig = {
  baseUrl: string
  authMode: 'basic' | 'atlas-jwt'
  username: string
  password: string
  agent: string
  providerId: string
  modelId: string
  timeoutMs: number
}

function configBase() {
  return {
    username: String(process.env.OPENCODE_SERVER_USERNAME || 'opencode').trim(),
    password: String(process.env.OPENCODE_SERVER_PASSWORD || '').trim(),
    agent: String(process.env.OPENCODE_AGENT || 'atlas-comercial').trim(),
    providerId: String(process.env.OPENCODE_PROVIDER_ID || 'freellmapi').trim(),
    modelId: String(process.env.OPENCODE_MODEL_ID || 'free-router').trim(),
    timeoutMs: Math.max(5_000, Number(process.env.OPENCODE_TIMEOUT_MS || 55_000)),
  }
}

async function carregarConfig(): Promise<OpenCodeConfig> {
  const base = configBase()
  const envBaseUrl = String(process.env.OPENCODE_BASE_URL || '').trim().replace(/\/$/, '')

  if (envBaseUrl) {
    return {
      ...base,
      baseUrl: envBaseUrl,
      authMode: base.password ? 'basic' : 'atlas-jwt',
    }
  }

  const { data, error } = await supabaseAdmin
    .from('ai_runtime_endpoints')
    .select('base_url')
    .eq('chave', 'opencode_gateway')
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    console.error('Falha ao carregar endpoint OpenCode:', error.message)
  }

  return {
    ...base,
    baseUrl: String(data?.base_url || '').trim().replace(/\/$/, ''),
    authMode: 'atlas-jwt',
  }
}

export async function statusOpenCode() {
  const c = await carregarConfig()
  return {
    configurado: Boolean(c.baseUrl && (c.authMode === 'atlas-jwt' || c.password)),
    baseUrlConfigurada: Boolean(c.baseUrl),
    modoAutenticacao: c.authMode,
    agent: c.agent,
    providerId: c.providerId,
    modelId: c.modelId,
  }
}

function extrairTexto(data: any): string {
  const payload: OpenCodeMensagem = (data?.data || data || {}) as OpenCodeMensagem

  const textos = Array.isArray(payload.parts)
    ? payload.parts
        .filter((p) => p?.type === 'text' && typeof p.text === 'string')
        .map((p) => String(p.text || '').trim())
        .filter(Boolean)
    : []

  if (textos.length) return textos.join('\n').trim()
  if (typeof (payload as any).text === 'string') return String((payload as any).text).trim()
  return ''
}

function extrairModelo(data: any, padraoProvider: string, padraoModelo: string) {
  const payload: OpenCodeMensagem = (data?.data || data || {}) as OpenCodeMensagem
  return {
    providerId: String(payload?.info?.providerID || padraoProvider),
    modelId: String(payload?.info?.modelID || padraoModelo),
  }
}

function cabecalhoAutorizacao(c: OpenCodeConfig, accessToken: string) {
  if (c.authMode === 'basic') {
    if (!c.password) throw new Error('OPENCODE_SERVER_PASSWORD nao configurada no servidor.')
    const basic = Buffer.from(`${c.username}:${c.password}`).toString('base64')
    return `Basic ${basic}`
  }

  if (!accessToken) throw new Error('Sessao Atlas ausente para autenticar o gateway da IA.')
  return `Bearer ${accessToken}`
}

async function requisitar(
  c: OpenCodeConfig,
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  if (!c.baseUrl) throw new Error('Endpoint do OpenCode nao configurado.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), c.timeoutMs)

  try {
    const resp = await fetch(c.baseUrl + path, {
      ...init,
      headers: {
        Authorization: cabecalhoAutorizacao(c, accessToken),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    const texto = await resp.text()
    let data: any = {}
    if (texto) {
      try {
        data = JSON.parse(texto)
      } catch {
        data = { text: texto }
      }
    }

    if (!resp.ok) {
      const detalhe =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        data?.text ||
        `OpenCode respondeu HTTP ${resp.status}`
      const erro: any = new Error(String(detalhe).slice(0, 800))
      erro.status = resp.status
      throw erro
    }

    return data
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Timeout ao consultar o OpenCode depois de ${c.timeoutMs} ms.`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

async function criarSessao(c: OpenCodeConfig, accessToken: string, titulo: string): Promise<string> {
  const data = await requisitar(c, accessToken, '/session', {
    method: 'POST',
    body: JSON.stringify({ title: titulo.slice(0, 120) }),
  })
  const id = String(data?.data?.id || data?.id || '').trim()
  if (!id) throw new Error('OpenCode nao retornou o ID da sessao.')
  return id
}

async function enviar(
  c: OpenCodeConfig,
  accessToken: string,
  sessionId: string,
  system: string,
  prompt: string,
): Promise<{ data: any; resposta: string }> {
  const data = await requisitar(c, accessToken, `/session/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    body: JSON.stringify({
      agent: c.agent,
      model: {
        providerID: c.providerId,
        modelID: c.modelId,
      },
      system,
      parts: [{ type: 'text', text: prompt }],
    }),
  })

  const resposta = extrairTexto(data)
  if (!resposta) throw new Error('O OpenCode concluiu a requisicao, mas nao retornou texto.')
  return { data, resposta }
}

export async function consultarOpenCode(params: {
  accessToken: string
  sessionId?: string | null
  tituloSessao: string
  system: string
  prompt: string
}): Promise<OpenCodeResultado> {
  const c = await carregarConfig()
  let sessionId = String(params.sessionId || '').trim()

  if (!sessionId) {
    sessionId = await criarSessao(c, params.accessToken, params.tituloSessao)
  }

  try {
    const { data, resposta } = await enviar(c, params.accessToken, sessionId, params.system, params.prompt)
    const modelo = extrairModelo(data, c.providerId, c.modelId)
    return { sessionId, resposta, ...modelo }
  } catch (e: any) {
    // Sessao antiga pode ter sido limpa/reiniciada no servidor OpenCode.
    // Recriamos somente em 404, sem mascarar erro de provider/modelo.
    if (e?.status !== 404) throw e
    sessionId = await criarSessao(c, params.accessToken, params.tituloSessao)
    const { data, resposta } = await enviar(c, params.accessToken, sessionId, params.system, params.prompt)
    const modelo = extrairModelo(data, c.providerId, c.modelId)
    return { sessionId, resposta, ...modelo }
  }
}
