import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, limiteSeguro } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const limite = limiteSeguro(searchParams.get('limit'), 100, 200)

    const { data: nfs, error } = await supabaseAdmin
      .from('compras_nfs')
      .select('id,origem_entrada,status,chave_acesso,numero,serie,data_emissao,data_entrada,fornecedor_nome,fornecedor_cnpj,valor_total,arquivo_nome,arquivo_path,criado_por_nome,confirmado_em')
      .order('data_entrada', { ascending: false })
      .limit(limite)

    if (error) throw new Error(error.message)

    const ids = (nfs || []).map(nf => nf.id)
    const itensPorNf = new Map<string, { total: number; pendentes: number; custosAplicados: number }>()

    if (ids.length) {
      const { data: itens, error: itensError } = await supabaseAdmin
        .from('compras_nf_itens')
        .select('nf_id,vinculo_status,custo_aplicado')
        .in('nf_id', ids)

      if (itensError) throw new Error(itensError.message)

      for (const item of itens || []) {
        const atual = itensPorNf.get(item.nf_id) || { total: 0, pendentes: 0, custosAplicados: 0 }
        atual.total += 1
        if (item.vinculo_status !== 'vinculado') atual.pendentes += 1
        if (item.custo_aplicado) atual.custosAplicados += 1
        itensPorNf.set(item.nf_id, atual)
      }
    }

    const lista = (nfs || []).map(nf => ({
      ...nf,
      itens: itensPorNf.get(nf.id) || { total: 0, pendentes: 0, custosAplicados: 0 },
    }))

    const [{ count: totalNfs }, { count: totalPendentes }, { count: totalItens }] = await Promise.all([
      supabaseAdmin.from('compras_nfs').select('id', { count: 'exact', head: true }).neq('status', 'cancelada'),
      supabaseAdmin.from('compras_nf_itens').select('id', { count: 'exact', head: true }).neq('vinculo_status', 'vinculado'),
      supabaseAdmin.from('compras_nf_itens').select('id', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      nfs: lista,
      resumo: {
        totalNfs: totalNfs || 0,
        totalItens: totalItens || 0,
        totalPendentes: totalPendentes || 0,
      },
    })
  } catch (error) {
    console.error('Erro ao listar NFs de compra:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de notas.' }, { status: 500 })
  }
}
