import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'
import { transcreverAudioGratis } from '@/lib/ai/transcricaoGratis'

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

    const entrada = await req.formData()
    const arquivo = entrada.get('audio')
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Audio nao enviado' }, { status: 400 })
    }

    const resultado = await transcreverAudioGratis(arquivo)
    return NextResponse.json({
      text: resultado.text,
      provider: resultado.provider,
      model: resultado.model,
      custoEstimado: 0,
      paidFallbackUsed: false,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: String(e?.message || 'Erro ao processar audio'),
        custoEstimado: 0,
        paidFallbackUsed: false,
      },
      { status: 503 },
    )
  }
}
