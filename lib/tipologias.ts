import { supabase } from './supabase'
import { Tipologia } from './tipos'

export async function listarTipologias(): Promise<Tipologia[]> {
  const { data, error } = await supabase
    .from('tipologias')
    .select('*')
    .order('ordem', { ascending: true })

  if (error || !data) return []
  return data as Tipologia[]
}

function slugTipologia(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function criarTipologia(label: string, categoria: 'porta' | 'janela'): Promise<Tipologia | null> {
  const chave = slugTipologia(label) || ('tipologia_' + Date.now())

  const { data: maiorOrdem } = await supabase
    .from('tipologias')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const ordem = (maiorOrdem?.ordem ?? 0) + 1

  const { data, error } = await supabase
    .from('tipologias')
    .insert({ chave, label: label.trim(), categoria, ordem })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar tipologia:', error)
    return null
  }
  return data as Tipologia
}
