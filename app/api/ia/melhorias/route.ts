import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarMelhoriaAtlas } from '@/lib/melhoriasAtlas'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    if (usuario.role !== 'master') {
      return NextResponse.json({ error: 'Área disponível somente para o Master.' }, { status: 403 })
    }

    const url = new URL(req.url)
    const status = String(url.searchParams.get('status') || '').trim()
    const tipo = String(url.searchParams.get('tipo') || '').trim()

    let query = supabaseAdmin
      .from('atlas_melhorias')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false })
      .limit(300)

    if (status && status !== 'todos') query = query.eq('status', status)
    if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (data || []).map((item: any) => item.id)
    let eventos: any[] = []
    if (ids.length > 0) {
      const { data: eventosData } = await supabaseAdmin
        .from('atlas_melhorias_eventos')
        .select('id,melhoria_id,usuario_id,usuario_nome,evento,detalhe,created_at')
        .eq('empresa_id', usuario.empresa_id)
        .in('melhoria_id', ids)
        .order('created_at', { ascending: false })
        .limit(1000)
      eventos = eventosData || []
    }

    const porMelhoria = new Map<string, any[]>()
    for (const evento of eventos) {
      const atual = porMelhoria.get(evento.melhoria_id) || []
      if (atual.length < 12) atual.push(evento)
      porMelhoria.set(evento.melhoria_id, atual)
    }

    return NextResponse.json({
      melhorias: (data || []).map((item: any) => ({
        ...item,
        eventos: porMelhoria.get(item.id) || [],
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao carregar melhorias.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const resultado = await registrarMelhoriaAtlas(usuario, {
      ...body,
      origem: body?.origem || 'formulario_atlas',
      contexto: {
        ...(body?.contexto || {}),
        user_agent: req.headers.get('user-agent') || null,
      },
    })

    if ('erro' in resultado) {
      return NextResponse.json({ error: resultado.erro }, { status: 400 })
    }

    return NextResponse.json(resultado)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao registrar melhoria.' }, { status: 500 })
  }
}