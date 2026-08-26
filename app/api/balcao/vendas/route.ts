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
      const [{ data: itens }, { data: pagamentos }, { data: eventos }, { data: locais }, nivelGestao, { data: caixaAberto }] = await Promise.all([
        supabaseAdmin.from('balcao_venda_itens').select('*').eq('venda_id', id).order('created_at'),
        supabaseAdmin.from('balcao_pagamentos').select('*').eq('venda_id', id).order('created_at'),
        supabaseAdmin.from('balcao_venda_eventos').select('*').eq('venda_id', id).order('created_at', { ascending: false }),
        supabaseAdmin.from('estoque_locais').select('id,codigo,nome,unidade_id').eq('ativo', true).order('nome'),
        nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao'),
        supabaseAdmin.from('balcao_caixas').select('id').eq('operador_id', usuario.id).eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1).maybeSingle(),
      ])
      const eventoIds = (eventos || []).map((e: any) => e.id)
      const { data: eventoItens } = eventoIds.length
        ? await supabaseAdmin.from('balcao_venda_evento_itens').select('*').in('evento_id', eventoIds).order('created_at')
        : { data: [] as any[] }
      return NextResponse.json({
        ok: true,
        venda,
        itens: itens || [],
        pagamentos: pagamentos || [],
        eventos: eventos || [],
        eventoItens: eventoItens || [],
        locaisRetorno: locais || [],
        podeGerenciar: nivelGestao === 'edicao',
        caixaAbertoId: caixaAberto?.id || null,
      })
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

function contextoCliente360(req: NextRequest) {
  let clienteId: string | null = null
  let obraId: string | null = null
  try {
    const referer = req.headers.get('referer')
    if (referer) {
      const url = new URL(referer)
      clienteId = url.searchParams.get('cliente')
      obraId = url.searchParams.get('obra')
    }
  } catch {}
  return { clienteId, obraId }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'edicao')
  if (!usuario) return NextResponse.json({ error: 'Sem permissão para finalizar venda.' }, { status: 403 })
  try {
    const body = await req.json()
    const contexto = contextoCliente360(req)
    let clienteId = String(body.clienteId || contexto.clienteId || '').trim() || null
    const obraId = String(body.obraId || contexto.obraId || '').trim() || null
    let clienteNome = String(body.clienteNome || '').trim() || null

    if (obraId) {
      const { data: obra, error: erroObra } = await supabaseAdmin
        .from('obras')
        .select('id,cliente_id,nome')
        .eq('id', obraId)
        .maybeSingle()
      if (erroObra) throw erroObra
      if (!obra) return NextResponse.json({ error: 'Obra informada não foi encontrada.' }, { status: 400 })
      if (clienteId && obra.cliente_id !== clienteId) return NextResponse.json({ error: 'A obra não pertence ao cliente selecionado.' }, { status: 400 })
      clienteId = obra.cliente_id
    }

    if (clienteId && !clienteNome) {
      const { data: clienteCadastro } = await supabaseAdmin.from('clientes').select('nome').eq('id', clienteId).maybeSingle()
      clienteNome = clienteCadastro?.nome || null
    }

    const itens = Array.isArray(body.itens) ? body.itens : []
    const pagamentos = Array.isArray(body.pagamentos) ? body.pagamentos : []
    if (!itens.length) return NextResponse.json({ error: 'Adicione pelo menos um produto.' }, { status: 400 })
    if (!pagamentos.length) return NextResponse.json({ error: 'Informe a forma de pagamento.' }, { status: 400 })

    const temPrazo = pagamentos.some((p: any) => ['boleto', 'a_prazo'].includes(String(p.forma || '')))
    if (temPrazo && !clienteId) return NextResponse.json({ error: 'Identifique o cliente para venda por boleto ou a prazo.' }, { status: 400 })

    const { data: caixa, error: erroCaixa } = await supabaseAdmin.from('balcao_caixas')
      .select('id,status,operador_id,ponto_caixa_id,unidade_id,local_estoque_id')
      .eq('operador_id', usuario.id).eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1).maybeSingle()
    if (erroCaixa) throw erroCaixa
    if (!caixa) return NextResponse.json({ error: 'Abra o caixa antes de finalizar a venda.' }, { status: 409 })
    if (!caixa.local_estoque_id || !caixa.unidade_id || !caixa.ponto_caixa_id) return NextResponse.json({ error: 'O caixa aberto não está vinculado a uma unidade/local de estoque.' }, { status: 409 })

    const payloadItens = itens.map((i: any) => ({
      produtoId: String(i.produtoId || ''), quantidade: parseNumero(i.quantidade), precoUnitario: parseNumero(i.precoUnitario),
      localOrigemId: String(i.localOrigemId || caixa.local_estoque_id),
      atendimento: String(i.atendimento || (String(i.localOrigemId || caixa.local_estoque_id) === caixa.local_estoque_id ? 'imediato' : 'posterior')),
    }))
    const payloadPagamentos = pagamentos.map((p: any) => ({
      forma: String(p.forma || ''), valor: parseNumero(p.valor), parcelas: Math.max(1, Math.floor(parseNumero(p.parcelas, 1))),
      detalhes: String(p.detalhes || ''), primeiroVencimento: String(p.primeiroVencimento || ''), intervaloDias: Math.max(1, Math.floor(parseNumero(p.intervaloDias, 30))),
    }))

    const nivelGestao = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
    const podeAutorizarAbaixoMinimo = nivelGestao === 'edicao'
    const ids = [...new Set(payloadItens.map((i: any) => i.produtoId).filter(Boolean))]
    const { data: produtos } = ids.length ? await supabaseAdmin.from('produtos').select('id,nome,preco_minimo').in('id', ids) : { data: [] as any[] }
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
      p_caixa_id: caixa.id, p_usuario_id: usuario.id, p_usuario_nome: usuario.nome, p_usuario_role: usuario.role,
      p_cliente_id: clienteId, p_cliente_nome: clienteNome,
      p_itens: payloadItens, p_pagamentos: payloadPagamentos, p_desconto: desconto,
      p_observacoes: String(body.observacoes || '').trim() || null, p_permitir_abaixo_minimo: podeAutorizarAbaixoMinimo,
    })
    if (error) throw error

    const retorno = (data || { ok: true }) as Record<string, any>
    const vendaId = String(retorno.vendaId || retorno.venda_id || '').trim()
    if (obraId && vendaId) {
      const { error: erroVinculo } = await supabaseAdmin.from('balcao_vendas').update({ obra_id: obraId }).eq('id', vendaId)
      if (erroVinculo) throw erroVinculo
      const { error: erroFinanceiro } = await supabaseAdmin.from('financeiro_contas_receber').update({ obra_id: obraId }).eq('venda_balcao_id', vendaId)
      if (erroFinanceiro) throw erroFinanceiro
    }

    return NextResponse.json({ ...retorno, clienteId, clienteNome, obraId })
  } catch (e: any) {
    console.error('Erro finalização venda balcão', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível finalizar a venda.' }, { status: 400 })
  }
}