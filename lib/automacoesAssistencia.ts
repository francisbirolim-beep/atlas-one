import { supabase } from './supabase'
import { AutomacaoAssistencia } from './tipos'
import { primeiraColunaTarefaId, criarTarefa } from './tarefas'

export async function listarAutomacoesAssistencia(): Promise<AutomacaoAssistencia[]> {
  const { data, error } = await supabase
    .from('automacoes_assistencia')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar automacoes de assistencia:', error)
    return []
  }
  return data as AutomacaoAssistencia[]
}

export async function criarAutomacaoAssistencia(
  destinoTipo: 'fixo' | 'solicitante',
  usuarioId: string | null,
  tituloTarefa: string,
  nome?: string
): Promise<AutomacaoAssistencia | null> {
  const { data, error } = await supabase
    .from('automacoes_assistencia')
    .insert({
      destino_tipo: destinoTipo,
      usuario_id: destinoTipo === 'fixo' ? usuarioId : null,
      titulo_tarefa: tituloTarefa,
      nome: nome || null,
      ativo: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar automacao de assistencia:', error)
    return null
  }
  return data as AutomacaoAssistencia
}

export async function alternarAtivoAutomacaoAssistencia(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('automacoes_assistencia')
    .update({ ativo })
    .eq('id', id)

  return !error
}

export async function excluirAutomacaoAssistencia(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('automacoes_assistencia')
    .delete()
    .eq('id', id)

  return !error
}

export async function executarAutomacoesAssistencia(assistencia: {
  cliente_nome?: string | null
  criado_por_id?: string | null
}): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('automacoes_assistencia')
      .select('*')
      .eq('ativo', true)

    if (error || !data || data.length === 0) return

    for (const automacao of data as AutomacaoAssistencia[]) {
      const usuarioAlvo =
        automacao.destino_tipo === 'solicitante'
          ? assistencia.criado_por_id || null
          : automacao.usuario_id

      if (!usuarioAlvo) continue

      const colunaTarefaId = await primeiraColunaTarefaId(usuarioAlvo)
      if (!colunaTarefaId) continue

      const cliente = assistencia.cliente_nome || 'cliente'
      const titulo = automacao.titulo_tarefa.replace(/\{cliente\}/g, cliente)

      await criarTarefa(usuarioAlvo, colunaTarefaId, titulo)
    }
  } catch (e) {
    console.error('Erro ao executar automacoes de assistencia:', e)
  }
}
