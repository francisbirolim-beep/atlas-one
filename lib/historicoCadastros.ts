import { supabase } from './supabase'

export type HistoricoCadastroRegistro = {
  id: string
  entidade_tabela: string
  entidade_tipo: string
  entidade_id: string
  versao: number
  acao: 'baseline' | 'criado' | 'alterado' | 'arquivado' | 'excluido'
  dados_antes: Record<string, any> | null
  dados_depois: Record<string, any> | null
  campos_alterados: string[]
  motivo: string | null
  origem: string
  usuario_id: string | null
  usuario_nome: string | null
  created_at: string
}

export type HistoricoPrecoCompra = {
  id: string
  nf_item_id: string
  nf_id: string
  produto_id: string
  fornecedor_id: string | null
  fornecedor_nome: string | null
  produto_codigo: string | null
  produto_nome: string
  produto_categoria: string | null
  data_compra: string
  quantidade: number
  unidade: string | null
  valor_unitario_nf: number | null
  custo_aquisicao_unitario: number | null
  custo_referencia_anterior: number | null
  tipo_evento: 'compra' | 'vinculo_produto' | 'correcao_compra'
  origem: string
  snapshot: Record<string, any>
  created_at: string
}

export type MetricasPrecoCompra = {
  produto_id: string
  ultimo_custo: number | null
  custo_anterior: number | null
  ultima_compra_em: string | null
  ultimo_fornecedor_id: string | null
  ultimo_fornecedor_nome: string | null
  media_90d: number | null
  menor_90d: number | null
  maior_90d: number | null
  compras_12m: number
  variacao_ultima_compra_pct: number | null
}

export type ProdutoImagem = {
  id: string
  produto_id: string
  url: string
  tipo: 'foto' | 'desenho_tecnico' | 'imagem_wvetro' | 'catalogo' | 'outro'
  origem: string
  origem_ref: string | null
  principal: boolean
  status_validacao: 'pendente' | 'validada' | 'rejeitada'
  metadata: Record<string, any>
  ativo: boolean
  created_at: string
  updated_at: string
}

export async function listarHistoricoCadastro(params?: {
  tabela?: string
  entidadeId?: string
  limite?: number
}): Promise<HistoricoCadastroRegistro[]> {
  let query = supabase
    .from('cadastro_historico')
    .select('*')
    .order('created_at', { ascending: false })
    .order('versao', { ascending: false })
    .limit(params?.limite || 500)

  if (params?.tabela) query = query.eq('entidade_tabela', params.tabela)
  if (params?.entidadeId) query = query.eq('entidade_id', params.entidadeId)

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar histórico de cadastro:', error)
    return []
  }
  return (data || []) as HistoricoCadastroRegistro[]
}

export async function listarHistoricoPrecosCompra(params?: {
  produtoId?: string
  limite?: number
}): Promise<HistoricoPrecoCompra[]> {
  let query = supabase
    .from('vw_historico_precos_compra_validos')
    .select('*')
    .order('data_compra', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(params?.limite || 500)

  if (params?.produtoId) query = query.eq('produto_id', params.produtoId)

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar histórico de preços:', error)
    return []
  }
  return (data || []) as HistoricoPrecoCompra[]
}

export async function obterMetricasPrecoCompra(produtoId: string): Promise<MetricasPrecoCompra | null> {
  const { data, error } = await supabase
    .from('vw_produto_precos_compra_metricas')
    .select('*')
    .eq('produto_id', produtoId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar métricas de preço:', error)
    return null
  }
  return (data as MetricasPrecoCompra | null) || null
}

export async function listarImagensProduto(produtoId?: string): Promise<ProdutoImagem[]> {
  let query = supabase
    .from('produto_imagens')
    .select('*')
    .eq('ativo', true)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: true })

  if (produtoId) query = query.eq('produto_id', produtoId)

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar imagens do produto:', error)
    return []
  }
  return (data || []) as ProdutoImagem[]
}

export async function adicionarImagemProduto(params: {
  produtoId: string
  url: string
  tipo?: ProdutoImagem['tipo']
  origem?: string
  origemRef?: string | null
  principal?: boolean
  statusValidacao?: ProdutoImagem['status_validacao']
  criadoPorId?: string | null
  criadoPorNome?: string | null
}) {
  return supabase.from('produto_imagens').insert({
    produto_id: params.produtoId,
    url: params.url,
    tipo: params.tipo || 'foto',
    origem: params.origem || 'manual',
    origem_ref: params.origemRef || null,
    principal: !!params.principal,
    status_validacao: params.statusValidacao || 'pendente',
    criado_por_id: params.criadoPorId || null,
    criado_por_nome: params.criadoPorNome || null,
  })
}

export async function arquivarImagemProduto(id: string) {
  return supabase
    .from('produto_imagens')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
}
