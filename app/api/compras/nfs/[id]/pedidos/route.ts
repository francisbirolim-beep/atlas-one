import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_VINCULAVEIS = ['aprovado', 'pedido_emitido', 'aguardando_entrega', 'recebido']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function falha(error: any) {
  const mensagem = String(error?.message || '')
  if (error?.code === '42P01' || error?.code === 'PGRST205' || mensagem.includes('compras_nf_pedidos_vinculos') && mensagem.includes('schema cache')) {
    return NextResponse.json({ error: 'O vínculo pedido/NF ainda não foi habilitado no banco. A migração da versão de testes precisa ser aplicada após aprovação.' }, { status: 503 })
  }
  if (error?.code === '23505') return NextResponse.json({ error: 'Este item já está vinculado ao pedido.' }, { status: 409 })
  const motivos = [
    'não pertence à empresa', 'Fornecedor da NF', 'fornecedor da NF', 'Produtos diferentes',
    'Unidades diferentes', 'Quantidade vinculada excede', 'pedido ainda não foi aprovado',
    'NF cancelada', 'Já houve recebimento físico',
  ]
  if (motivos.some(m => mensagem.toLowerCase().includes(m.toLowerCase()))) {
    return NextResponse.json({ error: mensagem }, { status: 409 })
  }
  console.error('Compras: associação NF-pedido', error)
  return NextResponse.json({ error: 'Não foi possível conferir o vínculo entre pedido e nota fiscal.' }, { status: 500 })
}

