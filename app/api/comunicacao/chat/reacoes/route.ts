import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { EMOJIS_REACAO } from '@/lib/chatEmojis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autorizarConversa(conversaId: string, usuario: UsuarioTenant, precisaParticipar: boolean) {
  const { data: conversa, error } = await supabaseAdmin
    .from('chat_conversas')
    .select('id')
    .eq('id', conversaId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (error) throw error
  if (!conversa) throw new Error('Conversa não disponível.')

  const { data: participa, error: erroParticipa } = await supabaseAdmin
    .from('chat_participantes')
    .select('id')
    .eq('conversa_id', conversaId)
    .eq('usuario_id', usuario.id)
    .maybeSingle()
  if (erroParticipa) throw erroParticipa

  if (!participa && (precisaParticipar || usuario.role !== 'master')) {
    throw new Error('Você não tem permissão para reagir nesta conversa.')
  }
}

function erroResposta(error: unknown) {
  const mensagem = error instanceof Error ? error.message : 'Não foi possível processar reações.'
  return NextResponse.json({ error: mensagem }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const conversaId = req.nextUrl.searchParams.get('conversaId') || ''
  if (!/^[a-f\d-]{36}$/i.test(conversaId)) return NextResponse.json({ error: 'Conversa inválida.' }, { status: 400 })

  try {
    await autorizarConversa(conversaId, usuario, false)
    const { data, error } = await supabaseAdmin.from('chat_mensagem_reacoes')
      .select('mensagem_id,usuario_id,usuario_nome,emoji,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: true })
      .limit(5000)
    if (error) throw error
    return NextResponse.json({ reacoes: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return erroResposta(error)
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const conversaId = String(body?.conversaId || '')
    const mensagemId = String(body?.mensagemId || '')
    const emoji = String(body?.emoji || '').trim()
    if (!/^[a-f\d-]{36}$/i.test(conversaId) || !/^[a-f\d-]{36}$/i.test(mensagemId)) {
      return NextResponse.json({ error: 'Mensagem ou conversa inválida.' }, { status: 400 })
    }
    if (!EMOJIS_REACAO.includes(emoji)) {
      return NextResponse.json({ error: 'Selecione um emoji da lista.' }, { status: 400 })
    }

    await autorizarConversa(conversaId, usuario, true)
    const { data: mensagem, error: erroMensagem } = await supabaseAdmin
      .from('chat_mensagens')
      .select('id')
      .eq('id', mensagemId)
      .eq('conversa_id', conversaId)
      .maybeSingle()
    if (erroMensagem) throw erroMensagem
    if (!mensagem) return NextResponse.json({ error: 'Mensagem não encontrada nesta conversa.' }, { status: 404 })

    const { data: anterior, error: erroAnterior } = await supabaseAdmin
      .from('chat_mensagem_reacoes')
      .select('emoji')
      .eq('empresa_id', usuario.empresa_id)
      .eq('conversa_id', conversaId)
      .eq('mensagem_id', mensagemId)
      .eq('usuario_id', usuario.id)
      .maybeSingle()
    if (erroAnterior) throw erroAnterior

    if (anterior?.emoji === emoji) {
      const { error } = await supabaseAdmin.from('chat_mensagem_reacoes')
        .delete()
        .eq('empresa_id', usuario.empresa_id)
        .eq('conversa_id', conversaId)
        .eq('mensagem_id', mensagemId)
        .eq('usuario_id', usuario.id)
      if (error) throw error
      return NextResponse.json({ ok: true, removida: true })
    }

    const { error } = await supabaseAdmin.from('chat_mensagem_reacoes').upsert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversaId,
      mensagem_id: mensagemId,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      emoji,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mensagem_id,usuario_id' })
    if (error) throw error
    return NextResponse.json({ ok: true, removida: false })
  } catch (error) {
    return erroResposta(error)
  }
}
