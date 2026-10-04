import { NextRequest, NextResponse } from 'next/server'
import { criarConversaAgente, validarConversaAgente, verificarUsuario } from '@/lib/agente'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function tituloConversa(texto: string) {
  const limpo = String(texto || '')
    .replace(/\[Anexo:[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpo) return 'Conversa com anexo'
  return limpo.length > 52 ? limpo.slice(0, 52).trimEnd() + '…' : limpo
}

export async function GET(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const conversaId = String(req.nextUrl.searchParams.get('id') || '').trim()
    if (conversaId) {
      const validada = await validarConversaAgente(conversaId, usuario.id, usuario.empresa_id)
      if (!validada) return NextResponse.json({ error: 'Conversa não encontrada para este usuário.' }, { status: 404 })

      const { data: mensagens, error } = await supabaseAdmin
        .from('agente_mensagens')
        .select('id,papel,conteudo,created_at')
        .eq('conversa_id', validada)
        .eq('empresa_id', usuario.empresa_id)
        .order('created_at', { ascending: true })
        .limit(400)
      if (error) throw error

      return NextResponse.json({ conversaId: validada, mensagens: mensagens || [] })
    }

    const { data: conversas, error } = await supabaseAdmin
      .from('agente_conversas')
      .select('id,created_at')
      .eq('usuario_id', usuario.id)
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) throw error
    if (!conversas?.length) return NextResponse.json({ conversas: [] })

    const ids = conversas.map((c: any) => String(c.id))
    const { data: mensagens, error: mensagensError } = await supabaseAdmin
      .from('agente_mensagens')
      .select('conversa_id,papel,conteudo,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .in('conversa_id', ids)
      .order('created_at', { ascending: true })
      .limit(4000)
    if (mensagensError) throw mensagensError

    const porConversa = new Map<string, any[]>()
    for (const m of mensagens || []) {
      const id = String((m as any).conversa_id)
      const atual = porConversa.get(id) || []
      atual.push(m)
      porConversa.set(id, atual)
    }

    const lista = conversas
      .map((c: any) => {
        const itens = porConversa.get(String(c.id)) || []
        const primeira = itens.find((m: any) => m.papel === 'user')
        const ultima = itens[itens.length - 1]
        return {
          id: String(c.id),
          titulo: tituloConversa(String(primeira?.conteudo || 'Nova conversa')),
          preview: String(ultima?.conteudo || '').replace(/\s+/g, ' ').trim().slice(0, 90),
          createdAt: c.created_at,
          updatedAt: ultima?.created_at || c.created_at,
          mensagens: itens.length,
        }
      })
      .filter((c: any) => c.mensagens > 0)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json({ conversas: lista })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Nao foi possivel carregar as conversas: ' + String(e?.message || e) },
      { status: 500 },
    )
  }
}

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
