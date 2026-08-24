import { supabase } from './supabase'

export type StatusTecnicoTipologia = 'referencia_wvetro' | 'em_validacao_atlas' | 'validada_atlas' | 'cadastrada_atlas'

export type StatusTipologiaOrcamento = {
  tipologiaId: string
  origem: 'wvetro' | 'atlas' | 'misto'
  status: StatusTecnicoTipologia
}

export async function listarStatusTipologiasOrcamento(): Promise<Record<string, StatusTipologiaOrcamento>> {
  const [{ data: tipologias }, { data: formulas }, { data: presets }] = await Promise.all([
    supabase.from('tipologias').select('id,origem_referencia'),
    supabase.from('engenharia_tipologia_formulas_corte').select('tipologia_id,status,ativo'),
    supabase.from('engenharia_variaveis_preset').select('tipologia_id,validado,usar_no_orcamento,ativo'),
  ])

  const formulasPorTipologia = new Map<string, any[]>()
  for (const f of formulas || []) {
    const lista = formulasPorTipologia.get(f.tipologia_id) || []
    lista.push(f)
    formulasPorTipologia.set(f.tipologia_id, lista)
  }

  const presetsPorTipologia = new Map<string, any[]>()
  for (const p of presets || []) {
    const lista = presetsPorTipologia.get(p.tipologia_id) || []
    lista.push(p)
    presetsPorTipologia.set(p.tipologia_id, lista)
  }

  const resultado: Record<string, StatusTipologiaOrcamento> = {}
  for (const t of tipologias || []) {
    const fs = formulasPorTipologia.get(t.id) || []
    const ps = presetsPorTipologia.get(t.id) || []
    const validada = fs.some(f => f.ativo && f.status === 'validada') || ps.some(p => p.ativo && p.validado && p.usar_no_orcamento)
    const emTratamento = fs.length > 0 || ps.length > 0
    const origem = (t.origem_referencia === 'wvetro' || t.origem_referencia === 'misto') ? t.origem_referencia : 'atlas'

    let status: StatusTecnicoTipologia
    if (validada) status = 'validada_atlas'
    else if (emTratamento) status = 'em_validacao_atlas'
    else if (origem === 'wvetro' || origem === 'misto') status = 'referencia_wvetro'
    else status = 'cadastrada_atlas'

    resultado[t.id] = { tipologiaId: t.id, origem, status }
  }
  return resultado
}

export function rotuloStatusTipologia(status?: StatusTipologiaOrcamento | null) {
  if (!status) return 'CADASTRADA ATLAS'
  if (status.status === 'validada_atlas') return status.origem === 'atlas' ? 'VALIDADA ATLAS' : 'WVETRO · VALIDADA ATLAS'
  if (status.status === 'em_validacao_atlas') return status.origem === 'atlas' ? 'EM VALIDAÇÃO ATLAS' : 'WVETRO · EM VALIDAÇÃO ATLAS'
  if (status.status === 'referencia_wvetro') return 'REFERÊNCIA WVETRO'
  return 'CADASTRADA ATLAS'
}
