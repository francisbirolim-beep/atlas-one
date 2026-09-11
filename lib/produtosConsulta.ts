import { supabase } from './supabase'
import type { Produto, CategoriaProduto } from './tipos'

export type FiltroStatusProduto = 'ativos' | 'inativos' | 'todos'

export interface ConsultaProdutosParams {
  categoria?: CategoriaProduto | string
  linhaId?: string
  status?: FiltroStatusProduto
  busca?: string
  pagina?: number
  limite?: number
}

export interface ConsultaProdutosResultado {
  produtos: Produto[]
  total: number
}

function termosBusca(texto: string) {
  return texto
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[,()%]/g, '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

function normalizarUrlWVetro(url: string | null | undefined) {
  if (!url) return null
  const limpa = String(url).trim()
  return limpa.replace(/\/fotos\/\s*(\d+)\//i, (_trecho, pasta: string) => `/fotos/${String(Number(pasta)).padStart(5, '0')}/`)
}

function custoReferencia(produto: any): number | null {
  const candidatos = [produto?.custo, produto?.custo_wvetro_ultimo, produto?.custo_wvetro_max, produto?.custo_wvetro_min]
  for (const valor of candidatos) {
    const n = Number(valor)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

async function enriquecerProdutos(produtos: Produto[]): Promise<Produto[]> {
  if (!produtos.length) return produtos
  const ids = produtos.map(p => p.id)

  const [{ data: imagens }, { data: snapshots }] = await Promise.all([
    supabase
      .from('produto_imagens')
      .select('produto_id,url,principal,status_validacao,ativo,created_at')
      .in('produto_id', ids)
      .eq('ativo', true)
      .neq('status_validacao', 'rejeitada')
      .order('principal', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('wvetro_produtos_snapshot')
      .select('produto_atlas_id,imagem_atlas_url,url_origem,imagem_status')
      .in('produto_atlas_id', ids),
  ])

  const imagemPorProduto = new Map<string, string>()
  for (const imagem of imagens || []) {
    if (!imagem?.produto_id || imagemPorProduto.has(imagem.produto_id)) continue
    const url = normalizarUrlWVetro(imagem.url)
    if (url) imagemPorProduto.set(imagem.produto_id, url)
  }

  const snapshotPorProduto = new Map<string, any>()
  for (const snap of snapshots || []) {
    if (!snap?.produto_atlas_id || snapshotPorProduto.has(snap.produto_atlas_id)) continue
    snapshotPorProduto.set(snap.produto_atlas_id, snap)
  }

  return produtos.map(produto => {
    const atual: any = produto
    const snap = snapshotPorProduto.get(produto.id)
    const desenho = imagemPorProduto.get(produto.id)
      || snap?.imagem_atlas_url
      || normalizarUrlWVetro(atual.foto_url)
      || normalizarUrlWVetro(snap?.url_origem)
      || null
    const custo = custoReferencia(atual)

    return {
      ...produto,
      foto_url: desenho,
      custo: custo ?? atual.custo ?? null,
    } as Produto
  })
}

export async function consultarProdutosPaginados({
  categoria = '',
  linhaId = '',
  status = 'ativos',
  busca = '',
  pagina = 1,
  limite = 50,
}: ConsultaProdutosParams): Promise<ConsultaProdutosResultado> {
  const paginaSegura = Math.max(1, pagina)
  const limiteSeguro = Math.min(100, Math.max(10, limite))
  const inicio = (paginaSegura - 1) * limiteSeguro
  const fim = inicio + limiteSeguro - 1

  let query = supabase
    .from('produtos')
    .select('*', { count: 'exact' })

  if (status === 'ativos') query = query.eq('ativo', true)
  if (status === 'inativos') query = query.eq('ativo', false)
  if (categoria) query = query.eq('categoria', categoria)
  if (linhaId) query = query.eq('linha_id', linhaId)

  for (const termo of termosBusca(busca)) {
    const padrao = `%${termo}%`
    query = query.or([
      `codigo.ilike.${padrao}`,
      `codigo_origem.ilike.${padrao}`,
      `nome.ilike.${padrao}`,
      `descricao.ilike.${padrao}`,
      `grupo.ilike.${padrao}`,
      `marca.ilike.${padrao}`,
      `ncm.ilike.${padrao}`,
      `unidade.ilike.${padrao}`,
      `unidade_origem.ilike.${padrao}`,
      `origem.ilike.${padrao}`,
    ].join(','))
  }

  const { data, error, count } = await query
    .order('nome')
    .order('id')
    .range(inicio, fim)

  if (error) {
    console.error('Erro ao consultar produtos paginados:', error)
    return { produtos: [], total: 0 }
  }

  const produtos = await enriquecerProdutos((data as Produto[]) || [])
  return { produtos, total: count || 0 }
}

export async function contarAcessoriosAtivosSemUnidade(): Promise<number> {
  const { count, error } = await supabase
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true)
    .eq('categoria', 'acessorio')
    .is('unidade', null)

  if (error) return 0
  return count || 0
}

export async function aplicarMargemBalcaoEmLote(params: {
  margem: number
  categoria?: string
  linhaId?: string
  status?: FiltroStatusProduto
}): Promise<{ atualizados: number; error: string | null }> {
  const { data, error } = await supabase.rpc('aplicar_margem_balcao_produtos', {
    p_margem: params.margem,
    p_categoria: params.categoria || null,
    p_linha_id: params.linhaId || null,
    p_status: params.status || 'ativos',
  })
  if (error) return { atualizados: 0, error: error.message }
  return { atualizados: Number(data || 0), error: null }
}
