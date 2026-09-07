import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const { data: perfil } = await supabaseAdmin
      .from('usuarios')
      .select('role,empresa_id')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!perfil || perfil.role !== 'master' || !perfil.empresa_id) {
      return NextResponse.json({ error: 'Apenas o usuário master da empresa pode editar usuários' }, { status: 403 })
    }

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''

    if (!id) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    }

    const { data: alvo, error: alvoErr } = await supabaseAdmin
      .from('usuarios')
      .select('id,empresa_id')
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
      .maybeSingle()

    if (alvoErr) {
      return NextResponse.json({ error: alvoErr.message }, { status: 400 })
    }
    if (!alvo) {
      return NextResponse.json({ error: 'Usuário não encontrado nesta empresa' }, { status: 404 })
    }

    const nomeInformado = typeof body.nome === 'string' ? body.nome.trim() : undefined
    const emailInformado = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const whatsappInformado = typeof body.whatsapp === 'string' ? (body.whatsapp.trim() || null) : undefined
    const roleInformado = body.role === 'master' || body.role === 'funcionario' ? body.role : undefined
    const novaSenha = typeof body.novaSenha === 'string' ? body.novaSenha.trim() : ''

    if (nomeInformado !== undefined && !nomeInformado) {
      return NextResponse.json({ error: 'Nome não pode ficar em branco' }, { status: 400 })
    }
    if (emailInformado !== undefined && !emailInformado) {
      return NextResponse.json({ error: 'E-mail não pode ficar em branco' }, { status: 400 })
    }
    if (novaSenha && novaSenha.length < 6) {
      return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
    }

    if (novaSenha || emailInformado) {
      const authUpdate: { email?: string; password?: string } = {}
      if (emailInformado) authUpdate.email = emailInformado
      if (novaSenha) authUpdate.password = novaSenha
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(alvo.id, authUpdate)
      if (authErr) {
        return NextResponse.json({ error: authErr.message }, { status: 400 })
      }
    }

    const camposPerfil: Record<string, any> = {}
    if (whatsappInformado !== undefined) camposPerfil.whatsapp = whatsappInformado
    if (nomeInformado !== undefined) camposPerfil.nome = nomeInformado
    if (emailInformado !== undefined) camposPerfil.email = emailInformado
    if (roleInformado !== undefined) camposPerfil.role = roleInformado

    if (Object.keys(camposPerfil).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from('usuarios')
        .update(camposPerfil)
        .eq('id', alvo.id)
        .eq('empresa_id', perfil.empresa_id)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
