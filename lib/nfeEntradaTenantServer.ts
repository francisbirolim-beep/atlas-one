import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { NFeItemNormalizado, NFeNormalizada, SugestaoProduto } from '@/lib/nfeEntradaServer'
import { normalizarCodigo } from '@/lib/nfeEntradaServer'

type ProdutoCatalogo = {
  id: string
  codigo: string | null
  codigo_origem: string | null
  id_externo_wvetro: string | null
  nome: string
  descricao: string | null
  ncm: string | null
  unidade: string | null
  custo: number | string | null
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function normalizarTexto(valor: unknown) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

const STOP = new Set(['DE','DA','DO','DAS','DOS','COM','SEM','PARA','E','EM','PACOTE','PCS','PC','PCT','UN','UNIDADE','PRETO','BRANCO'])
function tokens(valor: unknown) {
  return new Set(normalizarTexto(valor).split(/\s+/).filter(t => t.length >= 2 && !STOP.has(t)))
}

function similaridadeDescricao(item: NFeItemNormalizado, p: ProdutoCatalogo) {
  const a = tokens(item.descricao)
  const b = tokens(`${p.nome} ${p.descricao || ''}`)
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  const uniao = new Set([...Array.from(a), ...Array.from(b)]).size
  let score = uniao ? inter / uniao : 0
  if (item.ncm && p.ncm && somenteDigitos(item.ncm) === somenteDigitos(p.ncm)) score += 0.18
  return Math.min(1, score)
}

async function buscarCatalogoProdutosTenant(empresaId: string): Promise<ProdutoCatalogo[]> {
  const todos: ProdutoCatalogo[] = []
  let inicio = 0
  const pagina = 1000
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,codigo_origem,id_externo_wvetro,nome,descricao,ncm,unidade,custo')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome')
      .range(inicio, inicio + pagina - 1)
    if (error) throw new Error(`Não foi possível carregar produtos: ${error.message}`)
    const lote = (data || []) as ProdutoCatalogo[]
    todos.push(...lote)
    if (lote.length < pagina) break
    inicio += pagina
  }
  return todos
}

export async function enriquecerVinculosTenant(nf: NFeNormalizada, empresaId: string) {
  if (!empresaId) throw new Error('Empresa não identificada para a prévia da NF.')

  const produtos = await buscarCatalogoProdutosTenant(empresaId)
  const indice = new Map<string, ProdutoCatalogo[]>()
  for (const produto of produtos) {
    const codigos = Array.from(new Set([
      normalizarCodigo(produto.codigo), normalizarCodigo(produto.codigo_origem), normalizarCodigo(produto.id_externo_wvetro),
    ].filter(Boolean)))
    for (const codigo of codigos) {
      const lista = indice.get(codigo) || []
      lista.push(produto)
      indice.set(codigo, lista)
    }
  }

  let fornecedorId = nf.fornecedorId || null
  if (nf.fornecedorCnpj) {
    const cnpj = somenteDigitos(nf.fornecedorCnpj)
    const { data } = await supabaseAdmin
      .from('fornecedores')
      .select('id,nome,cnpj_cpf')
      .eq('empresa_id', empresaId)
      .not('cnpj_cpf', 'is', null)
    const encontrado = (data || []).find(f => somenteDigitos(String(f.cnpj_cpf || '')) === cnpj)
    if (encontrado) {
      fornecedorId = encontrado.id
      nf.fornecedorId = encontrado.id
      if (!nf.fornecedorNome) nf.fornecedorNome = encontrado.nome
    }
  }

  const mapaFornecedor = new Map<string, { id: string; produto_id: string; unidade_compra: string | null; fator_conversao: number | null }>()
  if (fornecedorId) {
    const { data } = await supabaseAdmin
      .from('produto_fornecedores')
      .select('id,produto_id,codigo_fornecedor,unidade_compra,fator_conversao')
      .eq('empresa_id', empresaId)
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
    for (const m of data || []) {
      mapaFornecedor.set(normalizarCodigo(m.codigo_fornecedor), {
        ...m,
        fator_conversao: m.fator_conversao == null ? null : Number(m.fator_conversao),
      })
    }
  }

  const produtosPorId = new Map(produtos.map(p => [p.id, p]))
  nf.itens = nf.itens.map(item => {
    const codigo = normalizarCodigo(item.codigoFornecedor)
    const mapeado = codigo ? mapaFornecedor.get(codigo) : null
    if (mapeado) {
      const p = produtosPorId.get(mapeado.produto_id)
      if (p) return {
        ...item,
        produtoId: p.id,
        produtoCodigo: p.codigo || p.codigo_origem || p.id_externo_wvetro,
        produtoNome: p.nome,
        vinculoStatus: 'vinculado' as const,
        candidatos: [],
        sugestoes: [],
        unidadeEstoque: p.unidade,
        fatorConversao: mapeado.fator_conversao,
      }
    }

    const candidatos = codigo ? (indice.get(codigo) || []) : []
    if (candidatos.length === 1) {
      const p = candidatos[0]
      return {
        ...item,
        produtoId: p.id,
        produtoCodigo: p.codigo || p.codigo_origem || p.id_externo_wvetro,
        produtoNome: p.nome,
        vinculoStatus: 'vinculado' as const,
        candidatos: [], sugestoes: [], unidadeEstoque: p.unidade,
      }
    }
    if (candidatos.length > 1) {
      return {
        ...item, produtoId: null, produtoCodigo: null, produtoNome: null, vinculoStatus: 'ambiguo' as const,
        candidatos: candidatos.slice(0, 10).map(p => ({ id: p.id, codigo: p.codigo || p.codigo_origem || p.id_externo_wvetro || '', nome: p.nome })),
        sugestoes: [],
      }
    }

    const sugestoes: SugestaoProduto[] = produtos
      .map(p => ({ p, score: similaridadeDescricao(item, p) }))
      .filter(x => x.score >= 0.42)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ p, score }) => ({
        id: p.id,
        codigo: p.codigo || p.codigo_origem || p.id_externo_wvetro || '',
        nome: p.nome,
        score: Math.round(score * 100),
        motivo: item.ncm && p.ncm && somenteDigitos(item.ncm) === somenteDigitos(p.ncm) ? 'descrição + NCM' : 'descrição semelhante',
      }))

    return { ...item, produtoId: null, produtoCodigo: null, produtoNome: null, vinculoStatus: 'pendente' as const, candidatos: [], sugestoes }
  })

  return nf
}
