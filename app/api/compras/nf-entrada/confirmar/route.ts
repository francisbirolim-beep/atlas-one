import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemEntrada = {
  codigoFornecedor?: string
  descricao?: string
  ncm?: string
  cfop?: string
  unidade?: string
  quantidade?: number | null
  valorUnitario?: number | null
  valorTotal?: number | null
  produtoId?: string | null
  vinculoStatus?: 'vinculado' | 'pendente' | 'ambiguo'
  dadosOrigem?: Record<string, unknown>
}

type PayloadEntrada = {
  origem?: 'xml' | 'pdf' | 'manual'
  chaveAcesso?: string
  numero?: string
  serie?: string
  dataEmissao?: string
  fornecedorId?: string | null
  fornecedorNome?: string
  fornecedorCnpj?: string
  valorProdutos?: number | null
  valorTotal?: number | null
  observacoes?: string
  aplicarCustos?: boolean
  itens?: ItemEntrada[]
}

function somenteDigitos(valor: unknown) {
  return String(valor ?? '').replace(/\D/g, '')
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function texto(valor: unknown, max = 500) {
  return String(valor ?? '').trim().slice(0, max)
}

function nomeSeguro(nome: string) {
  const base = nome.split(/[\\/]/).pop() || 'nota'
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)
}

async function autenticar(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario || null
}

async function resolverFornecedor(payload: PayloadEntrada, usuario: { id: string; nome: string }) {
  if (payload.fornecedorId) {
    const { data } = await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').eq('id', payload.fornecedorId).maybeSingle()
    if (data) return data
  }

  const cnpj = somenteDigitos(payload.fornecedorCnpj)
  if (cnpj) {
    const { data } = await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').not('cnpj_cpf', 'is', null)
    const existente = (data || []).find(item => somenteDigitos(item.cnpj_cpf) === cnpj)
    if (existente) return existente
  }

  const nome = texto(payload.fornecedorNome, 200)
  if (!nome && !cnpj) return null

  const { data, error } = await supabaseAdmin
    .from('fornecedores')
    .insert({
      nome: nome || `Fornecedor ${cnpj}`,
      cnpj_cpf: cnpj || null,
      ativo: true,
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
      observacoes: 'Criado a partir da confirmação de uma NF de entrada no Atlas.',
    })
    .select('id,nome,cnpj_cpf')
    .single()

  if (error) throw new Error(`Não foi possível cadastrar o fornecedor: ${error.message}`)
  return data
}

