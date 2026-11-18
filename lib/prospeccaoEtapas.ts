import { supabase } from '@/lib/supabase'
import type { Prospeccao } from '@/lib/prospeccao'
import type { EtapasComerciaisProspeccao, EtapaComercialProspeccao } from '@/lib/prospeccaoMapa'

type OrcamentoLigado = {
  obra_id?: string | null
  cliente_id?: string | null
  status?: string | null
  data_venda?: string | null
}

/** Consulta apenas orçamentos visíveis via RLS, sem alterar orçamentos nem vendas. */
export async function consultarEtapasComerciaisProspeccoes(registros: Prospeccao[]): Promise<EtapasComerciaisProspeccao> {
  const comVinculo = registros.filter(p => p.obra_id || p.cliente_id)
  if (!comVinculo.length) return {}

  const idsObras = [...new Set(comVinculo.map(p => p.obra_id).filter((v): v is string => !!v))]
  const idsClientes = [...new Set(comVinculo.filter(p => !p.obra_id).map(p => p.cliente_id).filter((v): v is string => !!v))]
  const consultas: Promise<OrcamentoLigado[]>[] = []

  for (const [coluna, ids] of [['obra_id', idsObras], ['cliente_id', idsClientes]] as const) {
    for (let i = 0; i < ids.length; i += 100) {
      const grupo = ids.slice(i, i + 100)
      consultas.push((async () => {
        const { data, error } = await supabase.from('orcamentos')
          .select('obra_id,cliente_id,status,data_venda').in(coluna, grupo)
        if (error) throw new Error('Falha ao conferir orçamentos: ' + error.message)
        return (data || []) as OrcamentoLigado[]
      })())
    }
  }
  const orcamentos = (await Promise.all(consultas)).flat()
  const porObra = new Map<string, EtapaComercialProspeccao>()
  const porCliente = new Map<string, EtapaComercialProspeccao>()
  for (const orcamento of orcamentos) {
    const etapa: EtapaComercialProspeccao =
      orcamento.status === 'convertido' || Boolean(orcamento.data_venda) ? 'venda' : 'orcamento'
    if (orcamento.obra_id) {
      if (etapa === 'venda' || porObra.get(orcamento.obra_id) !== 'venda')
        porObra.set(orcamento.obra_id, etapa)
    } else if (orcamento.cliente_id) {
      if (etapa === 'venda' || porCliente.get(orcamento.cliente_id) !== 'venda')
        porCliente.set(orcamento.cliente_id, etapa)
    }
  }
  return Object.fromEntries(comVinculo.flatMap(p => {
    const etapa = p.obra_id ? porObra.get(p.obra_id) : p.cliente_id ? porCliente.get(p.cliente_id) : undefined
    return etapa ? [[p.id, etapa]] : []
  })) as EtapasComerciaisProspeccao
}
