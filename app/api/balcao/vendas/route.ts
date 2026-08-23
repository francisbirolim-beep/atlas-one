import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, parseNumero } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso à Venda Balcão.' }, { status: 403 })
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const { data: venda, error } = await supabaseAdmin.from('balcao_vendas').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!venda) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
      const [{ data: itens }, { data: pagamentos }] = await Promise.all([
        supabaseAdmin.from('balcao_venda_itens').select('*').eq('venda_id', id).order('created_at'),
        supabaseAdmin.from('balcao_pagamentos').select('*').eq('venda_id', id).order('created_at'),
      ])
      return NextResponse.json({ ok: true, venda, itens: itens || [], pagamentos: pagamentos || [] })
    }

    const q = (req.nextUrl.searchParams.get('q') || '').trim()
    let query = supabaseAdmin.from('balcao_vendas').select('id,numero,status,cliente_nome,vendedor_nome,subtotal,desconto,total,finalizada_em').order('finalizada_em', { ascending: false }).limit(150)
    if (q) {
      const numero = Number(q.replace(/\D/g, ''))
      query = Number.isFinite(numero) && numero > 0
        ? query.or(`cliente_nome.ilike.%${q}%,vendedor_nome.ilike.%${q}%,numero.eq.${numero}`)
        : query.or(`cliente_nome.ilike.%${q}%,vendedor_nome.ilike.%${q}%`)
    }
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true, vendas: data || [] })
  } catch (e) {
    console.error('Erro histórico vendas balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar as vendas.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'edicao')
  if (!usuario) return NextResponse.json({ error: 'Sem permissão para finalizar venda.' }, { status: 403 })
  try {
    const body = await req.json()
    const itens = Array.isArray(body.itens) ? body.itens : []
    const pagamentos = Array.isArray(body.pagamentos) ? body.pagamentos : []
    if (!itens.length) return NextResponse.json({ error: 'Adicione pelo menos um produto.' }, { status: 400 })
    if (!pagamentos.length) return NextResponse.json({ error: 'Informe a forma de pagamento.' }, { status: 400 })

    const { data: caixa } = await supabaseAdmin.from('balcao_caixas')
      .select('id,status,operador_id').eq('operador_id', usuario.id).eq('status', 'aberto')
      .order('aberto_em', { ascending: false }).limit(1).maybeSingle()
    if (!caixa) return NextResponse.json({ error: 'Abra o caixa antes de finalizar a venda.' }, { status: 409 })

    const payloadItens = itens.map((i: any) => ({
      produtoId: String(i.produtoId || ''),
      quantidade: parseNumero(i.quantidade),
      precoUnitario: parseNumero(i.precoUnitario),
    }))
    const payloadPagamentos = pagamentos.map((p: any) => ({
      forma: String(p.forma || ''), valor: parseNumero(p.valor), parcelas: Math.max(1, Math.floor(parseNumero(p.parcelas, 1))), detalhes: String(p.detalhes || ''),
    }))

    const { data, error } = await supabaseAdmin.rpc('finalizar_venda_balcao', {
      p_caixa_id: caixa.id,
      p_usuario_id: usuario.id,
      p_usuario_nome: usuario.nome,
      p_usuario_role: usuario.role,
      p_cliente_id: body.clienteId || null,
      p_cliente_nome: String(body.clienteNome || '').trim() || null,
      p_itens: payloadItens,
      p_pagamentos: payloadPagamentos,
      p_desconto: Math.max(0, parseNumero(body.desconto)),
      p_observacoes: String(body.observacoes || '').trim() || null,
      p_permitir_abaixo_minimo: usuario.role === 'master',
    })
    if (error) throw error
    return NextResponse.json(data || { ok: true })
  } catch (e: any) {
    console.error('Erro finalização venda balcão', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível finalizar a venda.' }, { status: 400 })
  }
}
