/** Regras do acompanhamento administrativo de Compras.
 * Kanban nunca substitui a confirmação física, NF ou estorno de estoque.
 */
export type NecessidadeRecebimento = {
  id: string
  status: string | null
  recebido_em?: string | null
}

/** Histórico de recebimento comprovado não pode ser desfeito por arrasto ou edição de status. */
export function impedirRetornoDeRecebimento(
  necessidades: NecessidadeRecebimento[],
  statusDestino: string,
): string | null {
  if (necessidades.some(item => item.status === 'cancelado')) {
    return 'Há materiais cancelados. Reative por um procedimento específico, não pelo Kanban.'
  }
  if (statusDestino !== 'recebido' && necessidades.some(item => Boolean(item.recebido_em))) {
    return 'Há material com data de recebimento registrada. Faça a conferência e o estorno específico antes de retornar a etapa; o Kanban não apaga o recebimento anterior.'
  }
  return null
}
