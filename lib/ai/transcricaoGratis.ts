import { endpointRuntimeGratis } from './runtimeEndpoints'

const MAX_AUDIO_BYTES = 20 * 1024 * 1024

export async function transcreverAudioGratis(arquivo: File) {
  if (!arquivo.type.startsWith('audio/')) throw new Error('Arquivo enviado não é um áudio válido.')
  if (arquivo.size === 0 || arquivo.size > MAX_AUDIO_BYTES) throw new Error('Áudio vazio ou maior que 20 MB.')

  const runtime = await endpointRuntimeGratis('whisper_gateway')
  if (!runtime.baseUrl) {
    throw new Error('Whisper local ainda não está conectado ao Atlas. Nenhum provedor pago foi acionado.')
  }

  const form = new FormData()
  form.append('file', arquivo, arquivo.name || 'audio.webm')
  form.append('model', String(process.env.WHISPER_MODEL || 'whisper-1'))
  form.append('language', 'pt')

  const controller = new AbortController()
  const timeoutMs = Math.max(10_000, Number(process.env.WHISPER_TIMEOUT_MS || 120_000))
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resposta = await fetch(runtime.baseUrl + '/v1/audio/transcriptions', {
      method: 'POST',
      body: form,
      signal: controller.signal,
      cache: 'no-store',
    })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      throw new Error(String(json?.error?.message || json?.error || 'Falha no Whisper local').slice(0, 500))
    }
    const texto = String(json?.text || '').trim()
    if (!texto) throw new Error('O Whisper local não retornou transcrição.')
    return {
      text: texto,
      provider: 'local-whisper',
      model: String(process.env.WHISPER_MODEL || 'whisper-1'),
      custoEstimado: 0,
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Timeout no Whisper local.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
