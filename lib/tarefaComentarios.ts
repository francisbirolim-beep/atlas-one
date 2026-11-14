import { supabase } from './supabase'

export interface TarefaComentario {
  id: string
  tarefa_grupo_id: string
  usuario_id: string
  usuario_nome: string
  comentario: string
  created_at: string
}

/** RLS limita a consulta aos membros do mesmo grupo e empresa. */
export async function listarComentariosTarefa(grupoId: string): Promise<TarefaComentario[]> {
  if (!grupoId) return []
  const { data, error } = await supabase.from('tarefa_comentarios').select(
    'id,tarefa_grupo_id,usuario_id,usuario_nome,comentario,created_at'
  ).eq('tarefa_grupo_id', grupoId).order('created_at', { ascending: true }).limit(100)
  if (error) throw error
  return (data || []) as TarefaComentario[]
}

export async function comentarTarefa(dados: {
  grupoId: string
  usuarioId: string
  usuarioNome: string
  empresaId: string
  comentario: string
}): Promise<void> {
  const comentario = dados.comentario.trim()
  if (!comentario || comentario.length > 3000) throw new Error('Escreva um comentário de até 3000 caracteres')
  const { error } = await supabase.from('tarefa_comentarios').insert({
    empresa_id: dados.empresaId,
    tarefa_grupo_id: dados.grupoId,
    usuario_id: dados.usuarioId,
    usuario_nome: dados.usuarioNome,
    comentario,
  })
  if (error) throw error
}


export interface TarefaMovimentacao {
  id: string
  tarefa_grupo_id: string
  usuario_nome: string
  coluna_nome: string
  concluida: boolean
  created_at: string
}

export async function listarMovimentacoesTarefa(grupoId: string): Promise<TarefaMovimentacao[]> {
  if (!grupoId) return []
  const { data, error } = await supabase.from('tarefa_movimentacoes')
    .select('id,tarefa_grupo_id,usuario_nome,coluna_nome,concluida,created_at')
    .eq('tarefa_grupo_id', grupoId)
    .order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  return (data || []) as TarefaMovimentacao[]
}
