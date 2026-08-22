import { supabase } from '@/lib/supabase'
import { listarLinhasTecnicas } from '@/lib/linhasTecnicas'
import type { PecaFormula, TipologiaFormulasCorte, VariavelTipologia } from '@/lib/formulasCorteEngine'

export type StatusFormulaCorte = 'em_desenvolvimento' | 'em_validacao' | 'validada'
export type StatusFormulaAcessorio = 'referencia' | 'em_validacao' | 'validada'

export type VidroFormulaCorte = {
  formula_largura?: string
  formula_altura?: string
  quantidade?: number
  arredondamento?: string
  composicao_largura?: string
  composicao_altura?: string
}

export type AcessorioFormulaCorte = {
  codigo: string
  descricao?: string
  cor?: string
  unidade?: string
  formula_quantidade?: string
  quantidade_referencia?: number
  status?: StatusFormulaAcessorio
  composicao_calculo?: string
  fonte?: string
}

type TipologiaFormula = { id: string; label: string; chave: string; ativo: boolean }

export type RegistroFormulaCorte = TipologiaFormulasCorte & {
  id: string
  ativo: boolean
  configuracao_chave: string
  configuracao_label: string
  status: StatusFormulaCorte
  versao: number
  observacoes?: string | null
  vidro: VidroFormulaCorte
  acessorios: AcessorioFormulaCorte[]
  tipologia?: TipologiaFormula | null
}

type FormulaBanco = {
  id: string
  tipologia_id: string
  variaveis: unknown
  pecas: unknown
  ativo: boolean
  configuracao_chave?: string | null
  configuracao_label?: string | null
  status?: string | null
  versao?: number | null
  observacoes?: string | null
  vidro?: unknown
  acessorios?: unknown
  tipologia?: TipologiaFormula | TipologiaFormula[] | null
}

function normalizar(item: FormulaBanco): RegistroFormulaCorte {
  const tipologiaBase = Array.isArray(item.tipologia) ? item.tipologia[0] || null : item.tipologia || null
  const configuracaoLabel = item.configuracao_label || 'Padrão'
  const tipologia = tipologiaBase
    ? { ...tipologiaBase, label: `${tipologiaBase.label} — ${configuracaoLabel}` }
    : null

  return {
    id: item.id,
    tipologia_id: item.tipologia_id,
    variaveis: Array.isArray(item.variaveis) ? item.variaveis as VariavelTipologia[] : [],
    pecas: Array.isArray(item.pecas) ? item.pecas as PecaFormula[] : [],
    ativo: Boolean(item.ativo),
    configuracao_chave: item.configuracao_chave || 'padrao',
    configuracao_label: configuracaoLabel,
    status: (item.status || 'em_desenvolvimento') as StatusFormulaCorte,
    versao: Number(item.versao || 1),
    observacoes: item.observacoes || null,
    vidro: item.vidro && typeof item.vidro === 'object' && !Array.isArray(item.vidro)
      ? item.vidro as VidroFormulaCorte
      : {},
    acessorios: Array.isArray(item.acessorios) ? item.acessorios as AcessorioFormulaCorte[] : [],
    tipologia,
  }
}

const CAMPOS = 'id, tipologia_id, variaveis, pecas, ativo, configuracao_chave, configuracao_label, status, versao, observacoes, vidro, acessorios, tipologia:tipologias(id,label,chave,ativo)'

export async function listarFormulasCorteAtivas(): Promise<RegistroFormulaCorte[]> {
  const [formulasResp, linhas] = await Promise.all([
    supabase
      .from('engenharia_tipologia_formulas_corte')
      .select(CAMPOS)
      .eq('ativo', true)
      .order('created_at', { ascending: true }),
    listarLinhasTecnicas(),
  ])

  const { data, error } = formulasResp
  if (error) {
    console.error('Erro ao listar formulas de corte:', error)
    return []
  }

  const tipologiasEmLinhasAtivas = new Set(
    linhas
      .filter(linha => linha.ativo)
      .flatMap(linha => linha.tipologia_ids || [])
  )

  return ((data || []) as unknown as FormulaBanco[])
    .map(normalizar)
    .filter(item => item.tipologia?.ativo !== false && tipologiasEmLinhasAtivas.has(item.tipologia_id))
}

export async function listarTodasFormulasCorte(): Promise<RegistroFormulaCorte[]> {
  const { data, error } = await supabase
    .from('engenharia_tipologia_formulas_corte')
    .select(CAMPOS)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao listar editor de formulas:', error)
    return []
  }

  return ((data || []) as unknown as FormulaBanco[]).map(normalizar)
}

export async function salvarFormulaCorte(
  id: string,
  dados: {
    configuracao_label: string
    variaveis: VariavelTipologia[]
    pecas: PecaFormula[]
    vidro: VidroFormulaCorte
    acessorios?: AcessorioFormulaCorte[]
    status: StatusFormulaCorte
    ativo: boolean
    observacoes?: string | null
  }
): Promise<RegistroFormulaCorte | null> {
  const ativoSeguro = dados.status === 'validada' ? dados.ativo : false
  const atualizacao: Record<string, unknown> = {
    configuracao_label: dados.configuracao_label.trim() || 'Padrão',
    variaveis: dados.variaveis,
    pecas: dados.pecas,
    vidro: dados.vidro,
    status: dados.status,
    ativo: ativoSeguro,
    observacoes: dados.observacoes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (dados.acessorios !== undefined) atualizacao.acessorios = dados.acessorios

  const { data, error } = await supabase
    .from('engenharia_tipologia_formulas_corte')
    .update(atualizacao)
    .eq('id', id)
    .select(CAMPOS)
    .single()

  if (error) {
    console.error('Erro ao salvar formula de corte:', error)
    return null
  }
  return normalizar(data as unknown as FormulaBanco)
}
