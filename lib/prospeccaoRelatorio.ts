import type { Prospeccao } from '@/lib/prospeccao'
import type { EtapaComercialProspeccao } from '@/lib/prospeccaoEtapas'
import { normalizarTextoEndereco } from '@/lib/geocodificacaoCep'
import { pontosValidos } from '@/lib/prospeccaoMapa'

export interface ResumoBairroProspeccao {
  cidade: string
  bairro: string
  total: number
  pinos: number
  semGps: number
  emProspecao: number
  clientes: number
  orcamentos: number
  vendas: number
}

/** Totais por cidade + bairro, sem somar duas vezes a mesma obra prospectada. */
export function resumoProspeccaoPorBairro(
  registros: Prospeccao[],
  etapas: Record<string, EtapaComercialProspeccao>,
): ResumoBairroProspeccao[] {
  const comGps = new Set(pontosValidos(registros, etapas).map(item => item.registro.id))
  const grupos = new Map<string, ResumoBairroProspeccao>()
  for (const registro of registros) {
    const cidade = registro.cidade?.trim() || 'Cidade não informada'
    const bairro = registro.bairro?.trim() || 'Bairro não informado'
    const chave = normalizarTextoEndereco(cidade) + '::' + normalizarTextoEndereco(bairro)
    let linha = grupos.get(chave)
    if (!linha) {
      linha = { cidade, bairro, total: 0, pinos: 0, semGps: 0, emProspecao: 0, clientes: 0, orcamentos: 0, vendas: 0 }
      grupos.set(chave, linha)
    }
    linha.total++
    if (comGps.has(registro.id)) linha.pinos++
    else linha.semGps++
    const etapa = etapas[registro.id] || (registro.status === 'convertido' || registro.cliente_id ? 'cliente' : null)
    if (etapa === 'venda') linha.vendas++
    else if (etapa === 'orcamento') linha.orcamentos++
    else if (etapa === 'cliente') linha.clientes++
    else linha.emProspecao++
  }
  return [...grupos.values()].sort((a,b) => b.total-a.total ||
    a.cidade.localeCompare(b.cidade,'pt-BR') || a.bairro.localeCompare(b.bairro,'pt-BR'))
}
