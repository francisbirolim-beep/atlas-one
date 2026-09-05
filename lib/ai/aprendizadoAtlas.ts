import { tokenAtual } from '@/lib/auth'

export type DominioAprendizadoAtlas =
  | 'linha_tecnica'
  | 'perfil'
  | 'acessorio'
  | 'vidro'
  | 'tipologia'
  | 'configuracao_tecnica'
  | 'medidas'
  | 'folgas'
  | 'formulacao'
  | 'corte'
  | 'orcamento'
  | 'medicao'
  | 'fornecedor'
  | 'compras'
  | 'estoque'
  | 'engenharia'
  | 'producao'
  | 'assistencia'
  | 'geral'

export type NivelEvidenciaAtlas = 'observado' | 'recorrente' | 'validado'

export type EventoAprendizadoAtlas = {
  dominio: DominioAprendizadoAtlas | string
  tipo: string
  entidade_tipo?: string | null
  entidade_id?: string | null
  contexto?: Record<string, unknown>
  dados?: Record<string, unknown>
  evidencia?: NivelEvidenciaAtlas
}

export type SugestaoAprendizadoAtlas = {
  assinatura: string
  ocorrencias: number
  evidencia: NivelEvidenciaAtlas
  tipo: string
  contexto: Record<string, unknown>
  dados: Record<string, unknown>
  ultimo_em: string | null
}

export type ConfiguracaoTecnicaAtlas = {
  linha_id?: string | null
  linha_nome?: string | null
  tipologia_id?: string | null
  tipologia_nome?: string | null
  largura_mm?: number | null
  altura_mm?: number | null
  quantidade?: number | null
  folhas?: string | number | null
  cor?: string | null
  vidro?: string | null
  contramarco?: string | null
  trilho?: string | null
  puxador?: string | null
  fechadura?: string | null
  roldana?: string | null
  reforco?: string | null
  mao_de_amigo?: string | null
  folga_largura_mm?: number | null
  folga_altura_mm?: number | null
  perfis?: Array<string | { id?: string; codigo?: string; quantidade?: number; corte_mm?: number }>
  acessorios?: Array<string | { id?: string; codigo?: string; quantidade?: number }>
  vidros?: Array<string | { id?: string; descricao?: string; largura_mm?: number; altura_mm?: number; quantidade?: number }>
  variaveis?: Record<string, unknown>
  formulacao?: Record<string, unknown>
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

export async function registrarConfiguracaoTecnicaAtlas(params: {
  tipo: string
  configuracao: ConfiguracaoTecnicaAtlas
  entidade_tipo?: string
  entidade_id?: string | null
  evidencia?: NivelEvidenciaAtlas
}) {
  const c = params.configuracao
  const contexto = {
    linha_id: c.linha_id || null,
    linha_nome: c.linha_nome || null,
    tipologia_id: c.tipologia_id || null,
    tipologia_nome: c.tipologia_nome || null,
    folhas: c.folhas ?? null,
  }

  return registrarEventoAprendizadoAtlas({
    dominio: 'configuracao_tecnica',
    tipo: params.tipo,
    entidade_tipo: params.entidade_tipo || 'configuracao_tecnica',
    entidade_id: params.entidade_id || null,
    contexto,
    dados: {
      largura_mm: c.largura_mm ?? null,
      altura_mm: c.altura_mm ?? null,
      quantidade: c.quantidade ?? null,
      cor: c.cor || null,
      vidro: c.vidro || null,
      contramarco: c.contramarco || null,
      trilho: c.trilho || null,
      puxador: c.puxador || null,
      fechadura: c.fechadura || null,
      roldana: c.roldana || null,
      reforco: c.reforco || null,
      mao_de_amigo: c.mao_de_amigo || null,
      folga_largura_mm: c.folga_largura_mm ?? null,
      folga_altura_mm: c.folga_altura_mm ?? null,
      perfis: c.perfis || [],
      acessorios: c.acessorios || [],
      vidros: c.vidros || [],
      variaveis: c.variaveis || {},
      formulacao: c.formulacao || {},
    },
    evidencia: params.evidencia || 'observado',
  })
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
