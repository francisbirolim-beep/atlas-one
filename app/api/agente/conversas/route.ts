import { NextRequest, NextResponse } from 'next/server'
import { criarConversaAgente, verificarUsuario } from '@/lib/agente'

export async function POST(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const conversaId = await criarConversaAgente(usuario.id, usuario.empresa_id)
    return NextResponse.json({ conversaId }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Nao foi possivel iniciar uma nova conversa: ' + String(e?.message || e) },
      { status: 500 },
    )
  }
}
