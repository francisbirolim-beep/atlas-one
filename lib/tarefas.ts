import { supabase } from './supabase'
import { Tarefa, TarefaColuna } from './tipos'

const COLUNAS_PADRAO = ['A fazer', 'Em andamento', 'Concluido']

export async function listarColunasTarefas(usuarioId: string): Promise<TarefaColuna[]> {
  const { data, error } = await supabase
    .from('tarefa_colunas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar colunas de tarefas:', error)
    return []
  }

  if (data.length === 0) {
    return await criarColunasPadrao(usuarioId)
  }

  return data as TarefaColuna[]
}

async function criarColunasPadrao(usuarioId: string): Promise<TarefaColuna[]> {
  const linhas = COLUNAS_PADRAO.map((nome, i) => ({ usuario_id: usuarioId, nome, ordem: i }))
  const { data, error } = await supabase.from('tarefa_colunas').insert(linhas).select()

  if (error || !data) {
    console.error('Erro ao criar colunas padrao de tarefas:', error)
    return []
  }
  return (data as TarefaColuna[]).sort((a, b) => a.ordem - b.ordem)
}

export async function primeiraColunaTarefaId(usuarioId: string): Promise<string | null> {
  const colunas = await listarColunasTarefas(usuarioId)
  return colunas[0]?.id || null
}

export async function criarColunaTarefa(usuarioId: string, nome: string): Promise<TarefaColuna | null> {
  const { data: colunas } = await supabase
    .from('tarefa_colunas')
    .select('ordem')
    .eq('usuario_id', usuarioId)
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 0

  const { data, error } = await supabase
    .from('tarefa_colunas')
    .insert({ usuario_id: usuarioId, nome, ordem: proximaOrdem })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar coluna de tarefa:', error)
    return null
  }
  return data as TarefaColuna
}

export async function renomearColunaTarefa(id: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from('tarefa_colunas').update({ nome }).eq('id', id)
  return !error
}

export async function excluirColunaTarefa(id: string, colunaDestinoId: string): Promise<boolean> {
  const { error: moveError } = await supabase
    .from('tarefas')
    .update({ coluna_id: colunaDestinoId })
    .eq('coluna_id', id)

  if (moveError) {
    console.error('Erro ao mover tarefas antes de excluir coluna:', moveError)
    return false
  }

  const { error } = await supabase.from('tarefa_colunas').delete().eq('id', id)
  return !error
}

export async function listarTarefas(usuarioId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar tarefas:', error)
    return []
  }
  return data as Tarefa[]
}

export async function criarTarefa(
  usuarioId: string,
  colunaId: string,
  titulo: string,
  descricao?: string,
  dataHora?: string | null
): Promise<Tarefa | null> {
  const { data, error } = await supabase
    .from('tarefas')
    .insert({
      usuario_id: usuarioId,
      coluna_id: colunaId,
      titulo,
      descricao: descricao || null,
      data_hora: dataHora || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar tarefa:', error)
    return null
  }
  return data as Tarefa
}

export async function moverTarefa(tarefaId: string, colunaId: string): Promise<boolean> {
  const { error } = await supabase.from('tarefas').update({ coluna_id: colunaId }).eq('id', tarefaId)
  return !error
}

export async function concluirTarefa(tarefaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tarefas')
    .update({ concluida_em: new Date().toISOString() })
    .eq('id', tarefaId)
  return !error
}

export async function reabrirTarefa(tarefaId: string): Promise<boolean> {
  const { error } = await supabase.from('tarefas').update({ concluida_em: null }).eq('id', tarefaId)
  return !error
}

export async function editarTarefa(
  tarefaId: string,
  campos: { titulo?: string; descricao?: string | null; data_hora?: string | null }
): Promise<boolean> {
  const { error } = await supabase.from('tarefas').update(campos).eq('id', tarefaId)
  return !error
}

export async function excluirTarefa(tarefaId: string): Promise<boolean> {
  const { error } = await supabase.from('tarefas').delete().eq('id', tarefaId)
  return !error
}
