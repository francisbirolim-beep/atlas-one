import { supabase } from './supabase'

export type EstadoLembreteTarefa = {
  tarefa_id: string
  usuario_id: string
  ultimo_aviso_em: string | null
  adiada_ate: string | null
}

export const INTERVALO_REAVISO_TAREFA_MS = 15 * 60 * 1000

/** Um adiamento sobrevive ao fechamento do navegador e vale para todos os dispositivos. */
export async function listarEstadosLembretesTarefas(usuarioId: string): Promise<Record<string, EstadoLembreteTarefa> | null> {
  const { data, error } = await supabase
    .from('tarefa_lembretes_usuario')
    .select('tarefa_id, usuario_id, ultimo_aviso_em, adiada_ate')
    .eq('usuario_id', usuarioId)

  if (error) {
    console.error('Falha ao consultar avisos de tarefas:', error)
    return null
  }
  return Object.fromEntries(((data || []) as EstadoLembreteTarefa[]).map(item => [item.tarefa_id, item]))
}

/** Retorna true quando o lembrete deve reaparecer. Tarefas concluídas são filtradas pelo chamador. */
export function lembreteTarefaVencido(estado: EstadoLembreteTarefa | undefined, agora: number): boolean {
  if (!estado) return true
  if (estado.adiada_ate && new Date(estado.adiada_ate).getTime() > agora) return false
  return !estado.ultimo_aviso_em
    || new Date(estado.ultimo_aviso_em).getTime() + INTERVALO_REAVISO_TAREFA_MS <= agora
}

/** Grava o último aviso ou o novo adiamento; nunca altera a tarefa original. */
export async function salvarLembreteTarefa(
  tarefaId: string,
  usuarioId: string,
  adiadaAte: string | null = null,
): Promise<EstadoLembreteTarefa | null> {
  const { data, error } = await supabase
    .from('tarefa_lembretes_usuario')
    .upsert({
      tarefa_id: tarefaId,
      usuario_id: usuarioId,
      ultimo_aviso_em: new Date().toISOString(),
      adiada_ate: adiadaAte,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'tarefa_id' })
    .select('tarefa_id, usuario_id, ultimo_aviso_em, adiada_ate')
    .single()

  if (error || !data) {
    console.error('Falha ao gravar adiamento/aviso da tarefa:', error)
    return null
  }
  return data as EstadoLembreteTarefa
}
