import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'

const MAX_AUDIO_BYTES = 20 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const tokenAutomacao = req.headers.get('x-atlas-automation-token') || ''
    const tokenEsperado = process.env.ATLAS_AUTOMATION_TOKEN || ''
    const autorizadoAutomacao = Boolean(tokenEsperado && tokenAutomacao === tokenEsperado)
    if (!autorizadoAutomacao) {
      const authHeader = req.headers.get('authorization') || ''
      const usuario = await verificarUsuario(authHeader)
      if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'Transcricao de audio nao configurada' }, { status: 503 })
    }

    const entrada = await req.formData()
    const arquivo = entrada.get('audio')
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Audio nao enviado' }, { status: 400 })
    }

    if (!arquivo.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Arquivo enviado nao e um audio valido' }, { status: 400 })
    }
    if (arquivo.size === 0 || arquivo.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio vazio ou maior que 20 MB' }, { status: 400 })
    }

    const form = new FormData()
    form.append('file', arquivo, arquivo.name || 'audio.webm')
    form.append('model', 'gpt-transcribe')
    form.append('language', 'pt')

    const resposta = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      const detalhe = json?.error?.message || 'Falha ao transcrever o audio'
      return NextResponse.json({ error: detalhe }, { status: 502 })
    }

    const texto = String(json?.text || '').trim()
    if (!texto) return NextResponse.json({ error: 'Nao foi possivel entender o audio' }, { status: 422 })

    return NextResponse.json({ text: texto })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Erro ao processar audio: ' + String(e?.message || e) },
      { status: 500 },
    )
  }
}