import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type Action = 'enviar' | 'aprovar' | 'remediar'

async function autenticar(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\\s+/i, '').trim()
  if (!token) return null

  const { data: authData } = await supabaseAdmin.auth.getUser(token)
  if (!authData?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!usuario?.empresa_id) return null
  return usuario
}

async function proximaVersao(medicaoId: string) {
  const { data } = await supabaseAdmin
    .from('medicao_revisoes')
    .select('versao')
    .eq('medicao_id', medicaoId)
    .order('versao', { ascending: false })
    .limit(1)

  return (data?.[0]?.versao || 0) + 1
}

async function criarSnapshot(medicaoId: string, usuario: any, motivo: string) {
  const [{ data: medicao }, { data: itens }] = await Promise.all([
    supabaseAdmin.from('medicoes_finais').select('*').eq('id', medicaoId).maybeSingle(),
    supabaseAdmin.from('medicao_itens').select('*').eq('medicao_id', medicaoId).order('ordem', { ascending: true }),
  ])
  if (!medicao) return null

  const versao = await proximaVersao(medicaoId)
  const { data, error } = await supabaseAdmin
    .from('medicao_revisoes')
    .insert({
      medicao_id: medicaoId,
      versao,
      motivo,
      snapshot: { medicao, itens: itens || [] },
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
    })
    .select('id,versao')
    .single()

  if (error) throw error
  return data
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await autenticar(req)
    if (!usuario) return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })

    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const action = body?.action as Action

    const { data: medicao } = await supabaseAdmin
      .from('medicoes_finais')
      .select('id,empresa_id,status_operacional')
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!medicao) return NextResponse.json({ error: 'Medicao Final nao encontrada.' }, { status: 404 })

    if (action === 'enviar') {
      const { data: itens } = await supabaseAdmin
        .from('medicao_itens')
        .select('id,medido,status_medicao')
        .eq('medicao_id', id)

      if (!itens?.length) return NextResponse.json({ error: 'A medicao nao possui posicoes.' }, { status: 400 })
      if (itens.some(i => !i.medido)) {
        return NextResponse.json({ error: 'Ainda existem posicoes sem Medida Final concluida.' }, { status: 409 })
      }

      await criarSnapshot(id, usuario, 'Envio para conferencia')
      const { error } = await supabaseAdmin
        .from('medicoes_finais')
        .update({ status_operacional: 'aguardando_conferencia' })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)

      if (error) throw error
      await supabaseAdmin
        .from('medicao_itens')
        .update({ status_medicao: 'aguardando_conferencia', updated_at: new Date().toISOString() })
        .eq('medicao_id', id)
        .eq('medido', true)

      return NextResponse.json({ ok: true, action })
    }

    const itemId = String(body?.itemId || '')
    if (!itemId) return NextResponse.json({ error: 'itemId obrigatorio.' }, { status: 400 })

    const { data: item } = await supabaseAdmin
      .from('medicao_itens')
      .select('*')
      .eq('id', itemId)
      .eq('medicao_id', id)
      .maybeSingle()

    if (!item) return NextResponse.json({ error: 'Posicao nao encontrada nesta Medicao Final.' }, { status: 404 })

    if (action === 'aprovar') {
      if (!item.medido) return NextResponse.json({ error: 'A posicao ainda nao possui medida concluida.' }, { status: 409 })
      await criarSnapshot(id, usuario, `Aprovacao da posicao: ${item.descricao || item.tipo_esquadria}`)
      const { error } = await supabaseAdmin
        .from('medicao_itens')
        .update({
          status_medicao: 'aprovada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('medicao_id', id)
      if (error) throw error

      const { data: restantes } = await supabaseAdmin
        .from('medicao_itens')
        .select('id,status_medicao')
        .eq('medicao_id', id)
        .neq('status_medicao', 'aprovada')

      if (!restantes?.length) {
        await supabaseAdmin
          .from('medicoes_finais')
          .update({
            status_operacional: 'concluido',
            aprovado_em: new Date().toISOString(),
            aprovado_por_id: usuario.id,
            aprovado_por_nome: usuario.nome,
          })
          .eq('id', id)
          .eq('empresa_id', usuario.empresa_id)
      }

      return NextResponse.json({ ok: true, action, allApproved: !restantes?.length })
    }

    if (action === 'remediar') {
      const motivo = String(body?.motivo || '').trim()
      if (!motivo) return NextResponse.json({ error: 'Informe o motivo da nova medicao.' }, { status: 400 })

      await criarSnapshot(id, usuario, `Remediacao solicitada: ${motivo}`)
      const { error: itemError } = await supabaseAdmin
        .from('medicao_itens')
        .update({
          status_medicao: 'remedicao_solicitada',
          medido: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('medicao_id', id)
      if (itemError) throw itemError

      const { error: medicaoError } = await supabaseAdmin
        .from('medicoes_finais')
        .update({ status_operacional: 'com_pendencia' })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)

      if (medicaoError) throw medicaoError

      const { error: pendenciaError } = await supabaseAdmin
        .from('medicao_pendencias')
        .insert({
          medicao_id: id,
          item_id: itemId,
          categoria: 'remedicao',
          descricao: motivo,
          status: 'aberta',
          responsavel_solucao: item.medido_por_nome || null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
        })

      if (pendenciaError) throw pendenciaError

      return NextResponse.json({ ok: true, action })
    }

    return NextResponse.json({ error: 'Acao de conferencia invalida.' }, { status: 400 })
  } catch (error) {
    console.error('Erro na conferencia da Medicao Final:', error)
    return NextResponse.json({ error: 'Erro interno ao processar a conferencia.' }, { status: 500 })
  }
}
