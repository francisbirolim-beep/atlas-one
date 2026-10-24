/**
 * Um contato individual só integra a caixa pessoal se o atendente enviou
 * uma mensagem nele pelo Atlas. Atribuição automática, canal próprio,
 * status e papel master NÃO comprovam participação.
 *
 * Grupos preservam o fluxo de responsável/delegação já existente.
 */
export function pertenceAoHistoricoPessoal(
  conversa: { id: string; whatsapp_chat_tipo?: string | null },
  conversasRespondidas: ReadonlySet<string>,
): boolean {
  return conversa.whatsapp_chat_tipo === 'grupo' || conversasRespondidas.has(conversa.id)
}