async function verificarNf(id: string, empresaId: string) {
  if (!UUID.test(id)) return null
  const { data, error } = await supabaseAdmin.from('compras_nfs')
    .select('id,status,numero,fornecedor_id,fornecedor_nome')
    .eq('empresa_id', empresaId).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const nf = await verificarNf(params.id, usuario.empresa_id)
    if (!nf) return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    const { data: itens, error: erroItens } = await supabaseAdmin.from('compras_nf_itens')
      .select('id,produto_id,descricao,unidade,quantidade,codigo_fornecedor')
      .eq('empresa_id', usuario.empresa_id).eq('nf_id', nf.id).order('created_at')
    if (erroItens) throw erroItens

    const produtosIds = Array.from(new Set((itens || []).map(i => i.produto_id).filter(Boolean)))
    const produtos = new Map<string, { id: string; codigo: string | null; nome: string; foto_url: string | null }>()
    if (produtosIds.length) {
      const { data: registros, error: erroProdutos } = await supabaseAdmin.from('produtos')
        .select('id,codigo,nome,foto_url').eq('empresa_id', usuario.empresa_id).in('id', produtosIds)
      if (erroProdutos) throw erroProdutos
      for (const p of registros || []) produtos.set(p.id, p)
    }

    const idsItens = (itens || []).map(i => i.id)
    const { data: vinculos, error: erroVinculos } = idsItens.length
      ? await supabaseAdmin.from('compras_nf_pedidos_vinculos')
        .select('id,nf_item_id,necessidade_id,quantidade,created_at')
        .eq('empresa_id', usuario.empresa_id).in('nf_item_id', idsItens)
      : { data: [], error: null }
    if (erroVinculos) throw erroVinculos

    const { data: cotacoes, error: erroCotacoes } = nf.fornecedor_id
      ? await supabaseAdmin.from('compras_cotacoes')
        .select('necessidade_id').eq('empresa_id', usuario.empresa_id)
        .eq('fornecedor_id', nf.fornecedor_id).eq('selecionada', true).limit(2000)
      : { data: [], error: null }
    if (erroCotacoes) throw erroCotacoes

    const idsPedidos = Array.from(new Set([
      ...(cotacoes || []).map(c => c.necessidade_id),
      ...(vinculos || []).map(v => v.necessidade_id),
    ]))
    const { data: pedidos, error: erroPedidos } = idsPedidos.length
      ? await supabaseAdmin.from('compras_necessidades')
        .select('id,produto_id,descricao,unidade,quantidade,status,destino,cliente_nome,obra_nome,cliente_id,obra_id')
        .eq('empresa_id', usuario.empresa_id).in('id', idsPedidos)
        .in('status', STATUS_VINCULAVEIS).order('updated_at', { ascending: false })
      : { data: [], error: null }
    if (erroPedidos) throw erroPedidos

    const pedidosValidos = (pedidos || [])
    const idsValidos = pedidosValidos.map(p => p.id)
    const { data: alocacoesGlobais, error: erroAlocacoes } = idsValidos.length
      ? await supabaseAdmin.from('compras_nf_pedidos_vinculos')
        .select('necessidade_id,quantidade').eq('empresa_id', usuario.empresa_id)
        .in('necessidade_id', idsValidos)
      : { data: [], error: null }
    if (erroAlocacoes) throw erroAlocacoes
    const acumulado = new Map<string, number>()
    for (const a of alocacoesGlobais || []) acumulado.set(a.necessidade_id, (acumulado.get(a.necessidade_id) || 0) + Number(a.quantidade || 0))

    return NextResponse.json({
      nf, itens: (itens || []).map(i => ({ ...i, produto: i.produto_id ? produtos.get(i.produto_id) || null : null })), vinculos: vinculos || [],
      pedidos: pedidosValidos.map(p => ({
        ...p, quantidade_vinculada: acumulado.get(p.id) || 0,
        fornecedor_conferido: (cotacoes || []).some(c => c.necessidade_id === p.id),
      })),
      aviso: 'Vincular um pedido não recebe mercadoria, não reserva estoque e não cria cobrança. O recebimento físico permanece em sua etapa separada.',
    })
  } catch (error) {
    return falha(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const nf = await verificarNf(params.id, usuario.empresa_id)
    if (!nf) return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    if (nf.status === 'cancelada') return NextResponse.json({ error: 'Nota fiscal cancelada.' }, { status: 409 })
    const body = await req.json()
    const itemId = String(body.nfItemId || '').trim()
    const pedidoId = String(body.necessidadeId || '').trim()
    const quantidade = Number(body.quantidade)
    if (!UUID.test(itemId) || !UUID.test(pedidoId) || !Number.isFinite(quantidade) || quantidade <= 0) {
      return NextResponse.json({ error: 'Selecione item, pedido e quantidade positiva.' }, { status: 400 })
    }

    const [{ data: item, error: erroItem }, { data: pedido, error: erroPedido }] = await Promise.all([
      supabaseAdmin.from('compras_nf_itens').select('id').eq('empresa_id', usuario.empresa_id).eq('nf_id', nf.id).eq('id', itemId).maybeSingle(),
      supabaseAdmin.from('compras_necessidades').select('id').eq('empresa_id', usuario.empresa_id).eq('id', pedidoId).maybeSingle(),
    ])
    if (erroItem || erroPedido) throw erroItem || erroPedido
    if (!item || !pedido) return NextResponse.json({ error: 'Item ou pedido não pertence a esta empresa.' }, { status: 404 })

    const { data, error } = await supabaseAdmin.from('compras_nf_pedidos_vinculos').insert({
      empresa_id: usuario.empresa_id, nf_item_id: itemId, necessidade_id: pedidoId,
      quantidade, criado_por_id: usuario.id, criado_por_nome: usuario.nome,
    }).select('id,nf_item_id,necessidade_id,quantidade,created_at').single()
    if (error) throw error
    return NextResponse.json({ vinculo: data }, { status: 201 })
  } catch (error) {
    return falha(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const nf = await verificarNf(params.id, usuario.empresa_id)
    if (!nf) return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    const body = await req.json()
    const vinculoId = String(body.vinculoId || '')
    if (!UUID.test(vinculoId)) return NextResponse.json({ error: 'Vínculo inválido.' }, { status: 400 })
    const { data: vinculo, error: erroVinculo } = await supabaseAdmin.from('compras_nf_pedidos_vinculos')
      .select('id,nf_item_id').eq('id', vinculoId).eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (erroVinculo) throw erroVinculo
    if (!vinculo) return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 })
    const { data: item, error: erroItem } = await supabaseAdmin.from('compras_nf_itens')
      .select('id').eq('id', vinculo.nf_item_id).eq('nf_id', nf.id).eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (erroItem) throw erroItem
    if (!item) return NextResponse.json({ error: 'Vínculo não pertence à nota fiscal.' }, { status: 404 })
    const { error } = await supabaseAdmin.from('compras_nf_pedidos_vinculos')
      .delete().eq('id', vinculo.id).eq('empresa_id', usuario.empresa_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return falha(error)
  }
}
