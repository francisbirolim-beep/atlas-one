import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/agente'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { carregarConfigAgente } from '@/lib/ai/agentManager'
import { checarProvider } from '@/lib/ai/healthCheck'

// GET /api/agente/health - checa se o provider do agente atual (do usuario logado)
// esta disponivel, sem gastar uma chamada de IA de verdade.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const usuario = await verificarUsuario(authHeader)
    if (!usuario?.empresa_id) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    let setorIdPrincipal: string | null = null
    const escopo: 'setor' | 'master' = usuario.role === 'master' ? 'master' : 'setor'

    if (escopo === 'setor') {
      const { data: permData } = await supabaseAdmin
        .from('permissoes')
        .select('setor_id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('usuario_id', usuario.id)
      const setorIds = (permData || []).map((p: any) => p.setor_id)
      setorIdPrincipal = setorIds[0] || null
    }

    const configAgente = await carregarConfigAgente(setorIdPrincipal, escopo, usuario.empresa_id)
    const apiKeyPresente = !!process.env.ANTHROPIC_API_KEY
    const resultado = await checarProvider(configAgente.provider, configAgente.modelo, apiKeyPresente)

    return NextResponse.json({
      agente: { nome: configAgente.nome, provider: configAgente.provider, modelo: configAgente.modelo },
      health: resultado,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao checar saude do provider: ' + String(e && e.message ? e.message : e) }, { status: 500 })
  }
}
