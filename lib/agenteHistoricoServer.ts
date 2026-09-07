import { supabaseAdmin } from './supabaseAdmin'

async function empresaDoUsuario(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', usuarioId)
    .maybeSingle()

  if (error || !data?.empresa_id) return null
  return String(data.empresa_id)
}

export async function obterOuCriarConversaHoje(usuarioId: string): Promise<string | null> {
  const empresaId = await empresaDoUsuario(usuarioId)
  if (!empresaId) return null

  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  const { data: existente } = await supabaseAdmin
    .from('agente_conversas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .gte('created_at', inicioHoje.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) return existente.id

  const { data: nova, error } = await supabaseAdmin
    .from('agente_conversas')
    .insert({ empresa_id: empresaId, usuario_id: usuarioId })
    .select('id')
    .single()

  if (error) return null
  return nova?.id || null
}

export async function salvarMensagem(conversaId: string | null, papel: string, conteudo: string): Promise<void> {
  if (!conversaId || !conteudo) return

  const { data: conversa, error } = await supabaseAdmin
    .from('agente_conversas')
    .select('empresa_id')
    .eq('id', conversaId)
    .maybeSingle()

  if (error || !conversa?.empresa_id) return

  await supabaseAdmin.from('agente_mensagens').insert({
    empresa_id: conversa.empresa_id,
    conversa_id: conversaId,
    papel,
    conteudo,
  })
}
