import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const dynamic = 'force-dynamic'

async function contextoGrupo(req: NextRequest, grupoId: string) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return { error: NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }) }

  const { data: grupo } = await supabaseAdmin
    .from('atendimento_whatsapp_grupos')
    .select('id,empresa_id,whatsapp_canal_id,grupo_jid,nome')
    .eq('id', grupoId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (!grupo) return { error: NextResponse.json({ error: 'Grupo invalido.' }, { status: 404 }) }

  const { data: principal } = await supabaseAdmin
    .from('atendimento_whatsapp_grupo_permissoes')
    .select('usuario_id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('grupo_id', grupoId)
    .eq('responsavel_principal', true)
    .maybeSingle()

  const podeDelegar = usuario.role === 'master' || principal?.usuario_id === usuario.id
  if (!podeDelegar) {
    return { error: NextResponse.json({ error: 'Somente o responsavel principal ou Master pode delegar este grupo.' }, { status: 403 }) }
  }

  return { usuario, grupo, principal }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const grupoId = String(body?.grupoId || '')
    const destinoId = String(body?.destinoId || '')
    const dias = Math.max(1, Math.min(365, Number(body?.dias || 1)))
    const motivo = String(body?.motivo || '').trim() || null
    if (!grupoId || !destinoId) {
      return NextResponse.json({ error: 'Grupo e usuario de destino sao obrigatorios.' }, { status: 400 })
    }

    const contexto = await contextoGrupo(req, grupoId)
    if ('error' in contexto) return contexto.error
    const { usuario, grupo, principal } = contexto

    const origemId = principal?.usuario_id || usuario.id
    if (destinoId === origemId) {
      return NextResponse.json({ error: 'Escolha outro usuario para receber a responsabilidade.' }, { status: 400 })
    }

    const { data: destino } = await supabaseAdmin
      .from('usuarios')
      .select('id,nome,empresa_id')
      .eq('id', destinoId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (!destino) return NextResponse.json({ error: 'Usuario de destino invalido.' }, { status: 404 })

    const inicio = new Date()
    const fim = new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000)

    await supabaseAdmin
      .from('atendimento_whatsapp_grupo_delegacoes')
      .update({ ativo: false, encerrado_em: inicio.toISOString() })
      .eq('empresa_id', usuario.empresa_id)
      .eq('grupo_id', grupoId)
      .eq('ativo', true)

    const { data: delegacao, error } = await supabaseAdmin
      .from('atendimento_whatsapp_grupo_delegacoes')
      .insert({
        empresa_id: usuario.empresa_id,
        grupo_id: grupoId,
        origem_usuario_id: origemId,
        destino_usuario_id: destino.id,
        inicio_em: inicio.toISOString(),
        fim_em: fim.toISOString(),
        motivo,
        ativo: true,
        created_by: usuario.id,
      })
      .select('id,grupo_id,origem_usuario_id,destino_usuario_id,inicio_em,fim_em,motivo,ativo')
      .single()
    if (error) throw error

    const { data: conversa } = await supabaseAdmin
      .from('atendimento_conversas')
      .select('id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('whatsapp_canal_id', grupo.whatsapp_canal_id)
      .eq('whatsapp_chat_jid', grupo.grupo_jid)
      .maybeSingle()

    if (conversa?.id) {
      await supabaseAdmin.from('atendimento_conversas').update({
        responsavel_id: destino.id,
        responsavel_nome: destino.nome,
        status: 'aguardando',
        updated_at: inicio.toISOString(),
      }).eq('id', conversa.id)

      await supabaseAdmin.from('atendimento_eventos').insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversa.id,
        tipo: 'grupo_responsabilidade_delegada',
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        dados: {
          grupo_id: grupoId,
          grupo_nome: grupo.nome,
          origem_usuario_id: origemId,
          destino_usuario_id: destino.id,
          destino_usuario_nome: destino.nome,
          inicio_em: inicio.toISOString(),
          fim_em: fim.toISOString(),
          dias,
          motivo,
        },
      })
    }

    await supabaseAdmin.from('notificacoes').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: destino.id,
      categoria: 'chat',
      tipo: 'whatsapp_grupo_delegado',
      titulo: 'WhatsApp · responsabilidade de grupo',
      mensagem: `${grupo.nome} ficou sob sua responsabilidade por ${dias} dia(s).`,
      href: conversa?.id ? `/whatsapp?conversaId=${conversa.id}` : '/whatsapp',
      origem_tipo: 'whatsapp_grupo_delegado',
      origem_id: delegacao.id,
      push_status: 'pendente',
    })

    return NextResponse.json({ ok: true, delegacao })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao delegar grupo.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const grupoId = req.nextUrl.searchParams.get('grupoId') || ''
  if (!grupoId) return NextResponse.json({ error: 'Grupo obrigatorio.' }, { status: 400 })

  const contexto = await contextoGrupo(req, grupoId)
  if ('error' in contexto) return contexto.error
  const { usuario, grupo, principal } = contexto

  const agora = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('atendimento_whatsapp_grupo_delegacoes')
    .update({ ativo: false, encerrado_em: agora })
    .eq('empresa_id', usuario.empresa_id)
    .eq('grupo_id', grupoId)
    .eq('ativo', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let principalNome: string | null = null
  if (principal?.usuario_id) {
    const { data } = await supabaseAdmin.from('usuarios')
      .select('nome').eq('id', principal.usuario_id).maybeSingle()
    principalNome = data?.nome || null
  }

  const { data: conversa } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('id,status')
    .eq('empresa_id', usuario.empresa_id)
    .eq('whatsapp_canal_id', grupo.whatsapp_canal_id)
    .eq('whatsapp_chat_jid', grupo.grupo_jid)
    .maybeSingle()

  if (conversa?.id && principal?.usuario_id && conversa.status !== 'em_atendimento') {
    await supabaseAdmin.from('atendimento_conversas').update({
      responsavel_id: principal.usuario_id,
      responsavel_nome: principalNome,
      updated_at: agora,
    }).eq('id', conversa.id)
  }

  if (conversa?.id) {
    await supabaseAdmin.from('atendimento_eventos').insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      tipo: 'grupo_responsabilidade_retomada',
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      dados: {
        grupo_id: grupoId,
        grupo_nome: grupo.nome,
        responsavel_principal_id: principal?.usuario_id || null,
        responsavel_principal_nome: principalNome,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
