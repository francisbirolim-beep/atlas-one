import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listarItensNotaEntradaWVetro, listarNotasEntradaWVetro, statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null
  if (/^-?\d+(?:\.\d+)?$/.test(bruto)) {
    const n = Number(bruto)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(bruto.replace(/\./g, '').replace(',', '.'))
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

function normalizarCodigo(v: unknown) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase().trim()
}

function extrairIdsNotas(payload: unknown) {
  const ids = new Set<string>()
  const visitar = (valor: unknown) => {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    for (const [chave, conteudo] of Object.entries(obj)) {
      const k = chave.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (['nfid', 'idnf', 'notafiscalid'].includes(k)) {
        const id = String(conteudo ?? '').trim()
        if (/^\d+$/.test(id)) ids.add(id)
      }
    }
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
  return Array.from(ids)
}

type CustoObservado = { codigo: string; ultimo: number; minimo: number; maximo: number }

function extrairCustos(payload: unknown, acumulado: Map<string, CustoObservado>) {
  const visitar = (valor: unknown) => {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const codigo = texto(obj, ['ProdutoSeuCodigo','produtoSeuCodigo','SeuCodigo','seuCodigo','ProdutoCodigo','produtoCodigo','Produtocodigo','CodigoProduto','codigoProduto'])
    const quantidade = valorNumerico(obj, ['ItemNfQtde','ItemNFQtde','Quantidade','quantidade','Qtde','qtde'])
    let unitario = valorNumerico(obj, ['ItemNfValorUnitario','ItemNFValorUnitario','ValorUnitario','valorUnitario','CustoUnitario','custoUnitario','CustoVlr','custoVlr','ItemNfValor','ItemNFValor'])
    const total = valorNumerico(obj, ['ItemNfValorTotal','ItemNFValorTotal','ValorTotal','valorTotal','Total','total'])
    if (unitario === null && total !== null && quantidade !== null && quantidade > 0) unitario = total / quantidade
    const chave = normalizarCodigo(codigo)
    if (chave && unitario !== null && unitario > 0) {
      const atual = acumulado.get(chave)
      acumulado.set(chave, atual ? {
        codigo: atual.codigo || codigo,
        ultimo: unitario,
        minimo: Math.min(atual.minimo, unitario),
        maximo: Math.max(atual.maximo, unitario),
      } : { codigo, ultimo: unitario, minimo: unitario, maximo: unitario })
    }
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
}

function isoData(d: Date) { return d.toISOString().slice(0, 10) }

async function custosComprasWVetro(maxNotas = 50) {
  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - 90)
  const notas = await listarNotasEntradaWVetro<unknown>(isoData(inicio), isoData(fim))
  const ids = extrairIdsNotas(notas).slice(0, Math.max(1, Math.min(50, maxNotas)))
  const mapa = new Map<string, CustoObservado>()
  for (let i = 0; i < ids.length; i += 5) {
    const lote = ids.slice(i, i + 5)
    const detalhes = await Promise.all(lote.map(id => listarItensNotaEntradaWVetro<unknown>(id)))
    detalhes.forEach(payload => extrairCustos(payload, mapa))
  }
  return { mapa, notasConsultadas: ids.length }
}

export async function POST(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  const status = statusConfiguracaoWVetro()
  if (!status.pronto) return NextResponse.json({ error: 'Credenciais W.Vetro não configuradas no servidor.' }, { status: 503 })

  try {
    const body = await req.json().catch(() => ({}))
    const maxNotas = Number(body?.maxNotas || 50)

    // Catálogo/imagens e Compras são independentes. Um 403 em Compras não pode
    // bloquear a importação de produtos, códigos e desenhos.
    let catalogo: unknown = null
    let catalogoErro: string | null = null
    try {
      catalogo = await descobrirEImportarCatalogoWVetro('A')
    } catch (e) {
      catalogoErro = e instanceof Error ? e.message : 'Falha ao consultar catálogo W.Vetro.'
    }

    let mapa = new Map<string, CustoObservado>()
    let notasConsultadas = 0
    let comprasErro: string | null = null
    try {
      const compras = await custosComprasWVetro(maxNotas)
      mapa = compras.mapa
      notasConsultadas = compras.notasConsultadas
    } catch (e) {
      comprasErro = e instanceof Error ? e.message : 'Falha ao consultar Compras/NF no W.Vetro.'
    }

    const { data: produtos, error: erroProdutos } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,codigo_origem,id_externo_wvetro,custo')
      .eq('categoria', 'acessorio')
    if (erroProdutos) throw erroProdutos

    let custosAtualizados = 0
    const atualizacoes: Promise<unknown>[] = []
    for (const produto of produtos || []) {
      if (Number(produto.custo) > 0) continue
      const chaves = [produto.codigo, produto.codigo_origem, produto.id_externo_wvetro].map(normalizarCodigo).filter(Boolean)
      const custo = chaves.map(chave => mapa.get(chave)).find(Boolean)
      if (!custo) continue
      custosAtualizados += 1
      const atualizacao = supabaseAdmin.from('produtos').update({
        custo: custo.ultimo,
        custo_wvetro_ultimo: custo.ultimo,
        custo_wvetro_min: custo.minimo,
        custo_wvetro_max: custo.maximo,
        custo_wvetro_atualizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', produto.id)
      atualizacoes.push(Promise.resolve(atualizacao).then(() => undefined))
      if (atualizacoes.length >= 20) await Promise.all(atualizacoes.splice(0, atualizacoes.length))
    }
    if (atualizacoes.length) await Promise.all(atualizacoes)

    // Reprocessa imagens mesmo quando Compras/NF estiver sem permissão.
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
        encontradosNoWVetro: mapa.size,
        atualizados: custosAtualizados,
        semCusto: semCusto || 0,
        erro: comprasErro,
        acessoCompras: comprasErro?.includes('403') ? 'sem_permissao' : comprasErro ? 'erro' : 'ok',
      },
      imagens,
      imagensErro,
      observacao: comprasErro
        ? 'Catálogo e imagens continuam sendo sincronizados. O W.Vetro bloqueou a consulta de Compras/NF; custos novos dependem dessa permissão ou da base histórica já importada.'
        : 'Custos existentes no Atlas não são sobrescritos. Itens sem histórico de compra no W.Vetro permanecem pendentes.',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar produtos W.Vetro.' }, { status: 500 })
  }
}
