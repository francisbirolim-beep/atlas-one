import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'
import { statusOpenCode } from '@/lib/ai/opencode'
import { statusRuntimesGratis } from '@/lib/ai/runtimeEndpoints'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const [openCode, runtimes] = await Promise.all([
      statusOpenCode(),
      statusRuntimesGratis(),
    ])

    return NextResponse.json({
      politica: 'zero_cost',
      custoVariavelAlvo: 0,
      paidProvidersBloqueados: runtimes.paidProvidersBloqueados,
      ordem: openCode.ordemGratis,
      openCode: {
        configurado: openCode.configurado,
        agent: openCode.agent,
        providerFallback: openCode.providerId,
        modeloFallback: openCode.modelId,
      },
      runtimes: runtimes.runtimes,
      mensagem: openCode.configurado
        ? 'IA gratuita configurada. Ordem: Ollama local -> FreeLLMAPI -> fallback interno.'
        : 'Gateway gratuito OpenCode ainda não está conectado.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao checar a IA gratuita: ' + String(e?.message || e) }, { status: 500 })
  }
}
