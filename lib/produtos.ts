import { supabase } from './supabase'
import { Produto, CategoriaProduto } from './tipos'

export interface CategoriaProdutoConfig {
  valor: CategoriaProduto
  label: string
  ordem: number
}

const CHAVE_CATEGORIAS_PRODUTO = 'categorias_produto_dinamicas'

export const CATEGORIAS_PRODUTO_PRINCIPAIS: CategoriaProdutoConfig[] = [
  { valor: 'produto', label: 'Produto', ordem: 10 },
  { valor: 'acessorio', label: 'Acessório', ordem: 20 },
  { valor: 'perfil', label: 'Perfil', ordem: 30 },
  { valor: 'porta_janela_padrao', label: 'Produto pronto', ordem: 40 },
]

// Mantido por compatibilidade com telas antigas. A listagem nova deve usar
// listarCategoriasProduto(), que inclui categorias criadas pelo usuario.
export const CATEGORIAS_PRODUTO: CategoriaProdutoConfig[] = [
  ...CATEGORIAS_PRODUTO_PRINCIPAIS,
  { valor: 'pu', label: 'PU', ordem: 90 },
  { valor: 'outro', label: 'Outro', ordem: 100 },
]

let categoriasProdutoCache: CategoriaProdutoConfig[] = [...CATEGORIAS_PRODUTO]

function humanizarCategoria(valor: string): string {
  if (valor === 'porta_janela_padrao') return 'Produto pronto'
  if (valor === 'pu') return 'PU'
  return valor
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letra => letra.toUpperCase())
}

function normalizarChaveCategoria(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function lerExtras(valor: string | null | undefined): CategoriaProdutoConfig[] {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item.valor === 'string' && typeof item.label === 'string')
      .map((item, index) => ({
        valor: item.valor as CategoriaProduto,
        label: item.label.trim(),
        ordem: Number(item.ordem) || 200 + index * 10,
      }))
      .filter(item => item.valor && item.label)
  } catch {
    return []
  }
}

export async function listarCategoriasProduto(): Promise<CategoriaProdutoConfig[]> {
  const [{ data: config }, { data: usados }] = await Promise.all([
    supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', CHAVE_CATEGORIAS_PRODUTO)
      .maybeSingle(),
    supabase.from('produtos').select('categoria'),
  ])

  const mapa = new Map<string, CategoriaProdutoConfig>()
  CATEGORIAS_PRODUTO_PRINCIPAIS.forEach(c => mapa.set(c.valor, c))
  lerExtras(config?.valor).forEach(c => mapa.set(c.valor, c))

  ;((usados as { categoria?: string | null }[]) || []).forEach((item, index) => {
    const valor = item.categoria?.trim()
    if (!valor || mapa.has(valor)) return
    const legado = CATEGORIAS_PRODUTO.find(c => c.valor === valor)
    mapa.set(valor, {
      valor,
      label: legado?.label || humanizarCategoria(valor),
      ordem: legado?.ordem || 1000 + index,
    })
  })

  const lista = Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
  categoriasProdutoCache = lista
  return lista
}

export async function criarCategoriaProduto(nome: string): Promise<{ categoria: CategoriaProdutoConfig | null; erro: string | null }> {
  const label = nome.trim()
  if (!label) return { categoria: null, erro: 'Informe o nome da categoria.' }

  const valor = normalizarChaveCategoria(label)
  if (!valor) return { categoria: null, erro: 'Nome de categoria inválido.' }

  const atuais = await listarCategoriasProduto()
  const duplicada = atuais.some(c => c.valor === valor || c.label.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))
  if (duplicada) return { categoria: null, erro: 'Essa categoria já existe.' }

  const { data: config } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_CATEGORIAS_PRODUTO)
    .maybeSingle()

  const extras = lerExtras(config?.valor)
  const maiorOrdem = atuais.reduce((maior, item) => Math.max(maior, item.ordem), 100)
  const nova: CategoriaProdutoConfig = { valor, label, ordem: maiorOrdem + 10 }
  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_CATEGORIAS_PRODUTO,
      valor: JSON.stringify([...extras, nova]),
      updated_at: new Date().toISOString(),
    })

  if (error) return { categoria: null, erro: 'Não foi possível salvar a categoria.' }
  categoriasProdutoCache = [...atuais, nova].sort((a, b) => a.ordem - b.ordem)
  return { categoria: nova, erro: null }
}

export function labelCategoriaProduto(categoria: CategoriaProduto): string {
  return categoriasProdutoCache.find(c => c.valor === categoria)?.label
    || CATEGORIAS_PRODUTO.find(c => c.valor === categoria)?.label
    || humanizarCategoria(categoria)
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
  unidade_origem?: string | null
  qtde_embalagem_origem?: number | null
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
    unidade_origem: string | null
    qtde_embalagem_origem: number | null
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
