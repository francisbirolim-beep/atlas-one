import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

const ACAO_REMOVER = 'producao.medida_final.remover_item'

async function podeRemover(usuario: { id: string; role: string; empresa_id: string }) {
  if (usuario.role === 'master') return true

  const { data: setor } = await supabaseAdmin
    .from('setores')
    .select('id')
    .eq('rota', '/producao/medicao-final')
    .eq('ativo', true)
    .maybeSingle()

  if (!setor?.id) return false

  const { data: permissaoSetor } = await supabaseAdmin
    .from('permissoes')
    .select('nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('setor_id', setor.id)
    .maybeSingle()

  if (permissaoSetor?.nivel !== 'edicao') return false

  const { data: config } = await supabaseAdmin
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', `acesso_usuario:${usuario.id}`)
    .maybeSingle()

  let valor: any = config?.valor
  if (typeof valor === 'string') {
    try { valor = JSON.parse(valor) } catch { valor = null }
  }
  return valor?.acoes?.[ACAO_REMOVER] === 'edicao'
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    if (!(await podeRemover(usuario))) {
      return NextResponse.json({ error: 'Você não tem permissão para remover itens da Medição Final.' }, { status: 403 })
    }

    const { id: medicaoId, itemId } = await context.params
    const body = await req.json().catch(() => ({}))
    const motivo = String(body?.motivo || '').trim()

    if (motivo.length < 3) {
      return NextResponse.json({ error: 'Informe o motivo da remoção.' }, { status: 400 })
    }

    const [{ data: medicao }, { data: item }, { count: totalItens }] = await Promise.all([
      supabaseAdmin
        .from('medicoes_finais')
        .select('id,empresa_id,status_operacional,cliente_nome,orcamento_id')
        .eq('id', medicaoId)
        .eq('empresa_id', usuario.empresa_id)
        .maybeSingle(),
      supabaseAdmin
        .from('medicao_itens')
        .select('*')
        .eq('id', itemId)
        .eq('medicao_id', medicaoId)
        .eq('empresa_id', usuario.empresa_id)
        .maybeSingle(),
      supabaseAdmin
        .from('medicao_itens')
        .select('id', { count: 'exact', head: true })
        .eq('medicao_id', medicaoId)
        .eq('empresa_id', usuario.empresa_id),
    ])

    if (!medicao) return NextResponse.json({ error: 'Medição Final não encontrada.' }, { status: 404 })
    if (!item) return NextResponse.json({ error: 'Item não encontrado nesta Medição Final.' }, { status: 404 })
    if ((totalItens || 0) <= 1) {
      return NextResponse.json({ error: 'Não é permitido remover o último item da Medição Final.' }, { status: 409 })
    }

    if (item.medido || ['aguardando_conferencia', 'aprovada'].includes(String(item.status_medicao || ''))) {
      return NextResponse.json({
        error: 'Este item já foi medido ou enviado para conferência e não pode ser removido por esta ação.',
      }, { status: 409 })
    }

    const { data: respostas } = await supabaseAdmin
      .from('medicao_respostas')
      .select('*')
      .eq('medicao_id', medicaoId)
      .eq('item_id', itemId)

    const { data: fotos } = await supabaseAdmin
      .from('medicao_fotos')
      .select('*')
      .eq('medicao_id', medicaoId)
      .eq('item_id', itemId)

    const { data: ultimaRevisao } = await supabaseAdmin
      .from('medicao_revisoes')
      .select('versao')
      .eq('medicao_id', medicaoId)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error: revisaoError } = await supabaseAdmin
      .from('medicao_revisoes')
      .insert({
        medicao_id: medicaoId,
        empresa_id: usuario.empresa_id,
        versao: Number(ultimaRevisao?.versao || 0) + 1,
        motivo: 'Item removido da Medição Final',
        snapshot: {
          acao: 'remover_item_medicao',
          motivo,
          item,
          respostas: respostas || [],
          fotos: fotos || [],
          removido_em: new Date().toISOString(),
          contexto: 'Item informado como não vendido / fora do escopo desta medição.',
        },
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
      })

    if (revisaoError) {
      console.error('Erro ao registrar histórico antes de remover item da Medição Final:', revisaoError)
      return NextResponse.json({ error: 'Não foi possível registrar o histórico. O item foi mantido.' }, { status: 500 })
    }

    const { data: removidos, error: deleteError } = await supabaseAdmin
      .from('medicao_itens')
      .delete()
      .eq('id', itemId)
      .eq('medicao_id', medicaoId)
      .eq('empresa_id', usuario.empresa_id)
      .select('id')

    if (deleteError || removidos?.length !== 1) {
      console.error('Erro ao remover item da Medição Final:', deleteError)
      return NextResponse.json({ error: 'Não foi possível remover o item da Medição Final.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      itemId,
      motivo,
      mensagem: 'Item removido da Medição Final. O histórico foi preservado.',
    })
  } catch (error: any) {
    console.error('Erro interno ao remover item da Medição Final:', {
      mensagem: error?.message || String(error),
      codigo: error?.code || null,
    })
    return NextResponse.json({ error: 'Erro interno ao remover o item da Medição Final.' }, { status: 500 })
  }
}
