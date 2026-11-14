// O rascunho pertence a um PEDIDO e a um CLIENTE — nunca à página inteira.
// Preservar a chave antiga para permitir recuperação explícita de visitas anteriores.
export const RASCUNHO_ORCAMENTO_LEGADO = 'orcamento-rapido-layout-restaurado-v1'
export const PREFIXO_RASCUNHO_ORCAMENTO = 'orcamento-rapido-cliente-v2:'

export type IdentificacaoRascunhoOrcamento = {
  clienteIdOrigem?: string | null
  clienteNome?: string | null
  usuarioCriadorId?: string | null
  obraNome?: string | null
}

export function chaveRascunhoOrcamentoValida(chave: string | null): chave is string {
  if (!chave) return false
  if (chave === RASCUNHO_ORCAMENTO_LEGADO) return true
  return /^orcamento-rapido-cliente-v2:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)
}

function normalizarNome(valor: string) {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

export function rascunhoPertenceAoCliente(
  dados: IdentificacaoRascunhoOrcamento | null | undefined,
  clienteId: string,
  clienteNome: string,
  usuarioAtualId?: string | null,
): boolean {
  if (!dados) return false
  if (dados.usuarioCriadorId && dados.usuarioCriadorId !== usuarioAtualId) return false
  // IDs sempre têm preferência: nunca associar clientes diferentes apenas pelo mesmo nome.
  if (dados.clienteIdOrigem) return dados.clienteIdOrigem === clienteId
  return Boolean(dados.clienteNome && normalizarNome(dados.clienteNome) === normalizarNome(clienteNome))
}

export function pedidoPendentePertenceAoCliente(
  dados: {clienteId?: string | null; clienteNome?: string | null} | null | undefined,
  clienteId: string,
  clienteNome: string,
): boolean {
  if (!dados) return false
  if (dados.clienteId) return dados.clienteId === clienteId
  return Boolean(dados.clienteNome && normalizarNome(dados.clienteNome) === normalizarNome(clienteNome))
}
