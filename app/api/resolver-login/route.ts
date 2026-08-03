import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const identificador = (body.identificador || '').trim()

    if (!identificador) {
      return NextResponse.json({ error: 'Informe usuário ou e-mail' }, { status: 400 })
    }

    if (identificador.includes('@')) {
      return NextResponse.json({ email: identificador.toLowerCase() })
    }

    const { data } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .ilike('nome', identificador)
      .maybeSingle()

    if (!data?.email) {
      return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 404 })
    }

    return NextResponse.json({ email: data.email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
