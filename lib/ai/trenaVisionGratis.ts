import { consultarOpenCodePublicFree, type OpenCodeAnexo } from './opencode'

// Nunca usa provedores pagos neste fluxo. Modelo VL gratuito listado na Vercel AI Gateway.
// O token OIDC é fornecido pela Vercel no runtime, sem guardar chaves no navegador.
const GATEWAY_FREE_VISION = 'inclusionai/ling-3.0-flash-vl-free'
const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions'

export type ResultadoTrenaGratis = {
  resposta: string
  providerId: string
  modelId: string
  rota: 'vercel-gateway-free-vision' | 'opencode-public-free'
}

async function tentarGatewayVisao(params: {
  system: string
  prompt: string
  anexos: OpenCodeAnexo[]
}): Promise<ResultadoTrenaGratis | null> {
  const token = String(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY || '').trim()
  if (!token) return null
  const imagem = params.anexos.find(a => a.mediaType.startsWith('image/') && a.dados)
  if (!imagem) return null

  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), 25000)
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controle.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: GATEWAY_FREE_VISION,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: [
            { type: 'text', text: params.prompt },
            { type: 'image_url', image_url: { url: `data:${imagem.mediaType};base64,${imagem.dados}` } },
          ] },
        ],
        max_tokens: 350,
        stream: false,
      }),
    })
    if (!resp.ok) {
      // Não expor credenciais ou resposta da plataforma no navegador.
      console.warn('Leitura trena: gateway gratuito indisponível', resp.status)
      return null
    }
    const dados = await resp.json()
    const resposta = String(dados?.choices?.[0]?.message?.content || '').trim()
    if (!resposta) return null
    return {
      resposta,
      providerId: 'vercel-ai-gateway',
      modelId: GATEWAY_FREE_VISION,
      rota: 'vercel-gateway-free-vision',
    }
  } catch (erro) {
    console.warn('Leitura trena: falha de comunicação com gateway gratuito',
      erro instanceof Error ? erro.name : 'indisponível')
    return null
  } finally {
    clearTimeout(temporizador)
  }
}

export async function consultarTrenaGratisComAlternativa(params: {
  system: string
  prompt: string
  anexos: OpenCodeAnexo[]
}): Promise<ResultadoTrenaGratis> {
  // A prioridade é o endpoint gerenciado, não os túneis efêmeros *.trycloudflare.com.
  const gateway = await tentarGatewayVisao(params)
  if (gateway) return gateway

  try {
    const publico = await consultarOpenCodePublicFree(params)
    if (publico?.resposta?.trim()) return {
      resposta: publico.resposta,
      providerId: 'opencode',
      modelId: publico.modelId,
      rota: 'opencode-public-free',
    }
  } catch (erro) {
    console.warn('Leitura trena: modelo público gratuito indisponível',
      erro instanceof Error ? erro.message.slice(0, 240) : 'indisponível')
  }

  // Importante: não retornar ao OPENCODE_BASE_URL / trycloudflare,
  // nem consumir as chaves dos provedores pagos com custo por imagem.
  throw new Error('Nenhum leitor gratuito de imagem disponível agora.')
}
