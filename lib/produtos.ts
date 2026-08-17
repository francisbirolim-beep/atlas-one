import { supabase } from './supabase'
import { Produto, CategoriaProduto } from './tipos'

export const CATEGORIAS_PRODUTO: { valor: CategoriaProduto; label: string }[] = [
  { valor: 'porta_janela_padrao', label: 'Porta/Janela padrão' },
  { valor: 'perfil', label: 'Perfil' },
  { valor: 'pu', label: 'PU' },
  { valor: 'acessorio', label: 'Acessório' },
  { valor: 'outro', label: 'Outro' },
]

export function labelCategoriaProduto(categoria: CategoriaProduto): string {
  return CATEGORIAS_PRODUTO.find(c => c.valor === categoria)?.label || categoria
}

export async function listarProdutos(somenteAtivos = false): Promise<Produto[]> {
  let query = supabase.from('produtos').select('*').order('categoria').order('nome')
  if (somenteAtivos) query = query.eq('ativo', true)
  const { data } = await query
  return (data as Produto[]) || []
}

export async function criarProduto(dados: {
  nome: string
  categoria: CategoriaProduto
  preco: number
  unidade: string
  largura_mm?: number | null
  altura_mm?: number | null
  descricao?: string | null
  foto_url?: string | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
  custo?: number | null
  margem_percentual?: number | null
  grupo?: string | null
  peso_kg?: number | null
  marca?: string | null
  fornecedor_id?: string | null
  linha_id?: string | null
  cor_id?: string | null
  ncm?: string | null
  icms_percentual?: number | null
  ipi_percentual?: number | null
  pis_percentual?: number | null
  cofins_percentual?: number | null
  codigo?: string | null
  codigo_origem?: string | null
  origem?: string | null
  id_externo_wvetro?: string | null
  peso_kg_m?: number | null
  tamanho_barra_mm?: number | null
  tamanho_barra_mm_origem?: number | null
  dados_origem?: Record<string, any> | null
  status_validacao?: string | null
  ncm_origem?: string | null
  ncm_status?: string | null
}) {
  return supabase.from('produtos').insert({ ...dados, ativo: true })
}

export async function atualizarProduto(
  id: string,
  dados: Partial<{
    nome: string
    categoria: CategoriaProduto
    preco: number
    unidade: string
    largura_mm: number | null
    altura_mm: number | null
    descricao: string | null
    foto_url: string | null
    ativo: boolean
    custo: number | null
    margem_percentual: number | null
    grupo: string | null
    peso_kg: number | null
    marca: string | null
    fornecedor_id: string | null
    linha_id: string | null
    cor_id: string | null
    ncm: string | null
    icms_percentual: number | null
    ipi_percentual: number | null
    pis_percentual: number | null
    cofins_percentual: number | null
    codigo: string | null
    codigo_origem: string | null
    origem: string | null
    id_externo_wvetro: string | null
    peso_kg_m: number | null
    tamanho_barra_mm: number | null
    tamanho_barra_mm_origem: number | null
    dados_origem: Record<string, any> | null
    status_validacao: string | null
    validado_em: string | null
    validado_por_id: string | null
    validado_por_nome: string | null
    observacao_validacao: string | null
    ncm_origem: string | null
    ncm_status: string | null
  }>
) {
  return supabase.from('produtos').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function alternarAtivoProduto(id: string, ativo: boolean) {
  return supabase.from('produtos').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function excluirProduto(id: string) {
  return supabase.from('produtos').delete().eq('id', id)
}
