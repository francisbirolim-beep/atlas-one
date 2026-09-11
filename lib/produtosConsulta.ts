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

  return {
    produtos: (data as Produto[]) || [],
    total: count || 0,
  }
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
