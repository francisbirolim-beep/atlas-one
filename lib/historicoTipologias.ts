import { supabase } from './supabase'

export type HistoricoFormulaTipologia = {
  id: string
  formula_id: string
  tipologia_id: string
  configuracao_chave: string
  versao: number
  evento: 'criacao' | 'alteracao' | 'substituicao_componente' | 'restauracao' | 'duplicacao'
  snapshot: Record<string, any>
  justificativa?: string | null
  restaurada_de_versao?: number | null
  origem_orcamento_id?: string | null
  origem_item_ref?: string | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
}

export type FormulaHistoricoResumo = {
  id: string
  tipologia_id: string
  configuracao_chave: string
  configuracao_label: string
  status: string
  versao: number
  ativo: boolean
}

export async function listarFormulasHistoricoTipologia(tipologiaId: string): Promise<FormulaHistoricoResumo[]> {
  if (!tipologiaId) return []
  const { data, error } = await supabase
    .from('engenharia_tipologia_formulas_corte')
    .select('id,tipologia_id,configuracao_chave,configuracao_label,status,versao,ativo')
    .eq('tipologia_id', tipologiaId)
    .order('configuracao_label')
  if (error || !data) return []
  return data as FormulaHistoricoResumo[]
}

export async function listarHistoricoFormula(formulaId: string): Promise<HistoricoFormulaTipologia[]> {
  if (!formulaId) return []
  const { data, error } = await supabase
    .from('engenharia_tipologia_formulas_historico')
    .select('*')
    .eq('formula_id', formulaId)
    .order('versao', { ascending: false })
  if (error || !data) return []
  return data as HistoricoFormulaTipologia[]
}

export async function restaurarFormulaTipologia(formulaId: string, versao: number, justificativa: string) {
  const { data, error } = await supabase.rpc('fn_restaurar_formula_tipologia_v1', {
    p_formula_id: formulaId,
    p_versao: versao,
    p_justificativa: justificativa,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, versao: Number(data || 0) }
}

export async function duplicarTipologia(dados: {
  tipologiaId: string
  novoLabel: string
  novaChave?: string | null
  justificativa: string
}) {
  const { data, error } = await supabase.rpc('fn_duplicar_tipologia_v1', {
    p_tipologia_id: dados.tipologiaId,
    p_novo_label: dados.novoLabel,
    p_nova_chave: dados.novaChave || null,
    p_justificativa: dados.justificativa,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, tipologiaId: String(data || '') }
}

export async function substituirComponenteDefinitivo(dados: {
  formulaId: string
  componenteTipo: 'perfil' | 'acessorio'
  codigoOrigem: string
  codigoDestino: string
  justificativa: string
  orcamentoId?: string | null
  itemRef?: string | null
}) {
  const { data, error } = await supabase.rpc('fn_tipologia_substituir_componente_direto_v1', {
    p_formula_id: dados.formulaId,
    p_componente_tipo: dados.componenteTipo,
    p_codigo_origem: dados.codigoOrigem,
    p_codigo_destino: dados.codigoDestino,
    p_justificativa: dados.justificativa,
    p_orcamento_id: dados.orcamentoId || null,
    p_item_ref: dados.itemRef || null,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, versao: Number(data || 0) }
}

export async function registrarOverrideOrcamento(dados: {
  orcamentoId: string
  itemRef: string
  tipologiaId?: string | null
  formulaId?: string | null
  componenteTipo: 'perfil' | 'acessorio' | 'vidro' | 'outro'
  acao: 'adicionar' | 'remover' | 'substituir'
  codigoOrigem?: string | null
  produtoOrigemId?: string | null
  codigoDestino?: string | null
  produtoDestinoId?: string | null
  descricaoDestino?: string | null
  quantidadeOverride?: number | null
  comprimentoOverrideMm?: number | null
  justificativa: string
  criadoPorId?: string | null
  criadoPorNome?: string | null
}) {
  const { data, error } = await supabase.from('orcamento_item_componentes_overrides').insert({
    orcamento_id: dados.orcamentoId,
    item_ref: dados.itemRef,
    tipologia_id: dados.tipologiaId || null,
    formula_id: dados.formulaId || null,
    componente_tipo: dados.componenteTipo,
    acao: dados.acao,
    codigo_origem: dados.codigoOrigem || null,
    produto_origem_id: dados.produtoOrigemId || null,
    codigo_destino: dados.codigoDestino || null,
    produto_destino_id: dados.produtoDestinoId || null,
    descricao_destino: dados.descricaoDestino || null,
    quantidade_override: dados.quantidadeOverride ?? null,
    comprimento_override_mm: dados.comprimentoOverrideMm ?? null,
    escopo: 'orcamento',
    justificativa: dados.justificativa.trim(),
    criado_por_id: dados.criadoPorId || null,
    criado_por_nome: dados.criadoPorNome || null,
  }).select().single()
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, override: data }
}

export async function listarOverridesItem(orcamentoId: string, itemRef?: string) {
  let q = supabase
    .from('orcamento_item_componentes_overrides')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .order('created_at')
  if (itemRef) q = q.eq('item_ref', itemRef)
  const { data } = await q
  return data || []
}
