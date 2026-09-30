// Atlas One - cliente server-side do OpenCode para a IA Comercial.
// O OpenCode atua como orquestrador; o provider configurado nele e o FreeLLMAPI.
// Nenhuma credencial deste arquivo e exposta ao navegador.

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

function config() {
  const baseUrl = String(process.env.OPENCODE_BASE_URL || '').trim().replace(/\/$/, '')
  const username = String(process.env.OPENCODE_SERVER_USERNAME || 'opencode').trim()
  const password = String(process.env.OPENCODE_SERVER_PASSWORD || '').trim()
  const agent = String(process.env.OPENCODE_AGENT || 'atlas-comercial').trim()
  const providerId = String(process.env.OPENCODE_PROVIDER_ID || 'freellmapi').trim()
  const modelId = String(process.env.OPENCODE_MODEL_ID || 'auto').trim()
  const timeoutMs = Math.max(5_000, Number(process.env.OPENCODE_TIMEOUT_MS || 55_000))

  return { baseUrl, username, password, agent, providerId, modelId, timeoutMs }
}

export function statusOpenCode() {
  const c = config()
  return {
    configurado: Boolean(c.baseUrl && c.password),
    baseUrlConfigurada: Boolean(c.baseUrl),
    senhaConfigurada: Boolean(c.password),
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

async function requisitar(path: string, init: RequestInit = {}) {
  const c = config()
  if (!c.baseUrl) throw new Error('OPENCODE_BASE_URL nao configurada no servidor.')
  if (!c.password) throw new Error('OPENCODE_SERVER_PASSWORD nao configurada no servidor.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), c.timeoutMs)

  const auth = Buffer.from(`${c.username}:${c.password}`).toString('base64')

  try {
    const resp = await fetch(c.baseUrl + path, {
      ...init,
      headers: {
        Authorization: `Basic ${auth}`,
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

async function criarSessao(titulo: string): Promise<string> {
  const data = await requisitar('/session', {
    method: 'POST',
    body: JSON.stringify({ title: titulo.slice(0, 120) }),
  })
  const id = String(data?.data?.id || data?.id || '').trim()
  if (!id) throw new Error('OpenCode nao retornou o ID da sessao.')
  return id
}

async function enviar(
  sessionId: string,
  system: string,
  prompt: string,
): Promise<{ data: any; resposta: string }> {
  const c = config()
  const data = await requisitar(`/session/${encodeURIComponent(sessionId)}/message`, {
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
  sessionId?: string | null
  tituloSessao: string
  system: string
  prompt: string
}): Promise<OpenCodeResultado> {
  const c = config()
  let sessionId = String(params.sessionId || '').trim()

  if (!sessionId) {
    sessionId = await criarSessao(params.tituloSessao)
  }

  try {
    const { data, resposta } = await enviar(sessionId, params.system, params.prompt)
    const modelo = extrairModelo(data, c.providerId, c.modelId)
    return { sessionId, resposta, ...modelo }
  } catch (e: any) {
    // Sessao antiga pode ter sido limpa/reiniciada no servidor OpenCode.
    // Recriamos somente em 404, sem mascarar outros erros de provider/modelo.
    if (e?.status !== 404) throw e
    sessionId = await criarSessao(params.tituloSessao)
    const { data, resposta } = await enviar(sessionId, params.system, params.prompt)
    const modelo = extrairModelo(data, c.providerId, c.modelId)
    return { sessionId, resposta, ...modelo }
  }
}
