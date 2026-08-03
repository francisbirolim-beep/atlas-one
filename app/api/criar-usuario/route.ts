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
    const emailInformado = (body.email || '').trim().toLowerCase()
    const senha = (body.senha || '').trim()
    const role = body.role === 'master' ? 'master' : 'funcionario'
    const whatsapp = (body.whatsapp || '').trim() || null

    if (!nome || !senha) {
      return NextResponse.json({ error: 'Preencha nome e senha' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
    }

    function gerarEmailAuto(nomeBase: string): string {
      const base = nomeBase
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join('.') || 'usuario'
      const sufixo = Math.floor(1000 + Math.random() * 9000)
      return `${base}${sufixo}@atlasone.local`
    }

    const emailGerado = !emailInformado
    let emailFinal = emailInformado
    let novo: any = null
    let criarErr: any = null

    if (emailGerado) {
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const candidato = gerarEmailAuto(nome)
        const resultado = await supabaseAdmin.auth.admin.createUser({
          email: candidato,
          password: senha,
          email_confirm: true,
        })
        if (!resultado.error && resultado.data?.user) {
          novo = resultado.data
          emailFinal = candidato
          criarErr = null
          break
        }
        criarErr = resultado.error
      }
    } else {
      const resultado = await supabaseAdmin.auth.admin.createUser({
        email: emailFinal,
        password: senha,
        email_confirm: true,
      })
      novo = resultado.data
      criarErr = resultado.error
    }

    if (criarErr || !novo?.user) {
      return NextResponse.json({ error: criarErr?.message || 'Erro ao criar usuário' }, { status: 400 })
    }

    const { error: perfilErr } = await supabaseAdmin.from('usuarios').insert({
      id: novo.user.id,
      nome,
      email: emailFinal,
      role,
      whatsapp,
    })

    if (perfilErr) {
      return NextResponse.json({ error: perfilErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: novo.user.id, email: emailFinal, emailGerado })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
