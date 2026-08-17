import { supabase } from './supabase'
import type { Produto, Tipologia, Usuario } from './tipos'

export type TipoComponenteReceita = 'perfil' | 'acessorio' | 'vidro' | 'reforco' | 'outro'

export type ReceitaTecnica = {
  id: string
  tipologia_id: string
  produto_id?: string | null
  nome: string
  versao: number
  ativo: boolean
  observacoes?: string | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
}

export type ComponenteReceita = {
  id: string
  receita_id: string
  tipo: TipoComponenteReceita
  produto_id?: string | null
  nome: string
  unidade: string
  quantidade_base: number
  formula_quantidade?: string | null
  formula_corte?: string | null
  observacao?: string | null
  ordem: number
  created_at: string
  updated_at: string
}

export type TipologiaComReceita = Tipologia & { receita: ReceitaTecnica | null }

// A tela de receitas por tipologia continua usando somente a receita generica
// (produto_id nulo/ausente). Receitas especificas de produto nao podem
// sobrescrever o fallback da tipologia no mapa.
export async function listarTipologiasComReceita(): Promise<TipologiaComReceita[]> {
  const [{ data: tipologias }, { data: receitas }] = await Promise.all([
    supabase.from('tipologias').select('*').order('ordem', { ascending: true }),
    supabase.from('engenharia_receitas').select('*').eq('ativo', true),
  ])
  const mapa = new Map<string, ReceitaTecnica>()
  ;((receitas || []) as ReceitaTecnica[])
    .filter(r => !r.produto_id)
    .forEach(r => mapa.set(r.tipologia_id, r))
  return ((tipologias || []) as Tipologia[]).map(t => ({ ...t, receita: mapa.get(t.id) || null }))
}

export async function criarReceitaParaTipologia(tipologia: Tipologia, usuario: Usuario | null): Promise<ReceitaTecnica | null> {
  // Nao envia produto_id aqui para manter compatibilidade mesmo antes da
  // migration de receitas por produto. Depois da migration, o default NULL
  // representa a receita generica/fallback da tipologia.
  const { data, error } = await supabase.from('engenharia_receitas').insert({
    tipologia_id: tipologia.id,
    nome: `Receita ${tipologia.label}`,
    versao: 1,
    ativo: true,
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  }).select().single()
  if (error) {
    console.error('Erro ao criar receita técnica:', error)
    return null
  }
  return data as ReceitaTecnica
}

// Receita especifica do produto tem prioridade operacional no Plano de Corte.
// Se a migration de produto ainda nao estiver aplicada, a consulta falha de
// forma controlada e o chamador pode continuar usando a receita generica.
export async function buscarReceitaAtivaProduto(produtoId: string): Promise<ReceitaTecnica | null> {
  const { data, error } = await supabase
    .from('engenharia_receitas')
    .select('*')
    .eq('produto_id', produtoId)
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('Receita por produto ainda indisponível:', error.message)
    return null
  }
  return (data as ReceitaTecnica | null) || null
}

export async function criarReceitaParaProduto(
  produto: Produto,
  tipologia: Tipologia,
  usuario: Usuario | null
): Promise<ReceitaTecnica | null> {
  const { data, error } = await supabase.from('engenharia_receitas').insert({
    tipologia_id: tipologia.id,
    produto_id: produto.id,
    nome: `Receita ${produto.nome}`,
    versao: 1,
    ativo: true,
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  }).select().single()

  if (error) {
    console.error('Erro ao criar receita técnica do produto:', error)
    return null
  }
  return data as ReceitaTecnica
}

export async function listarComponentesReceita(receitaId: string): Promise<ComponenteReceita[]> {
  const { data, error } = await supabase.from('engenharia_receita_componentes').select('*').eq('receita_id', receitaId).order('ordem').order('created_at')
  if (error) return []
  return (data || []) as ComponenteReceita[]
}

export async function listarProdutosTecnicos(): Promise<Produto[]> {
  const { data } = await supabase.from('produtos').select('*').eq('ativo', true).in('categoria', ['perfil','acessorio','outro']).not('unidade', 'is', null).neq('unidade', '').order('categoria').order('nome')
  return (data || []) as Produto[]
}

export async function adicionarComponente(receitaId: string, dados: {
  tipo: TipoComponenteReceita
  produto_id?: string | null
  nome: string
  unidade: string
  quantidade_base: number
  formula_quantidade?: string | null
  formula_corte?: string | null
  observacao?: string | null
}): Promise<ComponenteReceita | null> {
  const { data: ultimo } = await supabase.from('engenharia_receita_componentes').select('ordem').eq('receita_id', receitaId).order('ordem', { ascending: false }).limit(1)
  const ordem = ((ultimo?.[0]?.ordem as number | undefined) ?? -1) + 1
  const { data, error } = await supabase.from('engenharia_receita_componentes').insert({ ...dados, receita_id: receitaId, ordem }).select().single()
  if (error) return null
  return data as ComponenteReceita
}

export async function excluirComponente(id: string): Promise<boolean> {
  const { error } = await supabase.from('engenharia_receita_componentes').delete().eq('id', id)
  return !error
}
