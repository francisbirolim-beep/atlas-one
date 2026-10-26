import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { obterDistribuicaoWhatsApp } from '@/lib/whatsappEscalonamento'

export const dynamic = 'force-dynamic'
async function autenticarMaster(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  return usuario?.role === 'master' ? usuario : null
}
export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Somente o Master pode configurar a distribuição.' }, { status: 403 })
  try {
    const distribuicao = await obterDistribuicaoWhatsApp(usuario.empresa_id)
    return NextResponse.json({ ok: true, distribuicao })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar a distribuição.' }, { status: 500 })
  }
}
export async function PUT(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Somente o Master pode alterar a distribuição.' }, { status: 403 })
  try {
    const body = await req.json()
    const principalId = typeof body.principalId === 'string' ? body.principalId : ''
    const secundariosIds = Array.isArray(body.secundariosIds)
      ? [...new Set(body.secundariosIds.filter((v: unknown): v is string => typeof v === 'string'))] : []
    const prazoMinutos = Number(body.prazoMinutos)
    const ativo = body.ativo === true
    if (!Number.isInteger(prazoMinutos) || prazoMinutos < 1 || prazoMinutos > 1440)
      return NextResponse.json({ error: 'Prazo deve ser de 1 a 1440 minutos.' }, { status: 400 })
    if (ativo && (!principalId || secundariosIds.length === 0))
      return NextResponse.json({ error: 'Escolha um atendente principal e ao menos um secundário.' }, { status: 400 })
    if (principalId && secundariosIds.includes(principalId))
      return NextResponse.json({ error: 'O atendente principal não pode ser secundário.' }, { status: 400 })
    const ids = [...new Set([principalId, ...secundariosIds].filter(Boolean))]
    if (ids.length) {
      const { data: autorizados, error } = await supabaseAdmin.from('usuarios')
        .select('id').eq('empresa_id', usuario.empresa_id).in('id', ids)
      if (error) throw error
      if ((autorizados || []).length !== ids.length)
        return NextResponse.json({ error: 'Há usuários que não pertencem à empresa.' }, { status: 400 })
    }
    // A configuração fica desativada inicialmente; nenhuma conversa existente é transferida.
    const { error: salvarError } = await supabaseAdmin.from('atendimento_whatsapp_distribuicao').upsert({
      empresa_id: usuario.empresa_id,
      usuario_principal_id: principalId || null,
      secundarios_ids: secundariosIds,
      prazo_minutos: prazoMinutos,
      ativo,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' })
    if (salvarError) throw salvarError
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao salvar distribuição.' }, { status: 400 })
  }
}
