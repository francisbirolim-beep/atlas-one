import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(v: unknown, max = 500) {
  return String(v ?? '').trim().slice(0, max)
}

function numero(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const vendaId = texto(body.vendaId, 80)
    const tipo = texto(body.tipo, 80) || 'Outro custo'
    const descricao = texto(body.descricao, 300) || tipo
    const valor = numero(body.valor)
    const fornecedor = texto(body.fornecedor, 250)
    const pedido = texto(body.pedido, 120)
    const prazo = texto(body.prazo, 120)
    const previsao = texto(body.previsao, 30)
    const observacoes = texto(body.observacoes, 1000)

    if (!vendaId) return NextResponse.json({ error: 'Venda inválida.' }, { status: 400 })
    if (valor <= 0) return NextResponse.json({ error: 'Informe um valor válido para o custo.' }, { status: 400 })

    const { data: venda, error: vendaError } = await supabaseAdmin
      .from('vendas_obras')
      .select('id,numero,obra_id,cliente_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', vendaId)
      .maybeSingle()
    if (vendaError) throw new Error(vendaError.message)
    if (!venda?.obra_id) return NextResponse.json({ error: 'A venda ainda não possui obra vinculada.' }, { status: 409 })

    const agora = new Date().toISOString()
    const linhas = [
      `[Atlas Custos] ${agora} · ${usuario.nome} · custo_extra_manual`,
      fornecedor ? `Fornecedor: ${fornecedor}` : '',
      pedido ? `Pedido: ${pedido}` : '',
      `Valor total: ${valor}`,
      prazo ? `Prazo: ${prazo}` : '',
      previsao ? `Previsão: ${previsao}` : '',
      observacoes ? `Observação compra: ${observacoes}` : '',
    ].filter(Boolean)

    const { data, error } = await supabaseAdmin
      .from('compras_necessidades')
      .insert({
        empresa_id: usuario.empresa_id,
        obra_id: venda.obra_id,
        cliente_id: venda.cliente_id,
        descricao: `Custo extra - ${descricao}`,
        categoria: 'outros',
        quantidade: 1,
        unidade: 'UN',
        status: 'aprovado',
        observacoes: linhas.join('\n'),
        prioridade: 'normal',
        created_at: agora,
        updated_at: agora,
      })
      .select('id,descricao,categoria,quantidade,unidade,status,observacoes,created_at')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, custo: data })
  } catch (error) {
    console.error('[Vendas][custos-extra]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível lançar o custo extra.' }, { status: 500 })
  }
}
