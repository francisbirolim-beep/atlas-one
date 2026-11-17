/**
 * Histórico W.Vetro vendido e validado, sem exigir venda operacional do Atlas.
 * Somente estar na coluna Vendido não comprova uma venda.
 */
export function ehWVetroVendidoValidado(
  orcamento: {
    wvetro_fluxo?: unknown
    modo_entrada?: string | null
    origem?: string | null
  } | null | undefined,
): boolean {
  if (!orcamento) return false
  const fluxo = orcamento.wvetro_fluxo && typeof orcamento.wvetro_fluxo === 'object'
    ? orcamento.wvetro_fluxo as Record<string, unknown>
    : {}
  const origem = String(fluxo.origem || orcamento.modo_entrada || orcamento.origem || '').trim().toLowerCase()
  return origem.includes('wvetro')
    && (fluxo.validacao_manual_cliente === true || fluxo.fonte_registro === 'historico_validado')
    && ['V', 'F'].includes(String(fluxo.situacao || '').trim().toUpperCase())
}
