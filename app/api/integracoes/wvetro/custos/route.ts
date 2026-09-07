import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
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
      'ProdutoSeuCodigo','produtoSeuCodigo','SeuCodigo','seuCodigo','ProdutoCodigo','produtoCodigo','Produtocodigo','CodigoProduto','codigoProduto',
    ])
    const nome = texto(obj, [
      'ProdutoDescricao','produtoDescricao','DescricaoProduto','descricaoProduto','Descricao','descricao','Nome','nome',
    ])
    const unidade = texto(obj, ['Unidade', 'unidade', 'ProdutoUnidade', 'produtoUnidade'])
    const ncm = texto(obj, ['ProdutoNCM', 'produtoNCM', 'Ncm', 'NCM', 'ncm'])
    const quantidade = valorNumerico(obj, ['ItemNfQtde','ItemNFQtde','Quantidade','quantidade','Qtde','qtde'])
    let valorUnitario = valorNumerico(obj, [
      'ItemNfValorUnitario','ItemNFValorUnitario','ValorUnitario','valorUnitario','CustoUnitario','custoUnitario','CustoVlr','custoVlr','ItemNfValor','ItemNFValor',
    ])
    const valorTotal = valorNumerico(obj, ['ItemNfValorTotal','ItemNFValorTotal','ValorTotal','valorTotal','Total','total'])

    if (valorUnitario === null && valorTotal !== null && quantidade !== null && quantidade > 0) {
      valorUnitario = valorTotal / quantidade
    }

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
  const mapa = new Map<string, { codigo: string; nome: string; unidade: string; ocorrencias: number; notas: Set<string>; custoMin: number | null; custoMax: number | null; ultimoCustoObservado: number | null }>()

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
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master da empresa autorizada.' }, { status: 403 })

  const status = statusConfiguracaoWVetro()
  if (!status.pronto) {
    return NextResponse.json({ error: 'Credenciais W.Vetro não configuradas no servidor.' }, { status: 503 })
  }

  const inicio = req.nextUrl.searchParams.get('inicio')
  const fim = req.nextUrl.searchParams.get('fim')
  const limiteSolicitado = Number(req.nextUrl.searchParams.get('maxNotas') || 25)
  const maxNotas = Math.max(1, Math.min(Number.isFinite(limiteSolicitado) ? limiteSolicitado : 25, 50))

  if (!dataIsoValida(inicio) || !dataIsoValida(fim)) {
    return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })
  }

  const dias = intervaloDias(inicio, fim)
  if (dias < 0 || dias > 90) {
    return NextResponse.json({ error: 'O período deve ter entre 0 e 90 dias.' }, { status: 400 })
  }

  try {
    const notasPayload = await listarNotasEntradaWVetro(inicio, fim)
    const ids = extrairIdsNotas(notasPayload)
    const selecionados = ids.slice(0, maxNotas)

    const detalhes = await emLotes(selecionados, 5, async nfId => {
      const payload = await listarItensNotaEntradaWVetro(nfId)
      return { nfId, itens: extrairItensCompra(payload, nfId), chaves: amostraEstrutura(payload) }
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
