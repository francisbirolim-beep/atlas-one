import { supabase } from '@/lib/supabase'
import type { Prospeccao } from '@/lib/prospeccao'

export type EtapaComercialProspeccao = 'cliente' | 'orcamento' | 'venda'

export type EtapasProspeccao = {
  etapas: Record<string, EtapaComercialProspeccao>
  aviso: string | null
}

/**
 * Liga o status do mapa à OBRA da prospecção, nunca apenas ao cliente:
 * um cliente pode ter obras diferentes. Somente venda confirmada no orçamento
 * (status convertido ou data_venda) altera a cor para venda.
 * Consulta apenas dados autorizados à sessão pelas políticas RLS existentes.
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
    // Paginação garante que uma obra com vários orçamentos não perca vendas
    // por causa do limite padrão de linhas na API.
    const pagina = 400
    for (let deslocamento = 0; deslocamento < 20000; deslocamento += pagina) {
      const { data, error } = await supabase.from('orcamentos')
        .select('id,obra_id,status,data_venda')
        .in('obra_id', lote)
        .order('id')
        .range(deslocamento, deslocamento + pagina - 1)
      if (error) return {
        etapas,
        aviso: 'Não foi possível verificar todos os orçamentos e vendas. Os pinos podem estar incompletos.',
      }
      for (const orcamento of data || []) {
        if (!orcamento.obra_id) continue
        const proximo: EtapaComercialProspeccao | null =
          orcamento.status === 'convertido' || Boolean(orcamento.data_venda)
            ? 'venda'
            : orcamento.status === 'recusado' ? null : 'orcamento'
        if (!proximo) continue
        for (const id of porObra.get(orcamento.obra_id) || []) {
          if (etapas[id] !== 'venda') etapas[id] = proximo
        }
      }
      if ((data || []).length < pagina) break
      if (deslocamento + pagina >= 20000) return {
        etapas,
        aviso: 'Há muitos orçamentos nesta consulta. Refine a busca para validar todos os pinos.',
      }
    }
  }

  return { etapas, aviso: null }
}
