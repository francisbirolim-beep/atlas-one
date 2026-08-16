import { supabase } from './supabase'
import { Cor } from './tipos'

export async function listarCores(somenteAtivas = false): Promise<Cor[]> {
  let query = supabase.from('cores').select('*').order('nome')
  if (somenteAtivas) query = query.eq('ativo', true)
  const { data } = await query
  return (data as Cor[]) || []
}

export async function criarCor(nome: string, pesoKgMetro?: number | null, adicionalKg?: number) {
  const adicional = adicionalKg ?? 0
  return supabase.from('cores').insert({
    nome: nome.trim(),
    peso_kg_metro: pesoKgMetro ?? null,
    adicional_kg: adicional,
    pintura: adicional > 0,
    ativo: true,
  })
}

export async function atualizarCor(id: string, dados: Partial<{ nome: string; peso_kg_metro: number | null; adicional_kg: number; pintura: boolean; ativo: boolean }>) {
  return supabase.from('cores').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function alternarAtivoCor(id: string, ativo: boolean) {
  return supabase.from('cores').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function excluirCor(id: string) {
  return supabase.from('cores').delete().eq('id', id)
}
