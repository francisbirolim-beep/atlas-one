import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'

const MODEL = 'gpt-image-2'
const SIZE = '1024x1024'
const QUALITY = 'low'
// Referência pública da OpenAI para GPT Image 2 low 1024x1024: ~US$ 0,006 de saída.
// Acrescentamos pequena margem para o texto de entrada; o custo real pode variar.
const ESTIMATIVA_USD = 0.007

export async function POST(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await req.json()
    const prompt = String(body.prompt || '').trim()
    const confirmar = body.confirmar === true
    if (!prompt) return NextResponse.json({ error: 'Descreva a imagem que deseja gerar' }, { status: 400 })

    if (!confirmar) {
      return NextResponse.json({
        requiresConfirmation: true,
        estimate: { usd: ESTIMATIVA_USD, model: MODEL, quality: QUALITY, size: SIZE },
      })
    }

    const apiKey = process.env.OPENAI_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'Geracao de imagem ainda nao esta habilitada no servidor (OPENAI_API_KEY ausente).' }, { status: 503 })
    }

    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
    })
    const data = await resp.json()
    if (!resp.ok) return NextResponse.json({ error: data?.error?.message || 'Falha ao gerar imagem' }, { status: resp.status })

    const item = data?.data?.[0]
    const image = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
    if (!image) return NextResponse.json({ error: 'A API nao retornou uma imagem' }, { status: 502 })

    return NextResponse.json({ image, revisedPrompt: item?.revised_prompt || prompt, estimateUsd: ESTIMATIVA_USD })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao gerar imagem: ' + String(e?.message || e) }, { status: 500 })
  }
}
