import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as { produtoId?: string | null }
    const produtoId = String(body.produtoId || '').trim()

    if (!produtoId) {
      const { data: item, error: itemError } = await supabaseAdmin
        .from('compras_nf_itens')
        .select('id')
        .eq('id', params.id)
        .eq('empresa_id', usuario.empresa_id)
        .maybeSingle()
      if (itemError) throw new Error(itemError.message)
      if (!item) return NextResponse.json({ error: 'Item da nota não encontrado.' }, { status: 404 })

      const { error } = await supabaseAdmin
        .from('compras_nf_itens')
        .update({ produto_id: null, vinculo_status: 'pendente' })
        .eq('id', item.id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, produto: null, vinculoStatus: 'pendente' })
    }

    const { data: produto, error: produtoError } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,nome,unidade,custo')
      .eq('id', produtoId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (produtoError) throw new Error(produtoError.message)
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado no Atlas.' }, { status: 404 })

    const { data: item, error: itemError } = await supabaseAdmin
      .from('compras_nf_itens')
      .select('id,custo_aplicado')
      .eq('id', params.id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (itemError) throw new Error(itemError.message)
    if (!item) return NextResponse.json({ error: 'Item da nota não encontrado.' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('compras_nf_itens')
      .update({ produto_id: produto.id, vinculo_status: 'vinculado' })
      .eq('id', item.id)
      .eq('empresa_id', usuario.empresa_id)

    if (error) throw new Error(error.message)

    return NextResponse.json({
      ok: true,
      produto,
      vinculoStatus: 'vinculado',
      custoAlterado: false,
      aviso: item.custo_aplicado
        ? 'Este item já tinha custo aplicado antes da correção do vínculo. Revise o histórico da NF.'
        : 'Vínculo salvo. Nenhum custo foi alterado automaticamente.',
    })
  } catch (error) {
    console.error('Erro ao resolver vínculo de item:', error)
    return NextResponse.json({ error: 'Não foi possível salvar o vínculo do item.' }, { status: 500 })
  }
}
