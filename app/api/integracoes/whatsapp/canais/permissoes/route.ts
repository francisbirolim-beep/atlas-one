import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const dynamic = 'force-dynamic'

async function contextoMaster(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return { error: NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }) }
  if (usuario.role !== 'master') {
    return { error: NextResponse.json({ error: 'Somente o Master pode configurar permissoes de canais.' }, { status: 403 }) }
  }
  return { usuario }
}

export async function GET(req: NextRequest) {
  const contexto = await contextoMaster(req)
  if ('error' in contexto) return contexto.error
  const { usuario } = contexto

  const { data, error } = await supabaseAdmin
    .from('atendimento_whatsapp_permissoes')
    .select('id,canal_id,usuario_id,pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
    .eq('empresa_id', usuario.empresa_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, permissoes: data || [] })
}
export async function PUT(req: NextRequest) {
  const contexto = await contextoMaster(req)
  if ('error' in contexto) return contexto.error
  const { usuario } = contexto
  try {
    const body = await req.json()
    const canalId = String(body?.canalId || '')
    const usuarioId = String(body?.usuarioId || '')
    if (!canalId || !usuarioId) {
      return NextResponse.json({ error: 'Canal e usuario sao obrigatorios.' }, { status: 400 })
    }

    const [{ data: canal }, { data: destino }] = await Promise.all([
      supabaseAdmin.from('atendimento_whatsapp_canais')
        .select('id,empresa_id,principal,usuario_id').eq('id', canalId)
        .eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('usuarios')
        .select('id,empresa_id,role').eq('id', usuarioId)
        .eq('empresa_id', usuario.empresa_id).maybeSingle(),
    ])
    if (!canal) return NextResponse.json({ error: 'Canal invalido.' }, { status: 404 })
    if (!destino) return NextResponse.json({ error: 'Usuario invalido.' }, { status: 404 })
    if (destino.role === 'master') {
      return NextResponse.json({ error: 'O Master ja possui acesso total.' }, { status: 400 })
    }
    const podeAtender = body?.podeAtender === true
    const podeTransferir = body?.podeTransferir === true
    const podeSupervisionar = body?.podeSupervisionar === true
    const podeVisualizar = body?.podeVisualizar !== false || podeAtender || podeTransferir || podeSupervisionar

    const { data, error } = await supabaseAdmin
      .from('atendimento_whatsapp_permissoes')
      .upsert({
        empresa_id: usuario.empresa_id,
        canal_id: canalId,
        usuario_id: usuarioId,
        pode_visualizar: podeVisualizar,
        pode_atender: podeAtender,
        pode_transferir: podeTransferir,
        pode_supervisionar: podeSupervisionar,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'canal_id,usuario_id' })
      .select('id,canal_id,usuario_id,pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, permissao: data })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao salvar permissao.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
export async function DELETE(req: NextRequest) {
  const contexto = await contextoMaster(req)
  if ('error' in contexto) return contexto.error
  const { usuario } = contexto
  const canalId = req.nextUrl.searchParams.get('canalId') || ''
  const usuarioId = req.nextUrl.searchParams.get('usuarioId') || ''
  if (!canalId || !usuarioId) {
    return NextResponse.json({ error: 'Canal e usuario sao obrigatorios.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('atendimento_whatsapp_permissoes')
    .delete().eq('empresa_id', usuario.empresa_id)
    .eq('canal_id', canalId).eq('usuario_id', usuarioId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}