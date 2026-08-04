// Atlas AI Core - provider Anthropic (Claude)
// Encapsula a chamada real que antes ficava direto dentro de lib/agente.ts

export interface RespostaProvider {
  ok: boolean
  status?: number
  data?: any
  erro?: string
}

export interface ParametrosChamadaIA {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  messages: any[]
  tools: any[]
  temperatura?: number
}

export async function chamarAnthropic(params: ParametrosChamadaIA): Promise<RespostaProvider> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      ...(params.temperatura != null ? { temperature: params.temperatura } : {}),
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    return { ok: false, status: resp.status, erro: errText.slice(0, 500) }
  }

  const data = await resp.json()
  return { ok: true, status: resp.status, data }
}
