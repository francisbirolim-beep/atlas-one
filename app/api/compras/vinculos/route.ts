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
    const limite = limiteSeguro(searchParams.get('limit'), 200, 300)

    const { data: itens, error } = await supabaseAdmin
      .from('compras_nf_itens')
      .select('id,nf_id,codigo_fornecedor,descricao,ncm,cfop,unidade,quantidade,valor_unitario,valor_total,custo_unitario,vinculo_status,created_at')
      .neq('vinculo_status', 'vinculado')
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) throw new Error(error.message)

    const nfIds = Array.from(new Set((itens || []).map(item => item.nf_id)))
    const nfs = new Map<string, { id: string; numero: string | null; fornecedor_nome: string | null; data_emissao: string | null; data_entrada: string }>()

    if (nfIds.length) {
      const { data: rows, error: nfsError } = await supabaseAdmin
        .from('compras_nfs')
        .select('id,numero,fornecedor_nome,data_emissao,data_entrada')
        .in('id', nfIds)
      if (nfsError) throw new Error(nfsError.message)
      for (const nf of rows || []) nfs.set(nf.id, nf)
    }

    return NextResponse.json({
      itens: (itens || []).map(item => ({ ...item, nf: nfs.get(item.nf_id) || null })),
    })
  } catch (error) {
    console.error('Erro ao listar vínculos pendentes:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as pendências de vínculo.' }, { status: 500 })
  }
}
