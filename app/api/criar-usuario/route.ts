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
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!perfil || perfil.role !== 'master') {
      return NextResponse.json({ error: 'Apenas o usuário master pode cadastrar novos usuários' }, { status: 403 })
    }

    const body = await req.json()
    const nome = (body.nome || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const senha = (body.senha || '').trim()
    const role = body.role === 'master' ? 'master' : 'funcionario'

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Preencha nome, e-mail e senha' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const { data: novo, error: criarErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (criarErr || !novo?.user) {
      return NextResponse.json({ error: criarErr?.message || 'Erro ao criar usuário' }, { status: 400 })
    }

    const { error: perfilErr } = await supabaseAdmin.from('usuarios').insert({
      id: novo.user.id,
      nome,
      email,
      role,
    })

    if (perfilErr) {
      return NextResponse.json({ error: perfilErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: novo.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
