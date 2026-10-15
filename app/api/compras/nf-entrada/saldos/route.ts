import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Consulta pura: nunca faz reserva ou entrada de estoque.
export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  if (!(await obterComprasAcessos(usuario)).notasLancar) return NextResponse.json({ error: 'Acesso não autorizado a esta operação de Compras.' }, { status: 403 })
  try {
    const body = await req.json()
    const ids = Array.from(new Set(Array.isArray(body.produtoIds) ? body.produtoIds.filter((id: unknown) => typeof id === 'string' && UUID.test(id)) : [])) as string[]
    if (ids.length > 200) return NextResponse.json({ error: 'Consulte no máximo 200 produtos por vez.' }, { status: 400 })
    if (!ids.length) return NextResponse.json({ saldos: {} })
    const { data: produtos, error: produtosError } = await supabaseAdmin.from('produtos')
      .select('id').eq('empresa_id', usuario.empresa_id).in('id', ids)
    if (produtosError) throw produtosError
    const existentes = (produtos || []).map(p => p.id)
    if (existentes.length !== ids.length) return NextResponse.json({ error: 'Um ou mais produtos não pertencem à empresa.' }, { status: 400 })
    const { data: registros, error } = await supabaseAdmin.from('estoque_saldos')
      .select('produto_id,unidade,quantidade,quantidade_reservada')
      .eq('empresa_id', usuario.empresa_id).in('produto_id', ids)
    if (error) throw error
    const saldos: Record<string, { fisico: number; reservado: number; disponivel: number; unidade: string | null }> = {}
    for (const id of ids) saldos[id] = { fisico: 0, reservado: 0, disponivel: 0, unidade: null }
    for (const s of registros || []) {
      const atual = saldos[s.produto_id]
      if (!atual) continue
      atual.fisico += Number(s.quantidade || 0)
      atual.reservado += Number(s.quantidade_reservada || 0)
      atual.disponivel = atual.fisico - atual.reservado
      atual.unidade ||= s.unidade || null
    }
    return NextResponse.json({ saldos })
  } catch (error) {
    console.error('Consultar estoque de itens da NF', error)
    return NextResponse.json({ error: 'Não foi possível consultar o estoque.' }, { status: 500 })
  }
}
