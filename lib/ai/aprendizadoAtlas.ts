import { tokenAtual } from '@/lib/auth'

export type DominioAprendizadoAtlas =
  | 'linha_tecnica'
  | 'tipologia'
  | 'orcamento'
  | 'medicao'
  | 'fornecedor'
  | 'compras'
  | 'estoque'
  | 'engenharia'
  | 'producao'
  | 'assistencia'
  | 'geral'

export type EventoAprendizadoAtlas = {
  dominio: DominioAprendizadoAtlas | string
  tipo: string
  entidade_tipo?: string | null
  entidade_id?: string | null
  contexto?: Record<string, unknown>
  dados?: Record<string, unknown>
  evidencia?: 'observado' | 'recorrente' | 'validado'
}

export type SugestaoAprendizadoAtlas = {
  assinatura: string
  ocorrencias: number
  evidencia: 'observado' | 'recorrente' | 'validado'
  tipo: string
  contexto: Record<string, unknown>
  dados: Record<string, unknown>
  ultimo_em: string | null
}

export async function registrarEventoAprendizadoAtlas(evento: EventoAprendizadoAtlas) {
  try {
    const token = await tokenAtual()
    if (!token) return { ok: false, error: 'sem_sessao' }

    const resposta = await fetch('/api/ia/aprendizado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(evento),
    })

    if (!resposta.ok) return { ok: false, error: 'falha_registro' }
    return await resposta.json()
  } catch {
    // O aprendizado nunca deve bloquear o fluxo principal do Atlas.
    return { ok: false, error: 'indisponivel' }
  }
}

export async function buscarSugestoesAprendizadoAtlas(params: {
  dominio: DominioAprendizadoAtlas | string
  tipo?: string
  contexto?: Record<string, unknown>
  limite?: number
}): Promise<SugestaoAprendizadoAtlas[]> {
  try {
    const token = await tokenAtual()
    if (!token) return []

    const query = new URLSearchParams({ dominio: params.dominio })
    if (params.tipo) query.set('tipo', params.tipo)
    if (params.contexto && Object.keys(params.contexto).length) {
      query.set('contexto', JSON.stringify(params.contexto))
    }
    if (params.limite) query.set('limite', String(params.limite))

    const resposta = await fetch(`/api/ia/aprendizado?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!resposta.ok) return []
    const json = await resposta.json().catch(() => ({}))
    return Array.isArray(json?.sugestoes) ? json.sugestoes : []
  } catch {
    return []
  }
}

export async function registrarFeedbackSugestaoAtlas(params: {
  dominio: DominioAprendizadoAtlas | string
  assinatura: string
  aceitou: boolean
  contexto?: Record<string, unknown>
}) {
  return registrarEventoAprendizadoAtlas({
    dominio: params.dominio,
    tipo: params.aceitou ? 'sugestao_aceita' : 'sugestao_rejeitada',
    contexto: params.contexto || {},
    dados: { assinatura: params.assinatura },
    evidencia: 'observado',
  })
}
