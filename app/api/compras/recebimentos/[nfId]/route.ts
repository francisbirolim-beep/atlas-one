import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemPayload = {
  nfItemId?: string
  quantidadeRecebida?: number | null
  quantidadeAvariada?: number | null
  observacoes?: string
}

type Payload = {
  dataRecebimento?: string
  observacoes?: string
  itens?: ItemPayload[]
}

function numero(valor: unknown, padrao = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : padrao
}

function texto(valor: unknown, max = 1500) {
  return String(valor ?? '').trim().slice(0, max)
}

function nomeSeguro(nome: string) {
  const base = nome.split(/[\\/]/).pop() || 'foto.jpg'
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)
}

function statusItem(quantidadeNf: number, acumulado: number, avariada: number) {
  if (avariada > 0) return 'avaria'
  if (acumulado < quantidadeNf) return 'falta'
  if (acumulado > quantidadeNf) return 'excesso'
  return 'ok'
}

async function carregarBase(nfId: string) {
  const { data: nf, error: nfError } = await supabaseAdmin
    .from('compras_nfs')
    .select('id,numero,serie,data_emissao,data_entrada,fornecedor_nome,fornecedor_cnpj,valor_total,status')
    .eq('id', nfId)
    .maybeSingle()

  if (nfError) throw new Error(nfError.message)
  if (!nf) return null

  const { data: itens, error: itensError } = await supabaseAdmin
    .from('compras_nf_itens')
    .select('id,produto_id,codigo_fornecedor,descricao,unidade,quantidade,valor_unitario,valor_total,vinculo_status')
    .eq('nf_id', nfId)
    .order('created_at', { ascending: true })

  if (itensError) throw new Error(itensError.message)

  const produtoIds = Array.from(new Set((itens || []).map(item => item.produto_id).filter(Boolean)))
  const produtos = new Map<string, { id: string; codigo: string | null; nome: string; unidade: string | null }>()
  if (produtoIds.length) {
    const { data: rows, error } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,nome,unidade')
      .in('id', produtoIds)
    if (error) throw new Error(error.message)
    for (const produto of rows || []) produtos.set(produto.id, produto)
  }

  const { data: recebimentos, error: recebimentosError } = await supabaseAdmin
    .from('compras_recebimentos')
    .select('id,status,data_recebimento,observacoes,recebido_por_nome,created_at')
    .eq('nf_id', nfId)
    .neq('status', 'cancelado')
    .order('data_recebimento', { ascending: false })

  if (recebimentosError) throw new Error(recebimentosError.message)

  const recebimentoIds = (recebimentos || []).map(r => r.id)
  const acumulado = new Map<string, { recebido: number; avariado: number }>()
  const fotosPorRecebimento = new Map<string, Array<{ id: string; nome: string; url: string }>>()

  if (recebimentoIds.length) {
    const { data: anteriores, error } = await supabaseAdmin
      .from('compras_recebimento_itens')
      .select('nf_item_id,quantidade_recebida,quantidade_avariada')
      .in('recebimento_id', recebimentoIds)
    if (error) throw new Error(error.message)
    for (const item of anteriores || []) {
      const atual = acumulado.get(item.nf_item_id) || { recebido: 0, avariado: 0 }
      atual.recebido += numero(item.quantidade_recebida)
      atual.avariado += numero(item.quantidade_avariada)
      acumulado.set(item.nf_item_id, atual)
    }

    const { data: fotos, error: fotosError } = await supabaseAdmin
      .from('compras_recebimento_fotos')
      .select('id,recebimento_id,arquivo_nome,arquivo_path')
      .in('recebimento_id', recebimentoIds)
      .order('created_at', { ascending: true })
    if (fotosError) throw new Error(fotosError.message)

    await Promise.all((fotos || []).map(async foto => {
      const { data } = await supabaseAdmin.storage.from('compras-recebimentos').createSignedUrl(foto.arquivo_path, 600)
      if (!data?.signedUrl) return
      const lista = fotosPorRecebimento.get(foto.recebimento_id) || []
      lista.push({ id: foto.id, nome: foto.arquivo_nome, url: data.signedUrl })
      fotosPorRecebimento.set(foto.recebimento_id, lista)
    }))
  }

  return {
    nf,
    itens: (itens || []).map(item => {
      const qtdNf = numero(item.quantidade)
      const anterior = acumulado.get(item.id) || { recebido: 0, avariado: 0 }
      return {
        ...item,
        produto: item.produto_id ? produtos.get(item.produto_id) || null : null,
        quantidadeNf: qtdNf,
        jaRecebida: anterior.recebido,
        jaAvariada: anterior.avariado,
        saldo: Math.max(0, qtdNf - anterior.recebido),
        statusAcumulado: statusItem(qtdNf, anterior.recebido, anterior.avariado),
      }
    }),
    recebimentos: (recebimentos || []).map(r => ({ ...r, fotos: fotosPorRecebimento.get(r.id) || [] })),
  }
}

