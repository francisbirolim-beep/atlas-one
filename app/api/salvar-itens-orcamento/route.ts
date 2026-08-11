import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ItemEsquadria } from '@/lib/tipos'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const body = await req.json()
    const orcamentoId = body?.orcamentoId as string | undefined
    const itensEntrada = Array.isArray(body?.itens) ? body.itens : []

    if (!orcamentoId) return NextResponse.json({ error: 'orcamentoId é obrigatório' }, { status: 400 })
    if (itensEntrada.length === 0) return NextResponse.json({ error: 'O orçamento precisa ter ao menos um item.' }, { status: 400 })

    const itens: ItemEsquadria[] = itensEntrada.map((item: Partial<ItemEsquadria>) => ({
      id: item.id && !String(item.id).startsWith('novo-') ? item.id : uuidv4(),
      ambiente: item.ambiente?.trim() || undefined,
      tipo_esquadria: item.tipo_esquadria || 'outro',
      tipo_outro_texto: item.tipo_outro_texto?.trim() || undefined,
      largura_mm: Number(item.largura_mm) || 0,
      altura_mm: Number(item.altura_mm) || 0,
      quantidade: Math.max(1, Number(item.quantidade) || 1),
      descricao: item.descricao?.trim() || item.ambiente?.trim() || 'Item do orçamento',
    }))

    const { data: orcamento, error: erroBusca } = await supabaseAdmin
      .from('orcamentos')
      .select('id')
      .eq('id', orcamentoId)
      .maybeSingle()

    if (erroBusca || !orcamento) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })

    const { error: erroUpdate } = await supabaseAdmin
      .from('orcamentos')
      .update({ itens })
      .eq('id', orcamentoId)

    if (erroUpdate) return NextResponse.json({ error: 'Erro ao salvar itens no orçamento.' }, { status: 500 })

    return NextResponse.json({ itens })
  } catch (e) {
    console.error('Erro ao salvar itens estruturados:', e)
    return NextResponse.json({ error: 'Erro interno ao salvar o orçamento estruturado.' }, { status: 500 })
  }
}
