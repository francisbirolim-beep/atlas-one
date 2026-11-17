import { supabase } from '@/lib/supabase'
import type { Prospeccao } from '@/lib/prospeccao'

export type EtapaComercialProspeccao = 'cliente' | 'orcamento' | 'venda'
export type EtapasProspeccao = {
  etapas: Record<string, EtapaComercialProspeccao>
  aviso: string | null
}

const TAMANHO_PAGINA = 400
const LIMITE_POR_LOTE = 20000

/**
 * Os pinos são vinculados por obra_id (nunca apenas por cliente_id).
 * Orçamento existe quando há proposta não recusada.
 * Venda é confirmada exclusivamente por venda operacional ativa, tal como
 * o módulo de Medição Final; status de orçamento/posição no Kanban isolados
 * não são prova suficiente de venda.
 * Todas as leituras obedecem às políticas RLS da sessão atual.
 */
export async function consultarEtapasComerciais(registros: Prospeccao[]): Promise<EtapasProspeccao> {
  const etapas: Record<string, EtapaComercialProspeccao> = {}
  const porObra = new Map<string, string[]>()
  for (const registro of registros) {
    if (!registro.cliente_id) continue
    etapas[registro.id] = 'cliente'
    if (!registro.obra_id) continue
    const ids = porObra.get(registro.obra_id) || []
    ids.push(registro.id)
    porObra.set(registro.obra_id, ids)
  }
  const obras = [...porObra.keys()]
  if (!obras.length) return { etapas, aviso: null }

  for (let inicio = 0; inicio < obras.length; inicio += 150) {
    const lote = obras.slice(inicio, inicio + 150)

    for (let deslocamento = 0; deslocamento < LIMITE_POR_LOTE; deslocamento += TAMANHO_PAGINA) {
      const { data, error } = await supabase.from('orcamentos')
        .select('id,obra_id,status')
        .in('obra_id', lote)
        .order('id')
        .range(deslocamento, deslocamento + TAMANHO_PAGINA - 1)
      if (error) return { etapas,
        aviso: 'Não foi possível conferir os orçamentos; o mapa pode estar incompleto.' }
      for (const orcamento of data || []) {
        if (!orcamento.obra_id || orcamento.status === 'recusado') continue
        for (const id of porObra.get(orcamento.obra_id) || []) {
          if (etapas[id] !== 'venda') etapas[id] = 'orcamento'
        }
      }
      if ((data || []).length < TAMANHO_PAGINA) break
      if (deslocamento + TAMANHO_PAGINA >= LIMITE_POR_LOTE) return { etapas,
        aviso: 'Limite de consulta de orçamentos atingido. Refine os filtros antes de confiar no total.' }
    }

    for (let deslocamento = 0; deslocamento < LIMITE_POR_LOTE; deslocamento += TAMANHO_PAGINA) {
      const { data, error } = await supabase.from('vendas_obras')
        .select('id,obra_id')
        .in('obra_id', lote)
        .eq('status', 'ativa')
        .is('excluida_em', null)
        .order('id')
        .range(deslocamento, deslocamento + TAMANHO_PAGINA - 1)
      if (error) return { etapas,
        aviso: 'Não foi possível conferir vendas operacionais. Pinos de venda podem estar incompletos.' }
      for (const venda of data || []) {
        for (const id of porObra.get(venda.obra_id) || []) etapas[id] = 'venda'
      }
      if ((data || []).length < TAMANHO_PAGINA) break
      if (deslocamento + TAMANHO_PAGINA >= LIMITE_POR_LOTE) return { etapas,
        aviso: 'Limite de consulta de vendas atingido. Refine os filtros antes de confiar no total.' }
    }
  }
  return { etapas, aviso: null }
}
