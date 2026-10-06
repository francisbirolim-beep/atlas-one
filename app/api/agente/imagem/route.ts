import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'
import { gerarImagemGratis } from '@/lib/ai/imagemGratis'
import { endpointRuntimeGratis } from '@/lib/ai/runtimeEndpoints'

const SIZE = '1024x1024'

export async function POST(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await req.json()
    const prompt = String(body.prompt || '').trim()
    const confirmar = body.confirmar === true
    if (!prompt) return NextResponse.json({ error: 'Descreva a imagem que deseja gerar' }, { status: 400 })

    if (!confirmar) {
      const runtime = await endpointRuntimeGratis('image_gateway')
      return NextResponse.json({
        requiresConfirmation: true,
        estimate: {
          usd: 0,
          model: process.env.LOCAL_IMAGE_MODEL || 'stable-diffusion-local',
          quality: 'local',
          size: SIZE,
          provider: 'local-stable-diffusion',
          configurado: Boolean(runtime.baseUrl),
        },
        paidFallbackUsed: false,
      })
    }

    const resultado = await gerarImagemGratis(prompt)
    return NextResponse.json({
      image: resultado.image,
      revisedPrompt: prompt,
      estimateUsd: 0,
      provider: resultado.provider,
      model: resultado.model,
      paidFallbackUsed: false,
    })
  } catch (e: any) {
    return NextResponse.json({
      error: 'Erro ao gerar imagem sem custo: ' + String(e?.message || e),
      estimateUsd: 0,
      paidFallbackUsed: false,
    }, { status: 503 })
  }
}
