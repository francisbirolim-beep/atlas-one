import { COLUNAS_GERAIS_PADRAO,type ColunaVisualProjeto } from './visaoGeralProjetos'

/**
 * Espelho somente leitura. Um card por obra do Cliente 360, mesmo quando
 * existem diversas vendas. Nunca altera o Kanban ou a situação operacional.
 */
export const COLUNAS_KANBAN_CLIENTE = [
  { id: 'orcamento', nome: 'Pré-venda / Orçamento', ordem: -1 },
  ...COLUNAS_GERAIS_PADRAO.map(({ id, nome, ordem }) => ({ id, nome, ordem })),
]

export type VendaCardCliente = {
  vendaId: string
  numero: number
  colunaId: string
  etapaOperacional: string
  progresso: number | null
  progressoDescricao: string
}
export type ObraBaseCliente = {
  id: string
  numero: number
  nome: string
  status: string
  cidade: string | null
  previsaoEntrega: string | null
  fotoProjetoUrl: string | null
  orcamentos: number | null
}
export type ObraCardCliente = ObraBaseCliente & {
  colunaId: string
  etapaOperacional: string
  progresso: number | null
  progressoDescricao: string
  vendas: VendaCardCliente[]
}

/** Em obra com várias vendas, mostra a etapa menos avançada ainda pendente. */
export function agruparKanbanObras(
  obras: ObraBaseCliente[],
  vendasPorObra: Record<string, VendaCardCliente[]>,
  colunas:ColunaVisualProjeto[] = COLUNAS_GERAIS_PADRAO,
): ObraCardCliente[] {
  const ordem = new Map([{id:'orcamento',ordem:-1},...colunas].map(c => [c.id, c.ordem]))
  return obras.map(obra => {
    const vendas = (vendasPorObra[obra.id] || []).slice().sort((a, b) => {
      const aFinal = a.colunaId === 'finalizado'
      const bFinal = b.colunaId === 'finalizado'
      if (aFinal !== bFinal) return aFinal ? 1 : -1
      return (ordem.get(a.colunaId) ?? 0) - (ordem.get(b.colunaId) ?? 0)
    })
    const atual = vendas[0]
    return {
      ...obra,
      colunaId: atual?.colunaId || 'orcamento',
      etapaOperacional: atual?.etapaOperacional || 'orcamento',
      progresso: atual?.progresso ?? null,
      progressoDescricao: atual?.progressoDescricao || 'Aguardando venda confirmada',
      vendas,
    }
  })
}
