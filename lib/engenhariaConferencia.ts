import { supabase } from './supabase'
import type { Usuario } from './tipos'

export type StatusConferenciaEngenharia = 'pendente' | 'conferida' | 'pendencia'

export type ConferenciaEngenharia = {
  id: string
  medicao_item_id: string
  status: StatusConferenciaEngenharia
  observacao: string | null
  responsavel_id: string | null
  responsavel_nome: string | null
  conferido_em: string | null
  created_at: string
  updated_at: string
}

export async function listarConferenciasEngenharia(itemIds: string[]): Promise<Record<string, ConferenciaEngenharia>> {
  if (itemIds.length === 0) return {}
  const { data, error } = await supabase
    .from('engenharia_conferencias')
    .select('*')
    .in('medicao_item_id', itemIds)

  if (error) {
    console.error('Erro ao listar conferencias da Engenharia:', error)
    return {}
  }

  const mapa: Record<string, ConferenciaEngenharia> = {}
  ;(data || []).forEach((registro: any) => { mapa[registro.medicao_item_id] = registro as ConferenciaEngenharia })
  return mapa
}

export async function salvarConferenciaEngenharia(
  medicaoItemId: string,
  status: StatusConferenciaEngenharia,
  observacao: string,
  usuario: Usuario | null,
): Promise<ConferenciaEngenharia | null> {
  const payload = {
    medicao_item_id: medicaoItemId,
    status,
    observacao: observacao.trim() || null,
    responsavel_id: usuario?.id || null,
    responsavel_nome: usuario?.nome || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('engenharia_conferencias')
    .upsert(payload, { onConflict: 'medicao_item_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Erro ao salvar conferencia da Engenharia:', error)
    return null
  }

  return data as ConferenciaEngenharia
}

export function resumoConferencias(
  itemIds: string[],
  mapa: Record<string, ConferenciaEngenharia>,
) {
  const total = itemIds.length
  let conferidas = 0
  let pendencias = 0

  itemIds.forEach(id => {
    const status = mapa[id]?.status || 'pendente'
    if (status === 'conferida') conferidas += 1
    if (status === 'pendencia') pendencias += 1
  })

  return {
    total,
    conferidas,
    pendencias,
    pendentes: Math.max(0, total - conferidas - pendencias),
    completa: total > 0 && conferidas === total,
  }
}
