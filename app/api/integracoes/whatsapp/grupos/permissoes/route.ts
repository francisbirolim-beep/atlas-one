import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const dynamic = 'force-dynamic'

async function master(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return { error: NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }) }
  if (usuario.role !== 'master') {
    return { error: NextResponse.json({ error: 'Somente o Master pode configurar permissoes de grupos.' }, { status: 403 }) }
  }
  return { usuario }
}

export async function PUT(req: NextRequest) {
  const contexto = await master(req)
  if ('error' in contexto) return contexto.error
  const { usuario } = contexto

  try {
    const body = await req.json()
    const grupoId = String(body?.grupoId || '')
    const usuarioId = String(body?.usuarioId || '')
    const nivel = String(body?.nivel || 'acompanhar')
    const responsavelPrincipal = body?.responsavelPrincipal === true
    const niveis = new Set(['sem_acesso','acompanhar','atender','gerenciar'])

    if (!grupoId || !usuarioId || !niveis.has(nivel)) {
      return NextResponse.json({ error: 'Grupo, usuario e nivel validos sao obrigatorios.' }, { status: 400 })
    }

    const [{ data: grupo }, { data: destino }] = await Promise.all([
      supabaseAdmin.from('atendimento_whatsapp_grupos')
        .select('id,empresa_id,whatsapp_canal_id,grupo_jid,nome')
        .eq('id', grupoId).eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('usuarios')
        .select('id,nome,role,empresa_id')
        .eq('id', usuarioId).eq('empresa_id', usuario.empresa_id).maybeSingle(),
    ])
    if (!grupo) return NextResponse.json({ error: 'Grupo invalido.' }, { status: 404 })
    if (!destino) return NextResponse.json({ error: 'Usuario invalido.' }, { status: 404 })
    if (destino.role === 'master') {
      return NextResponse.json({ error: 'O Master ja possui acesso total.' }, { status: 400 })
    }
    if (responsavelPrincipal && !['atender','gerenciar'].includes(nivel)) {
      return NextResponse.json({ error: 'O responsavel principal precisa ter permissao para atender.' }, { status: 400 })
    }

    if (responsavelPrincipal) {
      const { error: limpar } = await supabaseAdmin
        .from('atendimento_whatsapp_grupo_permissoes')
        .update({ responsavel_principal: false, updated_at: new Date().toISOString() })
        .eq('empresa_id', usuario.empresa_id)
        .eq('grupo_id', grupoId)
      if (limpar) throw limpar
    }

    const { data, error } = await supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .upsert({
        empresa_id: usuario.empresa_id,
        grupo_id: grupoId,
        usuario_id: usuarioId,
        nivel,
        responsavel_principal: responsavelPrincipal,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'grupo_id,usuario_id' })
      .select('id,grupo_id,usuario_id,nivel,responsavel_principal')
      .single()
    if (error) throw error

    const { data: conversa } = await supabaseAdmin.from('atendimento_conversas')
      .select('id,status')
      .eq('empresa_id', usuario.empresa_id)
      .eq('whatsapp_canal_id', grupo.whatsapp_canal_id)
      .eq('whatsapp_chat_jid', grupo.grupo_jid)
      .maybeSingle()

    if (responsavelPrincipal && conversa?.id && conversa.status !== 'em_atendimento') {
      await supabaseAdmin.from('atendimento_conversas').update({
        responsavel_id: destino.id,
        responsavel_nome: destino.nome,
        status: 'aguardando',
        updated_at: new Date().toISOString(),
      }).eq('id', conversa.id)
    }

    if (conversa?.id) {
      await supabaseAdmin.from('atendimento_eventos').insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversa.id,
        tipo: responsavelPrincipal ? 'grupo_responsavel_definido' : 'grupo_permissao_alterada',
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        dados: {
          grupo_id: grupo.id,
          grupo_nome: grupo.nome,
          usuario_alvo_id: destino.id,
          usuario_alvo_nome: destino.nome,
          nivel,
          responsavel_principal: responsavelPrincipal,
        },
      })
    }

    return NextResponse.json({ ok: true, permissao: data })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao salvar permissao do grupo.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const contexto = await master(req)
  if ('error' in contexto) return contexto.error
  const { usuario } = contexto
  const grupoId = req.nextUrl.searchParams.get('grupoId') || ''
  const usuarioId = req.nextUrl.searchParams.get('usuarioId') || ''
  if (!grupoId || !usuarioId) {
    return NextResponse.json({ error: 'Grupo e usuario sao obrigatorios.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('atendimento_whatsapp_grupo_permissoes')
    .delete()
    .eq('empresa_id', usuario.empresa_id)
    .eq('grupo_id', grupoId)
    .eq('usuario_id', usuarioId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
