import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { listarConversasAtendimento } from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

// Um atalho para um único grupo, sem transformar a caixa pessoal
// do Master em uma listagem geral e sem contornar as permissões do grupo.
export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('conversaId') || ''
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Conversa inválida.' }, { status: 400 })
  }
  try {
    // A listagem do servidor já valida tenant, canal e ACL específica do grupo.
    // O endpoint não devolve as demais conversas nem amplia as permissões.
    const permitidas = await listarConversasAtendimento(usuario, { modo: 'monitoramento' })
    const conversa = permitidas.find(c => c.id === id && c.whatsapp_chat_tipo === 'grupo')
    if (!conversa) {
      return NextResponse.json({ error: 'Grupo indisponível ou sem permissão de consulta.' }, { status: 403 })
    }
    return NextResponse.json({ conversa }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[whatsapp/conversa-direta]', error)
    return NextResponse.json({ error: 'Falha ao abrir o grupo autorizado.' }, { status: 500 })
  }
}