export async function GET(req: NextRequest, { params }: { params: { nfId: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const base = await carregarBase(params.nfId)
    if (!base) return NextResponse.json({ error: 'NF não encontrada.' }, { status: 404 })
    return NextResponse.json(base)
  } catch (error) {
    console.error('Erro ao carregar conferência de recebimento:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a conferência.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { nfId: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  let recebimentoId: string | null = null
  const arquivosGuardados: string[] = []

  try {
    const base = await carregarBase(params.nfId)
    if (!base) return NextResponse.json({ error: 'NF não encontrada.' }, { status: 404 })
    if (base.nf.status === 'cancelada') return NextResponse.json({ error: 'Não é possível conferir uma NF cancelada.' }, { status: 409 })

    const form = await req.formData()
    const bruto = String(form.get('payload') || '')
    if (!bruto) return NextResponse.json({ error: 'Dados da conferência não enviados.' }, { status: 400 })

    let payload: Payload
    try {
      payload = JSON.parse(bruto)
    } catch {
      return NextResponse.json({ error: 'Dados da conferência em formato inválido.' }, { status: 400 })
    }

    const itensPayload = Array.isArray(payload.itens) ? payload.itens : []
    if (!itensPayload.length) return NextResponse.json({ error: 'Inclua os itens da conferência.' }, { status: 400 })

    const baseItens = new Map(base.itens.map(item => [item.id, item]))
    const linhas = itensPayload.map((entrada, indice) => {
      const nfItemId = texto(entrada.nfItemId, 80)
      const item = baseItens.get(nfItemId)
      if (!item) throw new Error(`Item ${indice + 1}: item da NF não encontrado.`)

      const recebido = numero(entrada.quantidadeRecebida)
      const avariado = numero(entrada.quantidadeAvariada)
      if (recebido < 0 || avariado < 0) throw new Error(`Item ${indice + 1}: quantidades não podem ser negativas.`)
      if (avariado > recebido) throw new Error(`Item ${indice + 1}: quantidade avariada não pode ser maior que a recebida.`)

      const acumuladoDepois = item.jaRecebida + recebido
      return {
        nf_item_id: item.id,
        produto_id: item.produto_id || null,
        quantidade_nf: item.quantidadeNf,
        quantidade_recebida: recebido,
        quantidade_avariada: avariado,
        status: statusItem(item.quantidadeNf, acumuladoDepois, item.jaAvariada + avariado),
        observacoes: texto(entrada.observacoes, 1000) || null,
      }
    })

    const dataRecebimento = payload.dataRecebimento && !Number.isNaN(new Date(payload.dataRecebimento).getTime())
      ? new Date(payload.dataRecebimento).toISOString()
      : new Date().toISOString()

    const { data: recebimento, error: recebimentoError } = await supabaseAdmin
      .from('compras_recebimentos')
      .insert({
        nf_id: params.nfId,
        status: 'concluido',
        data_recebimento: dataRecebimento,
        observacoes: texto(payload.observacoes, 2000) || null,
        recebido_por_id: usuario.id,
        recebido_por_nome: usuario.nome,
      })
      .select('id')
      .single()

    if (recebimentoError) throw new Error(recebimentoError.message)
    recebimentoId = recebimento.id

    const { error: itensError } = await supabaseAdmin
      .from('compras_recebimento_itens')
      .insert(linhas.map(linha => ({ ...linha, recebimento_id: recebimento.id })))
    if (itensError) throw new Error(itensError.message)

    const fotos = form.getAll('fotos').filter((item): item is File => item instanceof File && item.size > 0)
    if (fotos.length > 4) throw new Error('Envie no máximo 4 fotos por conferência.')

    let totalFotos = 0
    const registrosFotos: Array<Record<string, unknown>> = []
    for (const foto of fotos) {
      if (!foto.type.startsWith('image/')) throw new Error('A conferência aceita apenas arquivos de imagem como foto.')
      totalFotos += foto.size
      if (foto.size > 2 * 1024 * 1024) throw new Error(`A foto ${foto.name} excede 2 MB após compressão.`)
      if (totalFotos > 5 * 1024 * 1024) throw new Error('O conjunto de fotos excede 5 MB.')

      const caminho = `${usuario.id}/${new Date().toISOString().slice(0, 7)}/${recebimento.id}/${randomUUID()}-${nomeSeguro(foto.name)}`
      const buffer = Buffer.from(await foto.arrayBuffer())
      const { error } = await supabaseAdmin.storage.from('compras-recebimentos').upload(caminho, buffer, {
        contentType: foto.type || 'image/jpeg',
        upsert: false,
      })
      if (error) throw new Error(`Não foi possível guardar a foto ${foto.name}: ${error.message}`)
      arquivosGuardados.push(caminho)
      registrosFotos.push({
        recebimento_id: recebimento.id,
        nf_item_id: null,
        arquivo_nome: foto.name,
        arquivo_path: caminho,
        mime_type: foto.type || null,
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
      })
    }

    if (registrosFotos.length) {
      const { error } = await supabaseAdmin.from('compras_recebimento_fotos').insert(registrosFotos)
      if (error) throw new Error(`Não foi possível registrar as fotos: ${error.message}`)
    }

    const divergencias = linhas.filter(linha => linha.status !== 'ok').length
    return NextResponse.json({
      ok: true,
      recebimentoId: recebimento.id,
      itensConferidos: linhas.length,
      divergencias,
      fotosGuardadas: registrosFotos.length,
      estoqueMovimentado: false,
      mensagem: divergencias
        ? `Recebimento registrado com ${divergencias} divergência(s). Nenhum estoque foi movimentado.`
        : 'Recebimento conferido sem divergências. Nenhum estoque foi movimentado.',
    })
  } catch (error) {
    if (arquivosGuardados.length) {
      try { await supabaseAdmin.storage.from('compras-recebimentos').remove(arquivosGuardados) } catch {}
    }
    if (recebimentoId) {
      try { await supabaseAdmin.from('compras_recebimentos').delete().eq('id', recebimentoId) } catch {}
    }
    console.error('Erro ao registrar conferência de recebimento:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao registrar conferência.' }, { status: 500 })
  }
}
