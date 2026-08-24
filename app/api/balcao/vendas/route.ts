import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario, parseNumero } from '@/lib/balcaoServer'

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
    let query = supabaseAdmin
      .from('balcao_vendas')
      .select('id,numero,status,atendimento_status,cliente_nome,vendedor_nome,subtotal,desconto,total,finalizada_em')
      .order('finalizada_em', { ascending: false })
      .limit(150)
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

    const temPrazo = pagamentos.some((p: any) => ['boleto', 'a_prazo'].includes(String(p.forma || '')))
    if (temPrazo && !body.clienteId) {
      return NextResponse.json({ error: 'Identifique o cliente para venda por boleto ou a prazo.' }, { status: 400 })
    }

    const { data: caixa, error: erroCaixa } = await supabaseAdmin.from('balcao_caixas')
      .select('id,status,operador_id,ponto_caixa_id,unidade_id,local_estoque_id')
      .eq('operador_id', usuario.id)
      .eq('status', 'aberto')
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroCaixa) throw erroCaixa
    if (!caixa) return NextResponse.json({ error: 'Abra o caixa antes de finalizar a venda.' }, { status: 409 })
    if (!caixa.local_estoque_id || !caixa.unidade_id || !caixa.ponto_caixa_id) {
      return NextResponse.json({ error: 'O caixa aberto não está vinculado a uma unidade/local de estoque.' }, { status: 409 })
    }

    const payloadItens = itens.map((i: any) => ({
      produtoId: String(i.produtoId || ''),
      quantidade: parseNumero(i.quantidade),
      precoUnitario: parseNumero(i.precoUnitario),
      localOrigemId: String(i.localOrigemId || caixa.local_estoque_id),
      atendimento: String(i.atendimento || (String(i.localOrigemId || caixa.local_estoque_id) === caixa.local_estoque_id ? 'imediato' : 'posterior')),
    }))
    const payloadPagamentos = pagamentos.map((p: any) => ({
      forma: String(p.forma || ''),
      valor: parseNumero(p.valor),
      parcelas: Math.max(1, Math.floor(parseNumero(p.parcelas, 1))),
      detalhes: String(p.detalhes || ''),
      primeiroVencimento: String(p.primeiroVencimento || ''),
      intervaloDias: Math.max(1, Math.floor(parseNumero(p.intervaloDias, 30))),
    }))

    const nivelGestao = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
    const podeAutorizarAbaixoMinimo = nivelGestao === 'edicao'
    const ids = [...new Set(payloadItens.map((i: any) => i.produtoId).filter(Boolean))]
    const { data: produtos } = ids.length
      ? await supabaseAdmin.from('produtos').select('id,nome,preco_minimo').in('id', ids)
      : { data: [] as any[] }
    const mapa = new Map((produtos || []).map((p: any) => [p.id, p]))
    const subtotal = payloadItens.reduce((s: number, i: any) => s + i.quantidade * i.precoUnitario, 0)
    const desconto = Math.max(0, parseNumero(body.desconto))
    const total = subtotal - desconto
    const totalMinimo = payloadItens.reduce((s: number, i: any) => {
      const p: any = mapa.get(i.produtoId)
      return s + (p?.preco_minimo == null ? 0 : Number(p.preco_minimo) * i.quantidade)
    }, 0)
    if (!podeAutorizarAbaixoMinimo && total + 0.01 < totalMinimo) {
      return NextResponse.json({ error: `O desconto leva a venda abaixo do preço mínimo autorizado. Mínimo desta venda: R$ ${totalMinimo.toFixed(2)}.` }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin.rpc('finalizar_venda_balcao', {
      p_caixa_id: caixa.id,
      p_usuario_id: usuario.id,
      p_usuario_nome: usuario.nome,
      p_usuario_role: usuario.role,
      p_cliente_id: body.clienteId || null,
      p_cliente_nome: String(body.clienteNome || '').trim() || null,
      p_itens: payloadItens,
      p_pagamentos: payloadPagamentos,
      p_desconto: desconto,
      p_observacoes: String(body.observacoes || '').trim() || null,
      p_permitir_abaixo_minimo: podeAutorizarAbaixoMinimo,
    })
    if (error) throw error
    return NextResponse.json(data || { ok: true })
  } catch (e: any) {
    console.error('Erro finalização venda balcão', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível finalizar a venda.' }, { status: 400 })
  }
}
