/**
 * Fonte de verdade para o seletor de Medida Final do Cliente 360:
 * venda operacional confirmada ou W.Vetro vendido e validado manualmente.
 * Status textual do orçamento/coluna do Kanban não prova venda.
 */
export type OrcamentoParaMedicao = {
  id: string
  wvetro_fluxo?: {
    origem?: string | null
    situacao?: string | null
    validacao_manual_cliente?: boolean | null
    fonte_registro?: string | null
  } | null
}
export function orcamentoVendidoParaMedicao(
  orcamento: OrcamentoParaMedicao,
  orcamentosComVenda: ReadonlySet<string>,
): boolean {
  if (orcamentosComVenda.has(orcamento.id)) return true
  const wvetro = orcamento.wvetro_fluxo
  if (!wvetro || !String(wvetro.origem || '').trim().toLowerCase().includes('wvetro')) return false
  const validado = wvetro.validacao_manual_cliente === true ||
    wvetro.fonte_registro === 'historico_validado'
  return validado && ['V', 'F'].includes(String(wvetro.situacao || '').trim().toUpperCase())
}
