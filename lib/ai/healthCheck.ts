// Atlas AI Core - health check dos providers de IA
// Usado antes/independente de uma chamada real, para a UI poder mostrar se o
// provider configurado esta disponivel sem gastar uma chamada de verdade.

export type StatusProvider =
  | 'disponivel'
  | 'indisponivel'
  | 'nao_configurado'
  | 'erro_autenticacao'
  | 'modelo_inexistente'

export interface ResultadoHealthCheck {
  provider: string
  status: StatusProvider
  detalhe?: string
}

export async function checarOllama(modelo?: string): Promise<ResultadoHealthCheck> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const resp = await fetch(baseUrl + '/api/tags', { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      return { provider: 'ollama', status: 'indisponivel', detalhe: 'HTTP ' + resp.status }
    }

    const data = await resp.json()
    const nomes: string[] = (data.models || []).map((m: any) => m.name)

    if (modelo && nomes.length && !nomes.some((n) => n === modelo || n.startsWith(modelo + ':'))) {
      return { provider: 'ollama', status: 'modelo_inexistente', detalhe: 'Modelo "' + modelo + '" nao encontrado no Ollama local (rode: ollama pull ' + modelo + ')' }
    }

    return { provider: 'ollama', status: 'disponivel' }
  } catch (e: any) {
    clearTimeout(timeoutId)
    return { provider: 'ollama', status: 'indisponivel', detalhe: String(e && e.message ? e.message : e) }
  }
}

export async function checarAnthropic(apiKeyPresente: boolean): Promise<ResultadoHealthCheck> {
  if (!apiKeyPresente) return { provider: 'anthropic', status: 'nao_configurado' }
  return { provider: 'anthropic', status: 'disponivel' }
}

export async function checarProvider(provider: string, modelo?: string, apiKeyPresente?: boolean): Promise<ResultadoHealthCheck> {
  if (provider === 'ollama') return checarOllama(modelo)
  if (provider === 'anthropic') return checarAnthropic(!!apiKeyPresente)
  return { provider, status: 'nao_configurado', detalhe: 'Provider ainda nao implementado no Atlas AI Core' }
}
