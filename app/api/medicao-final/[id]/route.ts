import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
    }

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('role,empresa_id')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (usuarioError || usuario?.role !== 'master' || !usuario.empresa_id) {
      return NextResponse.json({ error: 'Somente usuario Master pode excluir uma Medicao Final.' }, { status: 403 })
    }

    const empresaId = usuario.empresa_id
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID da medicao e obrigatorio.' }, { status: 400 })
    }

    const { data: medicao, error: buscaError } = await supabaseAdmin
      .from('medicoes_finais')
      .select('id, cliente_nome, orcamento_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (buscaError) {
      return NextResponse.json({ error: 'Erro ao localizar a Medicao Final.' }, { status: 500 })
    }
    if (!medicao) {
      return NextResponse.json({ error: 'Medicao Final nao encontrada.' }, { status: 404 })
    }

    // Regra Master: preserva o orçamento original e remove os cards derivados
    // que foram criados nos Kanbans de setor para o mesmo orçamento.
    if (medicao.orcamento_id) {
      const { error: deleteCardsError } = await supabaseAdmin
        .from('setor_kanban_itens')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('orcamento_id', medicao.orcamento_id)

      if (deleteCardsError) {
        console.error('Erro ao excluir cards derivados do orçamento:', deleteCardsError)
        return NextResponse.json(
          { error: 'Nao foi possivel excluir os cards derivados da Medicao Final.' },
          { status: 500 }
        )
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('medicoes_finais')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (deleteError) {
      console.error('Erro ao excluir Medicao Final:', deleteError)
      return NextResponse.json({ error: 'Nao foi possivel excluir a Medicao Final.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      preservado: 'orcamento',
      medicao: {
        id: medicao.id,
        cliente_nome: medicao.cliente_nome,
        orcamento_id: medicao.orcamento_id,
      },
    })
  } catch (error) {
    console.error('Erro inesperado ao excluir Medicao Final:', error)
    return NextResponse.json({ error: 'Erro interno ao excluir a Medicao Final.' }, { status: 500 })
  }
}
