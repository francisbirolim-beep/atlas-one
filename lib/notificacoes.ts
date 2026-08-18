import { supabase } from './supabase'
import type { Notificacao, NotificacaoPreferencias } from './tipos'

export const PREFERENCIAS_PADRAO: NotificacaoPreferencias = {
  usuario_id: '',
  som_ativo: false,
  som_volume: 0.6,
  tarefas: true,
  agenda: true,
  chat: true,
  operacao: true,
}

export async function listarNotificacoes(usuarioId: string, limite = 30): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []
  return data as Notificacao[]
}

export async function marcarNotificacaoLida(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export async function marcarTodasNotificacoesLidas(usuarioId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .is('lida_em', null)
  return !error
}

export async function carregarPreferenciasNotificacao(usuarioId: string): Promise<NotificacaoPreferencias> {
  const { data, error } = await supabase
    .from('notificacao_preferencias')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error || !data) return { ...PREFERENCIAS_PADRAO, usuario_id: usuarioId }
  return data as NotificacaoPreferencias
}

export async function salvarPreferenciasNotificacao(
  usuarioId: string,
  patch: Partial<Omit<NotificacaoPreferencias, 'usuario_id'>>,
): Promise<NotificacaoPreferencias | null> {
  const atual = await carregarPreferenciasNotificacao(usuarioId)
  const payload = {
    ...atual,
    ...patch,
    usuario_id: usuarioId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('notificacao_preferencias')
    .upsert(payload, { onConflict: 'usuario_id' })
    .select('*')
    .single()
  if (error || !data) return null
  return data as NotificacaoPreferencias
}

export function assinarNovasNotificacoes(
  usuarioId: string,
  callback: (notificacao: Notificacao) => void,
) {
  const canal = supabase
    .channel(`notificacoes-${usuarioId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${usuarioId}` },
      payload => callback(payload.new as Notificacao),
    )
    .subscribe()
  return () => { void supabase.removeChannel(canal) }
}
