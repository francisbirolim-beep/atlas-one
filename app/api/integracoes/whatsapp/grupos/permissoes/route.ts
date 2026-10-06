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

    const [{ data: grupo }, { data: destino }, { data: permissaoAnterior }] = await Promise.all([
      supabaseAdmin.from('atendimento_whatsapp_grupos')
        .select('id,empresa_id,whatsapp_canal_id,grupo_jid,nome,membros')
        .eq('id', grupoId).eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('usuarios')
        .select('id,nome,role,empresa_id,whatsapp')
        .eq('id', usuarioId).eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('atendimento_whatsapp_grupo_permissoes')
        .select('id,nivel,responsavel_principal')
        .eq('empresa_id', usuario.empresa_id)
        .eq('grupo_id', grupoId)
        .eq('usuario_id', usuarioId)
        .maybeSingle(),
    ])
    if (!grupo) return NextResponse.json({ error: 'Grupo invalido.' }, { status: 404 })
    if (!destino) return NextResponse.json({ error: 'Usuario invalido.' }, { status: 404 })
    if (responsavelPrincipal && !['atender','gerenciar'].includes(nivel)) {
      return NextResponse.json({ error: 'O responsavel principal precisa ter permissao para atender.' }, { status: 400 })
    }

    if (responsavelPrincipal) {
      const normalizarTelefone = (valor: unknown) => {
        let numero = String(valor || '').replace(/\D/g, '')
        if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
        return numero
      }
      const telefoneDestino = normalizarTelefone(destino.whatsapp)
      const membros = Array.isArray((grupo as any).membros) ? (grupo as any).membros : []
      const membroPorTelefone = Boolean(
        telefoneDestino &&
        membros.some((membro: any) => {
          const telefone = normalizarTelefone(membro?.telefone || String(membro?.jid || '').split('@')[0])
          return telefone && telefone === telefoneDestino
        })
      )

      let membroPorUsoDoAtlas = false
      const { data: conversaGrupo } = await supabaseAdmin.from('atendimento_conversas')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('whatsapp_canal_id', grupo.whatsapp_canal_id)
        .eq('whatsapp_chat_jid', grupo.grupo_jid)
        .maybeSingle()
      if (conversaGrupo?.id) {
        const { data: mensagemDoUsuario } = await supabaseAdmin.from('atendimento_mensagens')
          .select('id')
          .eq('empresa_id', usuario.empresa_id)
          .eq('conversa_id', conversaGrupo.id)
          .eq('usuario_id', destino.id)
          .limit(1)
          .maybeSingle()
        membroPorUsoDoAtlas = Boolean(mensagemDoUsuario?.id)
      }

      if (membros.length > 0 && !membroPorTelefone && !membroPorUsoDoAtlas) {
        return NextResponse.json(
          { error: 'O responsavel principal precisa fazer parte deste grupo do WhatsApp.' },
          { status: 400 },
        )
      }
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
      .select('id,status,responsavel_id,responsavel_nome')
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
    } else if (
      permissaoAnterior?.responsavel_principal === true &&
      !responsavelPrincipal &&
      conversa?.id &&
      conversa.status !== 'em_atendimento' &&
      conversa.responsavel_id === destino.id
    ) {
      await supabaseAdmin.from('atendimento_conversas').update({
        responsavel_id: null,
        responsavel_nome: null,
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

  const [{ data: permissao }, { data: grupo }] = await Promise.all([
    supabaseAdmin.from('atendimento_whatsapp_grupo_permissoes')
      .select('id,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('grupo_id', grupoId)
      .eq('usuario_id', usuarioId)
      .maybeSingle(),
    supabaseAdmin.from('atendimento_whatsapp_grupos')
      .select('id,nome,whatsapp_canal_id,grupo_jid')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', grupoId)
      .maybeSingle(),
  ])

  const { error } = await supabaseAdmin.from('atendimento_whatsapp_grupo_permissoes')
    .delete()
    .eq('empresa_id', usuario.empresa_id)
    .eq('grupo_id', grupoId)
    .eq('usuario_id', usuarioId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (permissao?.responsavel_principal && grupo) {
    const { data: conversa } = await supabaseAdmin.from('atendimento_conversas')
      .select('id,status,responsavel_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('whatsapp_canal_id', grupo.whatsapp_canal_id)
      .eq('whatsapp_chat_jid', grupo.grupo_jid)
      .maybeSingle()

    if (conversa?.id && conversa.status !== 'em_atendimento' && conversa.responsavel_id === usuarioId) {
      await supabaseAdmin.from('atendimento_conversas').update({
        responsavel_id: null,
        responsavel_nome: null,
        status: 'aguardando',
        updated_at: new Date().toISOString(),
      }).eq('id', conversa.id)
    }

    if (conversa?.id) {
      await supabaseAdmin.from('atendimento_eventos').insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversa.id,
        tipo: 'grupo_responsavel_removido',
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        dados: { grupo_id: grupo.id, grupo_nome: grupo.nome, usuario_alvo_id: usuarioId },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
