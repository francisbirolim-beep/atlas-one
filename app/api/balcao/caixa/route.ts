import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, parseNumero } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function carregarCaixa(usuarioId: string, role: string, id?: string | null) {
  let q = supabaseAdmin.from('balcao_caixas').select('*')
  if (id) q = q.eq('id', id)
  else q = q.eq('status', 'aberto').eq('operador_id', usuarioId)
  const { data } = await q.order('aberto_em', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  if (role !== 'master' && data.operador_id !== usuarioId) return null
  return data
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso ao balcão.' }, { status: 403 })
  try {
    const caixa = await carregarCaixa(usuario.id, usuario.role, req.nextUrl.searchParams.get('id'))
    if (!caixa) return NextResponse.json({ ok: true, caixa: null, movimentos: [], resumo: {} })
    const { data: movimentos } = await supabaseAdmin
      .from('balcao_caixa_movimentos')
      .select('*')
      .eq('caixa_id', caixa.id)
      .order('created_at', { ascending: false })
      .limit(300)
    const lista = movimentos || []
    const resumo: Record<string, { entradas: number; saidas: number }> = {}
    for (const m of lista) {
      const forma = m.forma_pagamento || (m.tipo === 'suprimento' || m.tipo === 'sangria' ? 'dinheiro' : 'outros')
      if (!resumo[forma]) resumo[forma] = { entradas: 0, saidas: 0 }
      resumo[forma].entradas += Number(m.entrada || 0)
      resumo[forma].saidas += Number(m.saida || 0)
    }
    const dinheiro = resumo.dinheiro || { entradas: 0, saidas: 0 }
    const saldoFisicoEsperado = Number(caixa.saldo_inicial || 0) + dinheiro.entradas - dinheiro.saidas
    return NextResponse.json({ ok: true, caixa, movimentos: lista, resumo, saldoFisicoEsperado })
  } catch (e) {
    console.error('Erro ao carregar caixa balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar o caixa.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'caixa-balcao', 'edicao')
  if (!usuario) return NextResponse.json({ error: 'Sem permissão para operar o caixa.' }, { status: 403 })
  try {
    const body = await req.json()
    const acao = String(body.acao || '')
    if (acao === 'abrir') {
      const existente = await carregarCaixa(usuario.id, usuario.role)
      if (existente) return NextResponse.json({ error: 'Você já possui um caixa aberto.' }, { status: 409 })
      const saldoInicial = Math.max(0, parseNumero(body.saldoInicial))
      const { data: caixa, error } = await supabaseAdmin.from('balcao_caixas').insert({
        operador_id: usuario.id, operador_nome: usuario.nome, saldo_inicial: saldoInicial,
        observacoes: String(body.observacoes || '').trim() || null,
      }).select('*').single()
      if (error) throw error
      await supabaseAdmin.from('balcao_caixa_movimentos').insert({
        caixa_id: caixa.id, tipo: 'abertura', forma_pagamento: 'dinheiro', entrada: 0, saida: 0,
        descricao: `Abertura do caixa • saldo inicial R$ ${saldoInicial.toFixed(2)}`,
        criado_por_id: usuario.id, criado_por_nome: usuario.nome,
      })
      return NextResponse.json({ ok: true, caixa })
    }

    const caixa = await carregarCaixa(usuario.id, usuario.role, body.caixaId)
    if (!caixa || caixa.status !== 'aberto') return NextResponse.json({ error: 'Caixa aberto não encontrado.' }, { status: 404 })

    if (acao === 'suprimento' || acao === 'sangria') {
      const valor = parseNumero(body.valor)
      if (valor <= 0) return NextResponse.json({ error: 'Informe um valor maior que zero.' }, { status: 400 })
      const { error } = await supabaseAdmin.from('balcao_caixa_movimentos').insert({
        caixa_id: caixa.id, tipo: acao, forma_pagamento: 'dinheiro',
        entrada: acao === 'suprimento' ? valor : 0,
        saida: acao === 'sangria' ? valor : 0,
        descricao: String(body.descricao || '').trim() || (acao === 'suprimento' ? 'Suprimento de caixa' : 'Sangria de caixa'),
        criado_por_id: usuario.id, criado_por_nome: usuario.nome,
      })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (acao === 'fechar') {
      const saldoContado = parseNumero(body.saldoContado, -1)
      if (saldoContado < 0) return NextResponse.json({ error: 'Informe o saldo contado em dinheiro.' }, { status: 400 })
      const { data: movimentos } = await supabaseAdmin.from('balcao_caixa_movimentos').select('tipo,forma_pagamento,entrada,saida').eq('caixa_id', caixa.id)
      let entradasDinheiro = 0; let saidasDinheiro = 0
      for (const m of movimentos || []) {
        const forma = m.forma_pagamento || ((m.tipo === 'suprimento' || m.tipo === 'sangria') ? 'dinheiro' : '')
        if (forma === 'dinheiro') { entradasDinheiro += Number(m.entrada || 0); saidasDinheiro += Number(m.saida || 0) }
      }
      const esperado = Number(caixa.saldo_inicial || 0) + entradasDinheiro - saidasDinheiro
      const diferenca = saldoContado - esperado
      const agora = new Date().toISOString()
      const { error } = await supabaseAdmin.from('balcao_caixas').update({
        status: 'fechado', fechado_em: agora, fechado_por_id: usuario.id, fechado_por_nome: usuario.nome,
        saldo_esperado: esperado, saldo_contado: saldoContado, diferenca,
        observacoes: String(body.observacoes || '').trim() || caixa.observacoes || null, updated_at: agora,
      }).eq('id', caixa.id).eq('status', 'aberto')
      if (error) throw error
      await supabaseAdmin.from('balcao_caixa_movimentos').insert({
        caixa_id: caixa.id, tipo: 'fechamento', forma_pagamento: 'dinheiro', entrada: 0, saida: 0,
        descricao: `Fechamento • esperado R$ ${esperado.toFixed(2)} • contado R$ ${saldoContado.toFixed(2)}`,
        criado_por_id: usuario.id, criado_por_nome: usuario.nome,
      })
      return NextResponse.json({ ok: true, saldoEsperado: esperado, saldoContado, diferenca })
    }

    return NextResponse.json({ error: 'Ação de caixa inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro operação caixa balcão', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao operar o caixa.' }, { status: 500 })
  }
}