export async function POST(req: NextRequest) {
  const usuario = await autenticar(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  let arquivoPath: string | null = null

  try {
    const form = await req.formData()
    const payloadBruto = String(form.get('payload') || '')
    if (!payloadBruto) return NextResponse.json({ error: 'Dados da nota não enviados.' }, { status: 400 })

    let payload: PayloadEntrada
    try {
      payload = JSON.parse(payloadBruto)
    } catch {
      return NextResponse.json({ error: 'Dados da nota estão em formato inválido.' }, { status: 400 })
    }

    const origem = payload.origem
    if (!origem || !['xml', 'pdf', 'manual'].includes(origem)) {
      return NextResponse.json({ error: 'Origem da entrada inválida.' }, { status: 400 })
    }

    const itens = Array.isArray(payload.itens) ? payload.itens : []
    if (!itens.length) {
      return NextResponse.json({ error: 'Inclua pelo menos um item antes de confirmar a entrada.' }, { status: 400 })
    }

    const itensValidos = itens.map((item, indice) => {
      const descricao = texto(item.descricao, 500)
      const quantidade = numero(item.quantidade)
      const valorUnitario = numero(item.valorUnitario)
      let valorTotal = numero(item.valorTotal)
      if (!descricao) throw new Error(`Item ${indice + 1}: informe a descrição.`)
      if (quantidade === null || quantidade <= 0) throw new Error(`Item ${indice + 1}: quantidade inválida.`)
      if (valorUnitario !== null && valorTotal === null) valorTotal = quantidade * valorUnitario
      return { ...item, descricao, quantidade, valorUnitario, valorTotal }
    })

    const chave = somenteDigitos(payload.chaveAcesso).slice(0, 44)
    if (chave) {
      const { data: duplicada } = await supabaseAdmin.from('compras_nfs').select('id,numero').eq('chave_acesso', chave).maybeSingle()
      if (duplicada) {
        return NextResponse.json({ error: `Esta NF-e já foi lançada no Atlas${duplicada.numero ? ` (NF ${duplicada.numero})` : ''}.` }, { status: 409 })
      }
    }

    const fornecedor = await resolverFornecedor(payload, usuario)

    const produtoIds = Array.from(new Set(itensValidos.map(i => texto(i.produtoId, 80)).filter(Boolean)))
    const produtosMap = new Map<string, { id: string; custo: number | null }>()
    if (produtoIds.length) {
      const { data, error } = await supabaseAdmin.from('produtos').select('id,custo').in('id', produtoIds)
      if (error) throw new Error(`Não foi possível validar os produtos vinculados: ${error.message}`)
      for (const p of data || []) produtosMap.set(p.id, { id: p.id, custo: p.custo == null ? null : Number(p.custo) })
      const inexistentes = produtoIds.filter(id => !produtosMap.has(id))
      if (inexistentes.length) throw new Error('Um ou mais produtos vinculados não existem mais no catálogo do Atlas.')
    }

    const arquivo = form.get('arquivo')
    let arquivoNome: string | null = null
    if (arquivo instanceof File && arquivo.size > 0) {
      if (arquivo.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'O arquivo excede 15 MB.' }, { status: 413 })
      const extOk = origem === 'xml' ? arquivo.name.toLowerCase().endsWith('.xml') : origem === 'pdf' ? arquivo.name.toLowerCase().endsWith('.pdf') : true
      if (!extOk) return NextResponse.json({ error: `O arquivo não corresponde ao modo ${origem.toUpperCase()}.` }, { status: 400 })

      arquivoNome = arquivo.name
      const caminho = `${usuario.id}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${nomeSeguro(arquivo.name)}`
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      const { error } = await supabaseAdmin.storage.from('compras-nfs').upload(caminho, buffer, {
        contentType: arquivo.type || (origem === 'xml' ? 'application/xml' : 'application/pdf'),
        upsert: false,
      })
      if (error) throw new Error(`Não foi possível guardar o arquivo original: ${error.message}`)
      arquivoPath = caminho
    }

    const agora = new Date().toISOString()
    const { data: nf, error: nfError } = await supabaseAdmin
      .from('compras_nfs')
      .insert({
        origem_entrada: origem,
        status: 'confirmada',
        chave_acesso: chave || null,
        numero: texto(payload.numero, 40) || null,
        serie: texto(payload.serie, 20) || null,
        data_emissao: payload.dataEmissao ? new Date(payload.dataEmissao).toISOString() : null,
        data_entrada: agora,
        fornecedor_id: fornecedor?.id || null,
        fornecedor_nome: texto(payload.fornecedorNome || fornecedor?.nome, 250) || null,
        fornecedor_cnpj: somenteDigitos(payload.fornecedorCnpj || fornecedor?.cnpj_cpf) || null,
        valor_produtos: numero(payload.valorProdutos),
        valor_total: numero(payload.valorTotal),
        arquivo_nome: arquivoNome,
        arquivo_path: arquivoPath,
        observacoes: texto(payload.observacoes, 2000) || null,
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
        confirmado_em: agora,
        confirmado_por_id: usuario.id,
        confirmado_por_nome: usuario.nome,
      })
      .select('id,numero')
      .single()

    if (nfError) throw new Error(`Não foi possível registrar a NF: ${nfError.message}`)

    const linhas = itensValidos.map(item => {
      const produtoId = texto(item.produtoId, 80) || null
      const produto = produtoId ? produtosMap.get(produtoId) : null
      const aplicar = Boolean(payload.aplicarCustos && produto && item.valorUnitario !== null)
      return {
        nf_id: nf.id,
        produto_id: produtoId,
        codigo_fornecedor: texto(item.codigoFornecedor, 120) || null,
        descricao: item.descricao,
        ncm: texto(item.ncm, 20) || null,
        cfop: texto(item.cfop, 20) || null,
        unidade: texto(item.unidade, 30) || null,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        custo_unitario: item.valorUnitario,
        vinculo_status: produtoId ? 'vinculado' : item.vinculoStatus === 'ambiguo' ? 'ambiguo' : 'pendente',
        custo_anterior: produto?.custo ?? null,
        custo_aplicado: aplicar,
        dados_origem: item.dadosOrigem || null,
      }
    })

    const { error: itensError } = await supabaseAdmin.from('compras_nf_itens').insert(linhas)
    if (itensError) {
      await supabaseAdmin.from('compras_nfs').delete().eq('id', nf.id)
      if (arquivoPath) await supabaseAdmin.storage.from('compras-nfs').remove([arquivoPath])
      throw new Error(`Não foi possível registrar os itens da NF: ${itensError.message}`)
    }

    let custosAtualizados = 0
    const avisos: string[] = []
    if (payload.aplicarCustos) {
      for (const item of itensValidos) {
        const produtoId = texto(item.produtoId, 80)
        if (!produtoId || item.valorUnitario === null) continue
        const { error } = await supabaseAdmin
          .from('produtos')
          .update({
            custo: item.valorUnitario,
            fornecedor_id: fornecedor?.id || undefined,
            updated_at: agora,
          })
          .eq('id', produtoId)
        if (error) avisos.push(`Não foi possível atualizar o custo do produto vinculado ao código ${texto(item.codigoFornecedor, 80) || produtoId}.`)
        else custosAtualizados += 1
      }
    }

    return NextResponse.json({
      ok: true,
      nfId: nf.id,
      numero: nf.numero,
      itensRegistrados: linhas.length,
      itensPendentes: linhas.filter(i => i.vinculo_status !== 'vinculado').length,
      custosAtualizados,
      arquivoGuardado: Boolean(arquivoPath),
      avisos,
    })
  } catch (error) {
    if (arquivoPath) await supabaseAdmin.storage.from('compras-nfs').remove([arquivoPath]).catch(() => undefined)
    console.error('Erro ao confirmar NF de entrada:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao confirmar a entrada.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
