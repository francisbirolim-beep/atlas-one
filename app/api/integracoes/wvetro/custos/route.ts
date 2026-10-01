import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarItensNotaEntradaWVetro,
  listarNotasEntradaWVetro,
  statusConfiguracaoWVetro,
} from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dataIsoValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

function intervaloDias(inicio: string, fim: string) {
  return Math.floor(
    (new Date(`${fim}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null

  if (/^-?\d+(?:\.\d+)?$/.test(bruto)) {
    const n = Number(bruto)
    return Number.isFinite(n) ? n : null
  }

  const txt = bruto.replace(/\./g, '').replace(',', '.')
  const n = Number(txt)
  return Number.isFinite(n) ? n : null
}

function texto(obj: Record<string, unknown>, chaves: string[]) {
  for (const chave of chaves) {
    const valor = obj[chave]
    if (valor !== undefined && valor !== null && String(valor).trim()) return String(valor).trim()
  }
  return ''
}

function valorNumerico(obj: Record<string, unknown>, chaves: string[]) {
  for (const chave of chaves) {
    const n = numero(obj[chave])
    if (n !== null) return n
  }
  return null
}

function extrairIdsNotas(payload: unknown) {
  const ids = new Set<string>()

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }
    if (!valor || typeof valor !== 'object') return

    const obj = valor as Record<string, unknown>
    for (const [chave, conteudo] of Object.entries(obj)) {
      const k = chave.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (['nfid', 'idnf', 'notafiscalid'].includes(k)) {
        const id = String(conteudo ?? '').trim()
        if (id && /^\d+$/.test(id)) ids.add(id)
      }
    }

    Object.values(obj).forEach(visitar)
  }

  visitar(payload)
  return Array.from(ids)
}

type ItemCompra = {
  nfId: string
  codigo: string
  nome: string
  unidade: string
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  ncm: string
}

function extrairItensCompra(payload: unknown, nfId: string): ItemCompra[] {
  const itens: ItemCompra[] = []
  const vistos = new Set<string>()

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }
    if (!valor || typeof valor !== 'object') return

    const obj = valor as Record<string, unknown>
    const codigo = texto(obj, [
      'ProdutoSeuCodigo',
      'produtoSeuCodigo',
      'SeuCodigo',
      'seuCodigo',
      'ProdutoCodigo',
      'produtoCodigo',
      'Produtocodigo',
      'CodigoProduto',
      'codigoProduto',
    ])
    const nome = texto(obj, [
      'ProdutoDescricao',
      'produtoDescricao',
      'DescricaoProduto',
      'descricaoProduto',
      'Descricao',
      'descricao',
      'Nome',
      'nome',
    ])
    const unidade = texto(obj, ['Unidade', 'unidade', 'ProdutoUnidade', 'produtoUnidade'])
    const ncm = texto(obj, ['ProdutoNCM', 'produtoNCM', 'Ncm', 'NCM', 'ncm'])
    const quantidade = valorNumerico(obj, [
      'ItemNfQtde',
      'ItemNFQtde',
      'Quantidade',
      'quantidade',
      'Qtde',
      'qtde',
    ])
    let valorUnitario = valorNumerico(obj, [
      'ItemNfValorUnitario',
      'ItemNFValorUnitario',
      'ValorUnitario',
      'valorUnitario',
      'CustoUnitario',
      'custoUnitario',
      'CustoVlr',
      'custoVlr',
      'ItemNfValor',
      'ItemNFValor',
    ])
    const valorTotal = valorNumerico(obj, [
      'ItemNfValorTotal',
      'ItemNFValorTotal',
      'ValorTotal',
      'valorTotal',
      'Total',
      'total',
    ])

    if (valorUnitario === null && valorTotal !== null && quantidade !== null && quantidade > 0) {
      valorUnitario = valorTotal / quantidade
    }

    // Um item de compra precisa ter um identificador de produto. Não usamos "Codigo"
    // genérico para evitar classificar número de NF/documento como produto.
    if (codigo) {
      const assinatura = [nfId, codigo, nome, unidade, quantidade, valorUnitario, valorTotal].join('|')
      if (!vistos.has(assinatura)) {
        vistos.add(assinatura)
        itens.push({ nfId, codigo, nome, unidade, quantidade, valorUnitario, valorTotal, ncm })
      }
    }

    Object.values(obj).forEach(visitar)
  }

  visitar(payload)
  return itens
}

function amostraEstrutura(payload: unknown) {
  const chaves = new Set<string>()

  function visitar(valor: unknown, profundidade: number) {
    if (profundidade > 4 || chaves.size >= 60) return
    if (Array.isArray(valor)) {
      valor.slice(0, 4).forEach(item => visitar(item, profundidade + 1))
      return
    }
    if (!valor || typeof valor !== 'object') return

    const obj = valor as Record<string, unknown>
    Object.keys(obj).forEach(chave => {
      if (chaves.size < 60) chaves.add(chave)
    })
    Object.values(obj).slice(0, 12).forEach(item => visitar(item, profundidade + 1))
  }

  visitar(payload, 0)
  return Array.from(chaves)
}

function agregarCustos(itens: ItemCompra[]) {
  const mapa = new Map<
    string,
    {
      codigo: string
      nome: string
      unidade: string
      ocorrencias: number
      notas: Set<string>
      custoMin: number | null
      custoMax: number | null
      ultimoCustoObservado: number | null
    }
  >()

  for (const item of itens) {
    const chave = item.codigo.trim().toUpperCase().replace(/\s+/g, '')
    if (!chave) continue

    const atual = mapa.get(chave) || {
      codigo: item.codigo,
      nome: item.nome,
      unidade: item.unidade,
      ocorrencias: 0,
      notas: new Set<string>(),
      custoMin: null,
      custoMax: null,
      ultimoCustoObservado: null,
    }

    atual.ocorrencias += 1
    atual.notas.add(item.nfId)
    if (!atual.nome && item.nome) atual.nome = item.nome
    if (!atual.unidade && item.unidade) atual.unidade = item.unidade

    if (item.valorUnitario !== null) {
      atual.custoMin = atual.custoMin === null ? item.valorUnitario : Math.min(atual.custoMin, item.valorUnitario)
      atual.custoMax = atual.custoMax === null ? item.valorUnitario : Math.max(atual.custoMax, item.valorUnitario)
      atual.ultimoCustoObservado = item.valorUnitario
    }

    mapa.set(chave, atual)
  }

  return Array.from(mapa.values())
    .map(item => ({ ...item, notas: item.notas.size }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
}

async function emLotes<T, R>(itens: T[], tamanho: number, executar: (item: T) => Promise<R>) {
  const resultados: R[] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    const lote = itens.slice(i, i + tamanho)
    resultados.push(...(await Promise.all(lote.map(executar))))
  }
  return resultados
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })

  const fonte = String(req.nextUrl.searchParams.get('fonte') || 'api-wvetro').trim()
  const inicio = req.nextUrl.searchParams.get('inicio')
  const fim = req.nextUrl.searchParams.get('fim')

  if (!dataIsoValida(inicio) || !dataIsoValida(fim)) {
    return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })
  }

  const dias = intervaloDias(inicio, fim)
  if (dias < 0 || dias > 90) {
    return NextResponse.json({ error: 'O período deve ter entre 0 e 90 dias.' }, { status: 400 })
  }

  if (fonte === 'historico-suprimentos') {
    try {
      const { data: linhas, error } = await supabaseAdmin
        .from('wvetro_historico_suprimentos')
        .select('produto_atlas_id,nota_chave_externa,fornecedor_nome,data_emissao,valor_unitario,quantidade,valor_total')
        .eq('empresa_id', usuario.empresa_id)
        .eq('tipo_registro', 'item_nota_entrada')
        .eq('produto_vinculo_status', 'seguro')
        .not('produto_atlas_id', 'is', null)
        .gte('data_emissao', inicio)
        .lte('data_emissao', fim)
        .order('data_emissao', { ascending: true })

      if (error) throw error

      const produtoIds = Array.from(new Set((linhas || []).map(item => item.produto_atlas_id).filter(Boolean)))
      const { data: produtos, error: produtosError } = produtoIds.length
        ? await supabaseAdmin
            .from('produtos')
            .select('id,codigo,nome,categoria,custo')
            .eq('empresa_id', usuario.empresa_id)
            .in('id', produtoIds)
        : { data: [], error: null }

      if (produtosError) throw produtosError

      const produtoPorId = new Map((produtos || []).map(produto => [produto.id, produto]))
      const mapa = new Map<string, {
        produtoAtlasId: string
        codigo: string
        nome: string
        categoria: string
        ocorrencias: number
        notas: Set<string>
        primeiraCompra: string | null
        ultimaCompra: string | null
        custoMin: number | null
        custoMax: number | null
        ultimoCustoObservado: number | null
        ultimoFornecedor: string | null
        custoOficialAtual: number | null
      }>()

      for (const item of linhas || []) {
        const produtoId = String(item.produto_atlas_id || '')
        if (!produtoId) continue
        const produto = produtoPorId.get(produtoId)
        if (!produto) continue

        const atual = mapa.get(produtoId) || {
          produtoAtlasId: produtoId,
          codigo: String(produto.codigo || ''),
          nome: String(produto.nome || ''),
          categoria: String(produto.categoria || ''),
          ocorrencias: 0,
          notas: new Set<string>(),
          primeiraCompra: null,
          ultimaCompra: null,
          custoMin: null,
          custoMax: null,
          ultimoCustoObservado: null,
          ultimoFornecedor: null,
          custoOficialAtual: numero(produto.custo),
        }

        atual.ocorrencias += 1
        if (item.nota_chave_externa) atual.notas.add(String(item.nota_chave_externa))

        const data = item.data_emissao ? String(item.data_emissao) : null
        if (data) {
          if (!atual.primeiraCompra || data < atual.primeiraCompra) atual.primeiraCompra = data
          if (!atual.ultimaCompra || data >= atual.ultimaCompra) {
            atual.ultimaCompra = data
            atual.ultimoFornecedor = item.fornecedor_nome ? String(item.fornecedor_nome) : null
            atual.ultimoCustoObservado = numero(item.valor_unitario)
          }
        }

        const custo = numero(item.valor_unitario)
        if (custo !== null) {
          atual.custoMin = atual.custoMin === null ? custo : Math.min(atual.custoMin, custo)
          atual.custoMax = atual.custoMax === null ? custo : Math.max(atual.custoMax, custo)
          if (!data) atual.ultimoCustoObservado = custo
        }

        mapa.set(produtoId, atual)
      }

      const custos = Array.from(mapa.values())
        .map(item => {
          const diferencaUltimoVsOficial =
            item.ultimoCustoObservado !== null && item.custoOficialAtual !== null
              ? item.ultimoCustoObservado - item.custoOficialAtual
              : null
          const diferencaPercentual =
            diferencaUltimoVsOficial !== null && item.custoOficialAtual && item.custoOficialAtual !== 0
              ? (diferencaUltimoVsOficial / item.custoOficialAtual) * 100
              : null
          return {
            ...item,
            notas: item.notas.size,
            diferencaUltimoVsOficial,
            diferencaPercentual,
          }
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

      return NextResponse.json({
        ok: true,
        fonte: 'historico-suprimentos',
        modo: 'somente-leitura',
        periodo: { inicio, fim },
        seguranca: {
          nenhumaGravacao: true,
          observacao: 'Custos comprados históricos não alteram custo oficial, estoque, compras ou financeiro do Atlas.',
        },
        resumo: {
          itens: (linhas || []).length,
          produtos: custos.length,
          notas: new Set((linhas || []).map(item => item.nota_chave_externa).filter(Boolean)).size,
          produtosComCustoOficial: custos.filter(item => item.custoOficialAtual !== null).length,
        },
        custos,
      })
    } catch (error) {
      console.error('Erro ao ler custos históricos materializados do W.Vetro:', error)
      return NextResponse.json({ error: 'Não foi possível ler os custos históricos materializados.' }, { status: 502 })
    }
  }

  const status = statusConfiguracaoWVetro()
  if (!status.pronto) {
    return NextResponse.json({ error: 'Credenciais W.Vetro não configuradas no servidor.' }, { status: 503 })
  }

  const limiteSolicitado = Number(req.nextUrl.searchParams.get('maxNotas') || 25)
  const maxNotas = Math.max(1, Math.min(Number.isFinite(limiteSolicitado) ? limiteSolicitado : 25, 50))

  try {
    const notasPayload = await listarNotasEntradaWVetro(inicio, fim)
    const ids = extrairIdsNotas(notasPayload)
    const selecionados = ids.slice(0, maxNotas)

    const detalhes = await emLotes(selecionados, 5, async nfId => {
      const payload = await listarItensNotaEntradaWVetro(nfId)
      return {
        nfId,
        itens: extrairItensCompra(payload, nfId),
        chaves: amostraEstrutura(payload),
      }
    })

    const itens = detalhes.flatMap(item => item.itens)
    const custos = agregarCustos(itens)

    return NextResponse.json({
      ok: true,
      modo: 'somente-leitura',
      periodo: { inicio, fim },
      seguranca: {
        maxNotas,
        nenhumaGravacao: true,
        observacao: 'Custos são apenas observados nas notas de entrada; nenhum produto do Atlas é atualizado.',
      },
      resumo: {
        notasEncontradas: ids.length,
        notasConsultadas: selecionados.length,
        notasNaoConsultadasPorLimite: Math.max(0, ids.length - selecionados.length),
        itensIdentificados: itens.length,
        produtosComCustoObservado: custos.filter(item => item.custoMin !== null).length,
      },
      custos,
      diagnosticoEstrutura: {
        chavesNotas: amostraEstrutura(notasPayload),
        primeirasNotas: detalhes.slice(0, 3).map(item => ({ nfId: item.nfId, chaves: item.chaves })),
      },
    })
  } catch (error) {
    console.error('Erro no diagnóstico de custos W.Vetro:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao consultar compras do W.Vetro.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}
