import { supabase } from './supabase'
import type { Produto, Usuario } from './tipos'
import type { ComponenteReceita, ReceitaTecnica, TipologiaComReceita } from './engenhariaReceitas'

export type VariaveisPlanoCorte = {
  linha?: string
  folhas?: string
  montagem?: string
  trilho?: string
  contramarco?: string
  arremate?: string
  fechadura?: string
  puxador?: string
  mao_amiga?: string
  travessas?: string
  roldana?: string
  [chave: string]: string | number | boolean | null | undefined
}

export type PlanoCorte = {
  id: string
  produto_id?: string | null
  tipologia_id?: string | null
  receita_id?: string | null
  nome: string
  largura_mm?: number | null
  altura_mm?: number | null
  quantidade: number
  folga_largura_mm: number
  folga_altura_mm: number
  variaveis: VariaveisPlanoCorte
  observacoes?: string | null
  status: 'rascunho' | 'liberado'
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
}

export type ComponentePlanoCorte = {
  id: string
  plano_id: string
  receita_componente_id?: string | null
  tipo: string
  produto_id?: string | null
  nome: string
  unidade: string
  quantidade: number
  corte_mm?: number | null
  formula_quantidade?: string | null
  formula_corte?: string | null
  observacao?: string | null
  ordem: number
}

export async function listarProdutosEsquadria(): Promise<Produto[]> {
  const { data } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .eq('categoria', 'porta_janela_padrao')
    .order('nome')
  return (data || []) as Produto[]
}

export async function listarPlanosCorte(limite = 30): Promise<PlanoCorte[]> {
  const { data } = await supabase
    .from('planos_corte')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)
  return (data || []) as PlanoCorte[]
}

export async function criarPlanoCorte(dados: {
  produto: Produto
  tipologia: TipologiaComReceita
  receita: ReceitaTecnica
  componentesReceita: ComponenteReceita[]
  largura_mm: number | null
  altura_mm: number | null
  quantidade: number
  folga_largura_mm: number
  folga_altura_mm: number
  variaveis: VariaveisPlanoCorte
  observacoes?: string | null
  usuario: Usuario | null
}): Promise<PlanoCorte | null> {
  const { data: plano, error } = await supabase.from('planos_corte').insert({
    produto_id: dados.produto.id,
    tipologia_id: dados.tipologia.id,
    receita_id: dados.receita.id,
    nome: dados.produto.nome,
    largura_mm: dados.largura_mm,
    altura_mm: dados.altura_mm,
    quantidade: dados.quantidade,
    folga_largura_mm: dados.folga_largura_mm,
    folga_altura_mm: dados.folga_altura_mm,
    variaveis: dados.variaveis,
    observacoes: dados.observacoes || null,
    criado_por_id: dados.usuario?.id || null,
    criado_por_nome: dados.usuario?.nome || null,
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error || !plano) {
    console.error('Erro ao criar plano de corte:', error)
    return null
  }

  if (dados.componentesReceita.length > 0) {
    const linhas = dados.componentesReceita.map((componente, indice) => ({
      plano_id: plano.id,
      receita_componente_id: componente.id,
      tipo: componente.tipo,
      produto_id: componente.produto_id || null,
      nome: componente.nome,
      unidade: componente.unidade,
      quantidade: Number(componente.quantidade_base || 0) * Math.max(1, dados.quantidade),
      corte_mm: null,
      formula_quantidade: componente.formula_quantidade || null,
      formula_corte: componente.formula_corte || null,
      observacao: componente.observacao || null,
      ordem: componente.ordem ?? indice,
    }))
    const { error: erroComponentes } = await supabase.from('plano_corte_componentes').insert(linhas)
    if (erroComponentes) console.error('Erro ao copiar componentes do plano de corte:', erroComponentes)
  }

  return plano as PlanoCorte
}

export async function carregarComponentesPlano(planoId: string): Promise<ComponentePlanoCorte[]> {
  const { data } = await supabase
    .from('plano_corte_componentes')
    .select('*')
    .eq('plano_id', planoId)
    .order('ordem')
  return (data || []) as ComponentePlanoCorte[]
}

export async function atualizarPlanoCorte(planoId: string, dados: Partial<Pick<PlanoCorte,
  'largura_mm' | 'altura_mm' | 'quantidade' | 'folga_largura_mm' | 'folga_altura_mm' | 'variaveis' | 'observacoes' | 'status'
>>): Promise<boolean> {
  const { error } = await supabase.from('planos_corte').update({
    ...dados,
    updated_at: new Date().toISOString(),
  }).eq('id', planoId)
  return !error
}

export async function atualizarComponentePlano(
  id: string,
  dados: Partial<Pick<ComponentePlanoCorte, 'produto_id' | 'nome' | 'unidade' | 'quantidade' | 'corte_mm' | 'formula_quantidade' | 'formula_corte' | 'observacao'>>
): Promise<boolean> {
  const { error } = await supabase.from('plano_corte_componentes').update({
    ...dados,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  return !error
}
