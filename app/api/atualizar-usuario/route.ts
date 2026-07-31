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
      return NextResponse.json({ error: 'Apenas o usuário master pode editar usuários' }, { status: 403 })
    }

    const body = await req.json()
    const id = (body.id || '').trim()
    const whatsapp = (body.whatsapp || '').trim() || null

    if (!id) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    }

    const { error: updErr } = await supabaseAdmin
      .from('usuarios')
      .update({ whatsapp })
      .eq('id', id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
