import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const { data: medicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('status_operacional')
    .eq('id', acesso.medicao_id)
    .maybeSingle()

  if (!medicao || !['em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return NextResponse.json({ error: 'A Medicao Final nao esta aberta para edicao externa.' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const itemId = String(body?.itemId || '')
  const campoId = String(body?.campoId || '')
  const valor = body?.valor

  const [{ data: item }, { data: campo }] = await Promise.all([
    supabaseAdmin
      .from('medicao_itens')
      .select('id, tipo_esquadria, campos_extras')
      .eq('id', itemId)
      .eq('medicao_id', acesso.medicao_id)
      .maybeSingle(),
    supabaseAdmin
      .from('tipologia_campos_extras')
      .select('id, tipo_esquadria, chave, ativo')
      .eq('id', campoId)
      .eq('ativo', true)
      .maybeSingle(),
  ])

  if (!item || !campo) return NextResponse.json({ error: 'Campo ou peca invalido.' }, { status: 404 })
  if (campo.tipo_esquadria && campo.tipo_esquadria !== item.tipo_esquadria) {
    return NextResponse.json({ error: 'Este campo nao pertence a tipologia da peca.' }, { status: 400 })
  }

  const agora = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('medicao_respostas')
    .upsert({
      medicao_id: acesso.medicao_id,
      item_id: item.id,
      campo_id: campo.id,
      campo_chave: campo.chave,
      valor,
      respondido_por_id: null,
      respondido_por_nome: acesso.nome_convidado || 'Acesso externo',
      respondido_em: agora,
      updated_at: agora,
    }, { onConflict: 'item_id,campo_chave' })

  if (error) return NextResponse.json({ error: 'Nao foi possivel salvar o checklist.' }, { status: 500 })

  await supabaseAdmin
    .from('medicao_itens')
    .update({ campos_extras: { ...(item.campos_extras || {}), [campo.chave]: valor } })
    .eq('id', item.id)

  return NextResponse.json({ ok: true })
}
