import { supabase } from './supabase'
import { AssistenciaColuna } from './tipos'

export async function listarColunasAssistencia(): Promise<AssistenciaColuna[]> {
  const { data, error } = await supabase
    .from('assistencia_colunas')
    .select('*')
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar colunas de assistencia:', error)
    return []
  }
  return data as AssistenciaColuna[]
}

export async function primeiraColunaAssistenciaId(): Promise<string | null> {
  const { data } = await supabase
    .from('assistencia_colunas')
    .select('id')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.id || null
}

export async function criarColunaAssistencia(nome: string): Promise<AssistenciaColuna | null> {
  const { data: colunas } = await supabase
    .from('assistencia_colunas')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 1

  const { data, error } = await supabase
    .from('assistencia_colunas')
    .insert({ nome, ordem: proximaOrdem })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar coluna de assistencia:', error)
    return null
  }
  return data as AssistenciaColuna
}

export async function renomearColunaAssistencia(id: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from('assistencia_colunas').update({ nome }).eq('id', id)
  return !error
}

export async function excluirColunaAssistencia(id: string, colunaDestinoId: string): Promise<boolean> {
  const { error: moveError } = await supabase
    .from('assistencias')
    .update({ coluna_id: colunaDestinoId })
    .eq('coluna_id', id)

  if (moveError) {
    console.error('Erro ao mover cards antes de excluir coluna de assistencia:', moveError)
    return false
  }

  const { error } = await supabase.from('assistencia_colunas').delete().eq('id', id)
  return !error
}

// Move o card de coluna no kanban de assistencia. Quando o card sai da
// primeira coluna (onde ele aparece espelhado no painel de orcamento so pra
// avisar o time que tem um chamado novo), apaga esse espelho - ja foi visto
// e agora o acompanhamento segue direto aqui no kanban de assistencia.
export async function moverCardAssistencia(assistenciaId: string, colunaId: string): Promise<boolean> {
  const primeiraId = await primeiraColunaAssistenciaId()

  const { error } = await supabase
    .from('assistencias')
    .update({ coluna_id: colunaId, coluna_atualizada_em: new Date().toISOString() })
    .eq('id', assistenciaId)

  if (error) return false

  if (colunaId !== primeiraId) {
    await supabase.from('orcamentos').delete().eq('assistencia_id', assistenciaId)
  }

  return true
}

export async function excluirAssistencia(id: string): Promise<boolean> {
  await supabase.from('orcamentos').delete().eq('assistencia_id', id)
  const { error } = await supabase.from('assistencias').delete().eq('id', id)
  return !error
}
