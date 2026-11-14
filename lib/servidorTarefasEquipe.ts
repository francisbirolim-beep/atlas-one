import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type PerfilTarefa = { id: string; nome: string; empresa_id: string }

export async function autenticarTarefasEquipe(req: NextRequest): Promise<PerfilTarefa | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: perfil, error: perfilErro } = await supabaseAdmin
    .from('usuarios').select('id,nome,empresa_id').eq('id', data.user.id).maybeSingle()
  if (perfilErro || !perfil?.empresa_id) return null
  return perfil as PerfilTarefa
}

export const prioridadesTarefa = ['baixa','normal','alta','urgente'] as const
export const statusTarefa = ['a_fazer','em_andamento','aguardando','concluido'] as const

export function participanteOuCriador(tarefa: {
  criado_por_id: string
  responsaveis_ids: string[]
  empresa_id: string
}, usuario: PerfilTarefa): boolean {
  return tarefa.empresa_id === usuario.empresa_id &&
    (tarefa.criado_por_id === usuario.id || tarefa.responsaveis_ids.includes(usuario.id))
}

export async function encontrarTarefaEquipe(id: string, usuario: PerfilTarefa) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null
  const { data, error } = await supabaseAdmin.from('atlas_tarefas_equipe').select('*')
    .eq('id', id).eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (error || !data || !participanteOuCriador(data, usuario)) return null
  return data
}

export async function registrarHistorico(empresaId: string, tarefaId: string, autorId: string, acao: string, detalhe?: string) {
  await supabaseAdmin.from('atlas_tarefa_historico').insert({
    empresa_id: empresaId, tarefa_id: tarefaId, autor_id: autorId, acao,
    detalhe: detalhe || null,
  })
}

export async function notificarEnvolvidos(tarefa: {
  id: string; empresa_id: string; criado_por_id: string; responsaveis_ids: string[]; titulo: string;
}, autorId: string, titulo: string, mensagem: string) {
  const destinatarios = [...new Set([tarefa.criado_por_id, ...tarefa.responsaveis_ids])].filter(id => id !== autorId)
  if (!destinatarios.length) return
  const rows = destinatarios.map(usuario_id => ({
    empresa_id: tarefa.empresa_id, usuario_id,
    categoria: 'tarefas', tipo: 'tarefa_equipe',
    titulo, mensagem, href: '/?tarefa=' + tarefa.id,
    origem_tipo: 'atlas_tarefas_equipe', origem_id: tarefa.id,
    criado_por_id: autorId,
  }))
  await supabaseAdmin.from('notificacoes').insert(rows)
}
