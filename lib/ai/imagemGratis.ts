import { endpointRuntimeGratis } from './runtimeEndpoints'

export async function gerarImagemGratis(prompt: string) {
  const texto = String(prompt || '').trim()
  if (!texto) throw new Error('Descreva a imagem que deseja gerar.')

  const runtime = await endpointRuntimeGratis('image_gateway')
  if (!runtime.baseUrl) {
    throw new Error('Gerador local de imagem ainda não está conectado ao Atlas. Nenhum provedor pago foi acionado.')
  }

  const width = Math.max(256, Math.min(Number(process.env.LOCAL_IMAGE_WIDTH || 1024), 1536))
  const height = Math.max(256, Math.min(Number(process.env.LOCAL_IMAGE_HEIGHT || 1024), 1536))
  const steps = Math.max(8, Math.min(Number(process.env.LOCAL_IMAGE_STEPS || 20), 50))

  const controller = new AbortController()
  const timeoutMs = Math.max(20_000, Number(process.env.LOCAL_IMAGE_TIMEOUT_MS || 180_000))
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // API compatível com Stable Diffusion WebUI / Forge.
    const resposta = await fetch(runtime.baseUrl + '/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      body: JSON.stringify({
        prompt: texto,
        width,
        height,
        steps,
        batch_size: 1,
        n_iter: 1,
      }),
    })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      throw new Error(String(json?.error || json?.detail || 'Falha no gerador local de imagem').slice(0, 500))
    }

    const base64 = Array.isArray(json?.images) ? String(json.images[0] || '') : ''
    if (!base64) throw new Error('O gerador local concluiu sem retornar imagem.')

    return {
      image: base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64,
      provider: 'local-stable-diffusion',
      model: String(process.env.LOCAL_IMAGE_MODEL || 'stable-diffusion-local'),
      width,
      height,
      custoEstimado: 0,
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Timeout no gerador local de imagem.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
