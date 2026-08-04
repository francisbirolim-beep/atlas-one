// Atlas AI Core - provider Ollama (modelos locais, custo zero)
// Usa a mesma interface do AnthropicProvider (ParametrosChamadaIA -> RespostaProvider),
// traduzindo o formato de mensagens/tools de estilo Anthropic para o formato do Ollama
// e traduzindo a resposta do Ollama de volta para o formato { content: [...] } que o
// restante do sistema (rodarLoop) ja espera. rodarLoop nao precisa saber a diferenca.

import { ParametrosChamadaIA, RespostaProvider } from './anthropic'

function mensagensParaOllama(messages: any[], system: string) {
  const out: any[] = []
  if (system) out.push({ role: 'system', content: system })

  for (const m of messages || []) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
      continue
    }
    if (Array.isArray(m.content)) {
      const textos: string[] = []
      const toolResults: any[] = []
      for (const bloco of m.content) {
        if (!bloco || typeof bloco !== 'object') continue
        if (bloco.type === 'text') {
          textos.push(bloco.text || '')
        } else if (bloco.type === 'tool_use') {
          textos.push('[chamou a ferramenta ' + bloco.name + ']')
        } else if (bloco.type === 'tool_result') {
          const conteudo = typeof bloco.content === 'string' ? bloco.content : JSON.stringify(bloco.content)
          toolResults.push({ role: 'tool', content: conteudo })
        } else if (bloco.type === 'image' || bloco.type === 'document') {
          textos.push('[anexo nao suportado pelo Ollama nesta versao]')
        }
      }
      if (textos.length) out.push({ role: m.role, content: textos.join('\n') })
      out.push(...toolResults)
    }
  }
  return out
}

function ferramentasParaOllama(tools: any[]) {
  return (tools || []).map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }))
}

export async function chamarOllama(params: ParametrosChamadaIA): Promise<RespostaProvider> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '')
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model,
        messages: mensagensParaOllama(params.messages, params.system),
        tools: params.tools && params.tools.length ? ferramentasParaOllama(params.tools) : undefined,
        stream: false,
        options: params.temperatura != null ? { temperature: params.temperatura } : undefined,
      }),
    })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      const errText = await resp.text()
      return { ok: false, status: resp.status, erro: errText.slice(0, 500) }
    }

    const data = await resp.json()
    const blocks: any[] = []
    const msg = data.message || {}

    if (msg.content) blocks.push({ type: 'text', text: msg.content })

    if (Array.isArray(msg.tool_calls)) {
      msg.tool_calls.forEach((tc: any, i: number) => {
        let input: any = {}
        try {
          input = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {})
        } catch {
          input = {}
        }
        blocks.push({ type: 'tool_use', id: 'ollama_tool_' + Date.now() + '_' + i, name: tc.function.name, input })
      })
    }

    return {
      ok: true,
      status: 200,
      data: {
        content: blocks,
        usage: { input_tokens: data.prompt_eval_count ?? null, output_tokens: data.eval_count ?? null },
      },
    }
  } catch (e: any) {
    clearTimeout(timeoutId)
    const erro = e && e.name === 'AbortError'
      ? 'Timeout ao conectar no Ollama (' + timeoutMs + 'ms) - verifique se o Ollama esta rodando em ' + baseUrl
      : String(e && e.message ? e.message : e)
    return { ok: false, erro }
  }
}
