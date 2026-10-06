import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Atlas One - roteador server-side de IA sem custo por token.
// Ordem: OpenCode + Ollama local -> OpenCode + FreeLLMAPI Community.
// Provedores pagos nunca entram neste fluxo quando ATLAS_AI_FORCE_ZERO_COST != false.

export type OpenCodeResultado = {
  sessionId: string
  resposta: string
  providerId: string
  modelId: string
  rota: 'ollama-local' | 'freellmapi'
  custoEstimado: 0
  tentativas: Array<{ rota: string; ok: boolean; detalhe?: string }>
}

export type OpenCodeAnexo = {
  nome: string
  mediaType: string
  dados: string
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
  localProviderId: string
  localModelId: string
  tentarLocal: boolean
  zeroCost: boolean
  timeoutMs: number
}

let localBloqueadoAte = 0
let ultimoErroLocal = ''

export function politicaZeroCustoAtiva() {
  return String(process.env.ATLAS_AI_FORCE_ZERO_COST || 'true').toLowerCase() !== 'false'
}

function configBase() {
  const zeroCost = politicaZeroCustoAtiva()
  return {
    username: String(process.env.OPENCODE_SERVER_USERNAME || 'opencode').trim(),
    password: String(process.env.OPENCODE_SERVER_PASSWORD || '').trim(),
    agent: String(process.env.OPENCODE_AGENT || 'atlas-comercial').trim(),
    // Em zero-cost ignoramos qualquer provider pago configurado por engano no ambiente.
    providerId: zeroCost
      ? 'freellmapi'
      : String(process.env.OPENCODE_PROVIDER_ID || 'freellmapi').trim(),
    modelId: zeroCost
      ? 'free-router'
      : String(process.env.OPENCODE_MODEL_ID || 'free-router').trim(),
    localProviderId: String(process.env.OPENCODE_LOCAL_PROVIDER_ID || 'ollama').trim(),
    localModelId: String(process.env.OPENCODE_LOCAL_MODEL_ID || process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1').trim(),
    tentarLocal: String(process.env.OPENCODE_TRY_LOCAL || 'true').toLowerCase() !== 'false',
    zeroCost,
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
    zeroCost: c.zeroCost,
    paidProvidersBloqueados: c.zeroCost,
    ordemGratis: [
      {
        rota: 'ollama-local',
        providerId: c.localProviderId,
        modelId: c.localModelId,
        habilitado: c.tentarLocal,
        temporariamentePulado: Date.now() < localBloqueadoAte,
        ultimoErro: ultimoErroLocal || null,
      },
      {
        rota: 'freellmapi',
        providerId: c.providerId,
        modelId: c.modelId,
        habilitado: true,
      },
    ],
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
      const erro: any = new Error(`Timeout ao consultar o OpenCode depois de ${c.timeoutMs} ms.`)
      erro.status = 504
      throw erro
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

function montarParts(prompt: string, anexos: OpenCodeAnexo[]) {
  const parts: any[] = [{ type: 'text', text: prompt }]
  for (const anexo of anexos) {
    const mediaType = String(anexo.mediaType || '').trim().toLowerCase()
    const dados = String(anexo.dados || '').trim()
    if (!mediaType.startsWith('image/') || !dados) continue
    parts.push({
      type: 'file',
      mediaType,
      filename: String(anexo.nome || 'imagem').slice(0, 180),
      url: `data:${mediaType};base64,${dados}`,
    })
  }
  return parts
}

async function enviarComModelo(
  c: OpenCodeConfig,
  accessToken: string,
  sessionId: string,
  system: string,
  prompt: string,
  anexos: OpenCodeAnexo[],
  providerId: string,
  modelId: string,
) {
  const data = await requisitar(c, accessToken, `/session/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    body: JSON.stringify({
      agent: c.agent,
      model: { providerID: providerId, modelID: modelId },
      system,
      parts: montarParts(prompt, anexos),
    }),
  })

  const resposta = extrairTexto(data)
  if (!resposta) throw new Error('O OpenCode concluiu a requisicao, mas nao retornou texto.')
  return { data, resposta }
}

async function enviar(
  c: OpenCodeConfig,
  accessToken: string,
  sessionId: string,
  system: string,
  prompt: string,
  anexos: OpenCodeAnexo[] = [],
): Promise<{
  data: any
  resposta: string
  rota: 'ollama-local' | 'freellmapi'
  tentativas: Array<{ rota: string; ok: boolean; detalhe?: string }>
}> {
  const tentativas: Array<{ rota: string; ok: boolean; detalhe?: string }> = []

  // Circuit breaker: se o Ollama nao estiver rodando, nao atrasamos todas as chamadas
  // por 5 minutos. Assim o FreeLLMAPI assume imediatamente durante a indisponibilidade local.
  if (c.tentarLocal && Date.now() >= localBloqueadoAte) {
    try {
      const local = await enviarComModelo(
        c,
        accessToken,
        sessionId,
        system,
        prompt,
        anexos,
        c.localProviderId,
        c.localModelId,
      )
      ultimoErroLocal = ''
      tentativas.push({ rota: 'ollama-local', ok: true })
      return { ...local, rota: 'ollama-local', tentativas }
    } catch (e: any) {
      const detalhe = String(e?.message || e || 'Falha no modelo local').slice(0, 300)
      ultimoErroLocal = detalhe
      tentativas.push({ rota: 'ollama-local', ok: false, detalhe })
      // 404 pode significar sessao expirada, nao falta do modelo local.
      if (e?.status !== 404) localBloqueadoAte = Date.now() + 5 * 60 * 1000
      if (e?.status === 404) throw e
    }
  }

  try {
    const remoto = await enviarComModelo(
      c,
      accessToken,
      sessionId,
      system,
      prompt,
      anexos,
      c.providerId,
      c.modelId,
    )
    tentativas.push({ rota: 'freellmapi', ok: true })
    return { ...remoto, rota: 'freellmapi', tentativas }
  } catch (e: any) {
    const detalhe = String(e?.message || e || 'Falha no FreeLLMAPI').slice(0, 300)
    tentativas.push({ rota: 'freellmapi', ok: false, detalhe })
    const combinado = tentativas.map(t => `${t.rota}: ${t.ok ? 'ok' : (t.detalhe || 'falhou')}`).join(' | ')
    const erro: any = new Error(combinado.slice(0, 800))
    erro.status = e?.status
    throw erro
  }
}

export async function consultarOpenCode(params: {
  accessToken: string
  sessionId?: string | null
  tituloSessao: string
  system: string
  prompt: string
  anexos?: OpenCodeAnexo[]
}): Promise<OpenCodeResultado> {
  const c = await carregarConfig()
  let sessionId = String(params.sessionId || '').trim()

  if (!sessionId) {
    sessionId = await criarSessao(c, params.accessToken, params.tituloSessao)
  }

  try {
    const { data, resposta, rota, tentativas } = await enviar(
      c,
      params.accessToken,
      sessionId,
      params.system,
      params.prompt,
      params.anexos || [],
    )
    const padraoProvider = rota === 'ollama-local' ? c.localProviderId : c.providerId
    const padraoModelo = rota === 'ollama-local' ? c.localModelId : c.modelId
    const modelo = extrairModelo(data, padraoProvider, padraoModelo)
    return { sessionId, resposta, ...modelo, rota, custoEstimado: 0, tentativas }
  } catch (e: any) {
    // Sessao antiga pode ter sido limpa/reiniciada no servidor OpenCode.
    if (e?.status !== 404) throw e
    sessionId = await criarSessao(c, params.accessToken, params.tituloSessao)
    const { data, resposta, rota, tentativas } = await enviar(
      c,
      params.accessToken,
      sessionId,
      params.system,
      params.prompt,
      params.anexos || [],
    )
    const padraoProvider = rota === 'ollama-local' ? c.localProviderId : c.providerId
    const padraoModelo = rota === 'ollama-local' ? c.localModelId : c.modelId
    const modelo = extrairModelo(data, padraoProvider, padraoModelo)
    return { sessionId, resposta, ...modelo, rota, custoEstimado: 0, tentativas }
  }
}
