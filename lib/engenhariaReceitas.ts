import { supabase } from './supabase'
import type { Produto, Tipologia, Usuario } from './tipos'

export type TipoComponenteReceita = 'perfil' | 'acessorio' | 'vidro' | 'reforco' | 'outro'

export type ReceitaTecnica = {
  id: string
  tipologia_id: string
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

export async function listarTipologiasComReceita(): Promise<TipologiaComReceita[]> {
  const [{ data: tipologias }, { data: receitas }] = await Promise.all([
    supabase.from('tipologias').select('*').order('ordem', { ascending: true }),
    supabase.from('engenharia_receitas').select('*').eq('ativo', true),
  ])
  const mapa = new Map<string, ReceitaTecnica>()
  ;((receitas || []) as ReceitaTecnica[]).forEach(r => mapa.set(r.tipologia_id, r))
  return ((tipologias || []) as Tipologia[]).map(t => ({ ...t, receita: mapa.get(t.id) || null }))
}

export async function criarReceitaParaTipologia(tipologia: Tipologia, usuario: Usuario | null): Promise<ReceitaTecnica | null> {
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

export async function listarComponentesReceita(receitaId: string): Promise<ComponenteReceita[]> {
  const { data, error } = await supabase.from('engenharia_receita_componentes').select('*').eq('receita_id', receitaId).order('ordem').order('created_at')
  if (error) return []
  return (data || []) as ComponenteReceita[]
}

export async function listarProdutosTecnicos(): Promise<Produto[]> {
  const { data } = await supabase.from('produtos').select('*').eq('ativo', true).in('categoria', ['perfil','acessorio','outro']).order('categoria').order('nome')
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
