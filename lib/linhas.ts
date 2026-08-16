import { supabase } from './supabase'
import { Linha } from './tipos'

export async function listarLinhas(somenteAtivas = false): Promise<Linha[]> {
  let query = supabase.from('linhas').select('*').order('nome')
  if (somenteAtivas) query = query.eq('ativo', true)
  const { data } = await query
  return (data as Linha[]) || []
}

export async function criarLinha(nome: string) {
  return supabase.from('linhas').insert({ nome: nome.trim(), ativo: true })
}

export async function atualizarLinha(id: string, dados: Partial<{ nome: string; ativo: boolean }>) {
  return supabase.from('linhas').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function alternarAtivoLinha(id: string, ativo: boolean) {
  return supabase.from('linhas').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function excluirLinha(id: string) {
  return supabase.from('linhas').delete().eq('id', id)
}
