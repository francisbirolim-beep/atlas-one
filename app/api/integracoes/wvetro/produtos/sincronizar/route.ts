import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarItensNotaEntradaWVetro,
  listarNotasEntradaWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  statusConfiguracaoWVetro,
} from '@/lib/wvetroApi'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'

function numero(valor: unknown) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  if (!texto) return null
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function texto(obj: Record<string, unknown>, chaves: string[]) {
  for (const chave of chaves) {
    const valor = obj[chave]
    if (valor !== null && valor !== undefined && String(valor).trim()) return String(valor).trim()
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

function normalizarCodigo(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

async function master(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && authorization === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return false
  const { data } = await supabaseAdmin.auth.getUser(token)
  const user = data.user
  if (!user) return false
  const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase()
  return role === 'master'
}

function extrairIdsNotas(payload: unknown) {
  const ids = new Set<string>()
  const visitar = (valor: unknown) => {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const id = texto(obj, ['NotaEntradaId','notaEntradaId','NfId','nfId','Id','id'])
    if (id) ids.add(id)
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
  return Array.from(ids)
}

type Observado = {
  codigo: string
  custoUltimo: number | null
  custoMin: number | null
  custoMax: number | null
  vendaUltimo: number | null
  vendaMin: number | null
  vendaMax: number | null
}

function atualizarMinMax(atual: number | null, valor: number | null, modo: 'min' | 'max') {
  if (valor === null || valor <= 0) return atual
  if (atual === null) return valor
  return modo === 'min' ? Math.min(atual, valor) : Math.max(atual, valor)
}

function primeiroNumeroProfundo(obj: Record<string, unknown>, chaves: string[]) {
  const direto = valorNumerico(obj, chaves)
  if (direto !== null) return direto
  const alvo = new Set(chaves.map(chave => chave.toLowerCase()))
  for (const [chave, valor] of Object.entries(obj)) {
    if (alvo.has(chave.toLowerCase())) {
      const n = numero(valor)
      if (n !== null) return n
    }
  }
  return null
}

function extrairValores(payload: unknown, acumulado: Map<string, Observado>) {
  const visitar = (valor: unknown) => {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const codigo = texto(obj, [
      'ProdutoSeuCodigo','produtoSeuCodigo','SeuCodigo','seuCodigo',
      'ProdutoCodigo','produtoCodigo','Produtocodigo','CodigoProduto','codigoProduto',
      'Codigo','codigo','CodProduto','codProduto','ItemCodigo','itemCodigo',
    ])
    const chave = normalizarCodigo(codigo)
    if (chave) {
      const quantidade = primeiroNumeroProfundo(obj, [
        'ItemNfQtde','ItemNFQtde','Quantidade','quantidade','Qtde','qtde','Qtd','qtd',
      ])
      let custo = primeiroNumeroProfundo(obj, [
        'CustoVlr','custoVlr','CustoUnitario','custoUnitario',
        'ItemNfValorUnitario','ItemNFValorUnitario','ValorUnitario','valorUnitario',
        'ItemNfValor','ItemNFValor','PrecoCusto','precoCusto','ValorCusto','valorCusto',
      ])
      const custoTotal = primeiroNumeroProfundo(obj, [
        'ItemNfValorTotal','ItemNFValorTotal','ValorTotal','valorTotal','Total','total',
      ])
      if (custo === null && custoTotal !== null && quantidade !== null && quantidade > 0) custo = custoTotal / quantidade
      const venda = primeiroNumeroProfundo(obj, [
        'VendaVlr','vendaVlr','PrecoVenda','precoVenda','ValorVenda','valorVenda',
        'Preco','preco','ValorUnitarioVenda','valorUnitarioVenda','VlrUnitario','vlrUnitario',
      ])
      if ((custo !== null && custo > 0) || (venda !== null && venda > 0)) {
        const atual = acumulado.get(chave) || {
          codigo,
          custoUltimo: null,
          custoMin: null,
          custoMax: null,
          vendaUltimo: null,
          vendaMin: null,
          vendaMax: null,
        }
        if (custo !== null && custo > 0) {
          atual.custoUltimo = custo
          atual.custoMin = atualizarMinMax(atual.custoMin, custo, 'min')
          atual.custoMax = atualizarMinMax(atual.custoMax, custo, 'max')
        }
        if (venda !== null && venda > 0) {
          atual.vendaUltimo = venda
          atual.vendaMin = atualizarMinMax(atual.vendaMin, venda, 'min')
          atual.vendaMax = atualizarMinMax(atual.vendaMax, venda, 'max')
        }
        acumulado.set(chave, atual)
      }
    }
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
}

function mesclarMapa(destino: Map<string, Observado>, origem: Map<string, Observado>) {
  for (const [chave, novo] of origem) {
    const atual = destino.get(chave)
    if (!atual) { destino.set(chave, novo); continue }
    if (novo.custoUltimo != null) atual.custoUltimo = novo.custoUltimo
    atual.custoMin = atualizarMinMax(atual.custoMin, novo.custoMin, 'min')
    atual.custoMax = atualizarMinMax(atual.custoMax, novo.custoMax, 'max')
    if (novo.vendaUltimo != null) atual.vendaUltimo = novo.vendaUltimo
    atual.vendaMin = atualizarMinMax(atual.vendaMin, novo.vendaMin, 'min')
    atual.vendaMax = atualizarMinMax(atual.vendaMax, novo.vendaMax, 'max')
  }
}

function isoData(d: Date) { return d.toISOString().slice(0, 10) }

async function valoresHistoricosVendasWVetro(dias = 365) {
  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - Math.max(7, Math.min(730, dias)))
  const mapa = new Map<string, Observado>()
  const [pedidos, orcamentos] = await Promise.all([
    listarPedidosWVetro<unknown>(isoData(inicio), isoData(fim)),
    listarOrcamentosWVetro<unknown>(isoData(inicio), isoData(fim)),
  ])
  extrairValores(pedidos, mapa)
  extrairValores(orcamentos, mapa)
  return mapa
}

async function valoresComprasWVetro(maxNotas = 50) {
  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - 365)
  const notas = await listarNotasEntradaWVetro<unknown>(isoData(inicio), isoData(fim))
  const ids = extrairIdsNotas(notas).slice(0, Math.max(1, Math.min(100, maxNotas)))
  const mapa = new Map<string, Observado>()
  for (let i = 0; i < ids.length; i += 5) {
    const lote = ids.slice(i, i + 5)
    const detalhes = await Promise.all(lote.map(id => listarItensNotaEntradaWVetro<unknown>(id)))
    detalhes.forEach(payload => extrairValores(payload, mapa))
  }
  return { mapa, notasConsultadas: ids.length }
}

async function carregarReferenciasLocais() {
  const mapa = new Map<string, Observado>()
  const { data, error } = await supabaseAdmin
    .from('wvetro_tipologia_componentes')
    .select('codigo,codigo_wvetro,custo_min,custo_max,custo_ultimo,venda_min,venda_max,venda_ultimo,ultimo_visto')
    .eq('tipo', 'acessorio')
    .order('ultimo_visto', { ascending: true })
  if (error) throw error
  for (const item of data || []) {
    const base: Observado = {
      codigo: String(item.codigo || item.codigo_wvetro || ''),
      custoUltimo: numero(item.custo_ultimo),
      custoMin: numero(item.custo_min),
      custoMax: numero(item.custo_max),
      vendaUltimo: numero(item.venda_ultimo),
      vendaMin: numero(item.venda_min),
      vendaMax: numero(item.venda_max),
    }
    for (const cod of [item.codigo, item.codigo_wvetro].map(normalizarCodigo).filter(Boolean)) {
      mesclarMapa(mapa, new Map([[cod, base]]))
    }
  }
  return mapa
}

export async function POST(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  const status = statusConfiguracaoWVetro()
  if (!status.pronto) return NextResponse.json({ error: 'Credenciais W.Vetro não configuradas no servidor.' }, { status: 503 })

  try {
    const body = await req.json().catch(() => ({}))
    const maxNotas = Number(body?.maxNotas || 100)
    const diasHistorico = Number(body?.diasHistorico || 365)

    let catalogo: unknown = null
    let catalogoErro: string | null = null
    try {
      catalogo = await descobrirEImportarCatalogoWVetro('A')
    } catch (e) {
      catalogoErro = e instanceof Error ? e.message : 'Falha ao consultar catálogo W.Vetro.'
    }

    const mapa = await carregarReferenciasLocais()

    let vendasErro: string | null = null
    let encontradosVendas = 0
    try {
      const vendas = await valoresHistoricosVendasWVetro(diasHistorico)
      encontradosVendas = vendas.size
      mesclarMapa(mapa, vendas)
    } catch (e) {
      vendasErro = e instanceof Error ? e.message : 'Falha ao consultar vendas/orçamentos no W.Vetro.'
    }

    let notasConsultadas = 0
    let comprasErro: string | null = null
    try {
      const compras = await valoresComprasWVetro(maxNotas)
      notasConsultadas = compras.notasConsultadas
      mesclarMapa(mapa, compras.mapa)
    } catch (e) {
      comprasErro = e instanceof Error ? e.message : 'Falha ao consultar Compras/NF no W.Vetro.'
    }

    const { data: produtos, error: erroProdutos } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,codigo_origem,id_externo_wvetro,custo,custo_wvetro_min,custo_wvetro_max,custo_wvetro_ultimo,venda_wvetro_min,venda_wvetro_max,venda_wvetro_ultimo')
      .eq('categoria', 'acessorio')
    if (erroProdutos) throw erroProdutos

    let custosAtualizados = 0
    let referenciasVendaAtualizadas = 0
    let produtosComCorrespondencia = 0
    const codigosSemCorrespondencia: string[] = []
    const atualizacoes: Promise<unknown>[] = []
    for (const produto of produtos || []) {
      const chaves = [produto.codigo, produto.codigo_origem, produto.id_externo_wvetro]
        .map(normalizarCodigo)
        .filter(Boolean)
      const observado = chaves.map(chave => mapa.get(chave)).find(Boolean)
      if (!observado) {
        if (codigosSemCorrespondencia.length < 30 && produto.codigo) codigosSemCorrespondencia.push(String(produto.codigo))
        continue
      }
      produtosComCorrespondencia += 1

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (observado.custoUltimo != null && observado.custoUltimo > 0) {
        patch.custo_wvetro_ultimo = observado.custoUltimo
        patch.custo_wvetro_min = observado.custoMin ?? observado.custoUltimo
        patch.custo_wvetro_max = observado.custoMax ?? observado.custoUltimo
        patch.custo_wvetro_atualizado_em = new Date().toISOString()
        if (!(Number(produto.custo) > 0)) {
          patch.custo = observado.custoUltimo
          custosAtualizados += 1
        }
      }
      if (observado.vendaUltimo != null && observado.vendaUltimo > 0) {
        patch.venda_wvetro_ultimo = observado.vendaUltimo
        patch.venda_wvetro_min = observado.vendaMin ?? observado.vendaUltimo
        patch.venda_wvetro_max = observado.vendaMax ?? observado.vendaUltimo
        referenciasVendaAtualizadas += 1
      }
      if (Object.keys(patch).length <= 1) continue
      const atualizacao = supabaseAdmin.from('produtos').update(patch).eq('id', produto.id)
      atualizacoes.push(Promise.resolve(atualizacao).then(({ error }) => {
        if (error) throw error
      }))
      if (atualizacoes.length >= 20) await Promise.all(atualizacoes.splice(0, atualizacoes.length))
    }
    if (atualizacoes.length) await Promise.all(atualizacoes)

    await supabaseAdmin
      .from('wvetro_produtos_snapshot')
      .update({ imagem_status: 'pendente', imagem_erro: null })
      .eq('tipo', 'A')
      .eq('imagem_status', 'erro')
      .not('produto_atlas_id', 'is', null)
      .not('url_origem', 'is', null)

    let imagens: unknown = null
    let imagensErro: string | null = null
    try {
      imagens = await processarPendenciasImagensWVetro(15)
    } catch (e) {
      imagensErro = e instanceof Error ? e.message : 'Falha ao processar desenhos W.Vetro.'
    }

    const { count: semCusto } = await supabaseAdmin
      .from('produtos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', 'acessorio')
      .eq('ativo', true)
      .or('custo.is.null,custo.lte.0')

    return NextResponse.json({
      ok: true,
      catalogo,
      catalogoErro,
      custos: {
        notasConsultadas,
        referenciasHistoricas: mapa.size,
        encontradosEmVendasOrcamentos: encontradosVendas,
        produtosComCorrespondencia,
        atualizados: custosAtualizados,
        semCusto: semCusto || 0,
        comprasErro,
        vendasErro,
        acessoCompras: comprasErro?.includes('403') ? 'sem_permissao' : comprasErro ? 'erro' : 'ok',
        codigosSemCorrespondencia,
      },
      tabelaPreco: {
        referenciasVendaAtualizadas,
        origem: 'VendaVlr observado em vendas/orçamentos do W.Vetro',
        aplicadoComoPrecoBalcao: false,
        observacao: 'O Atlas guarda o valor de venda W.Vetro como referência histórica. Não substitui automaticamente o preço balcão nem a margem.',
      },
      imagens,
      imagensErro,
      diagnostico: {
        produtosAnalisados: (produtos || []).length,
        produtosComCorrespondencia,
        produtosSemCorrespondencia: Math.max(0, (produtos || []).length - produtosComCorrespondencia),
        amostraSemCorrespondencia: codigosSemCorrespondencia,
      },
      observacao: 'Sincronização ampliada para 365 dias, normalização de códigos mais tolerante e diagnóstico de correspondência. Compras/NF continua opcional enquanto houver 403.',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar produtos W.Vetro.' }, { status: 500 })
  }
}
