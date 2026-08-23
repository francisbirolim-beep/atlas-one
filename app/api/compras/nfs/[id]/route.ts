import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const { data: nf, error } = await supabaseAdmin
      .from('compras_nfs')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!nf) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 })

    const { data: itens, error: itensError } = await supabaseAdmin
      .from('compras_nf_itens')
      .select('*')
      .eq('nf_id', nf.id)
      .order('created_at', { ascending: true })

    if (itensError) throw new Error(itensError.message)

    const produtoIds = Array.from(new Set((itens || []).map(item => item.produto_id).filter(Boolean)))
    const produtos = new Map<string, { id: string; codigo: string | null; nome: string; unidade: string | null; custo: number | null }>()

    if (produtoIds.length) {
      const { data: rows, error: produtosError } = await supabaseAdmin
        .from('produtos')
        .select('id,codigo,nome,unidade,custo')
        .in('id', produtoIds)
      if (produtosError) throw new Error(produtosError.message)
      for (const p of rows || []) produtos.set(p.id, p)
    }

    let arquivoUrl: string | null = null
    if (nf.arquivo_path) {
      const { data } = await supabaseAdmin.storage.from('compras-nfs').createSignedUrl(nf.arquivo_path, 600)
      arquivoUrl = data?.signedUrl || null
    }

    return NextResponse.json({
      nf,
      itens: (itens || []).map(item => ({ ...item, produto: item.produto_id ? produtos.get(item.produto_id) || null : null })),
      arquivoUrl,
    })
  } catch (error) {
    console.error('Erro ao detalhar NF de compra:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os detalhes da nota.' }, { status: 500 })
  }
}
