import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'
import { conversaAcessivel } from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const conversaId = String(body?.conversaId || '')
    const clienteId = String(body?.clienteId || '')
    if (!conversaId || !clienteId) {
      return NextResponse.json({ error: 'Conversa e cliente sao obrigatorios.' }, { status: 400 })
    }

    const conversa = await conversaAcessivel(conversaId, usuario, true)
    if (!conversa) return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })

    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id,nome,empresa_id')
      .eq('id', clienteId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (!cliente) return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 })
    const agora = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('atendimento_conversas')
      .update({
        cliente_id: cliente.id,
        contato_nome: cliente.nome || conversa.contato_nome || null,
        updated_at: agora,
      })
      .eq('id', conversa.id)
      .eq('empresa_id', usuario.empresa_id)
    if (error) throw error

    await supabaseAdmin.from('atendimento_eventos').insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      tipo: 'cliente_360_vinculado',
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      dados: { cliente_id: cliente.id, cliente_nome: cliente.nome },
    })

    return NextResponse.json({ ok: true, cliente: { id: cliente.id, nome: cliente.nome } })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao vincular cliente.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}