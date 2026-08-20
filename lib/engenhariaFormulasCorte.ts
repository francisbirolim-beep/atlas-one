import { supabase } from '@/lib/supabase'
import type { TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'

export type RegistroFormulaCorte = TipologiaFormulasCorte & {
  id: string
  ativo: boolean
  tipologia?: { id: string; label: string; chave: string } | null
}

export async function listarFormulasCorteAtivas(): Promise<RegistroFormulaCorte[]> {
  const { data, error } = await supabase
    .from('engenharia_tipologia_formulas_corte')
    .select('id, tipologia_id, variaveis, pecas, ativo, tipologia:tipologias(id,label,chave)')
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao listar formulas de corte:', error)
    return []
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    tipologia_id: item.tipologia_id,
    variaveis: Array.isArray(item.variaveis) ? item.variaveis : [],
    pecas: Array.isArray(item.pecas) ? item.pecas : [],
    ativo: Boolean(item.ativo),
    tipologia: Array.isArray(item.tipologia) ? item.tipologia[0] || null : item.tipologia || null,
  }))
}
