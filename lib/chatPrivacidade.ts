/** O papel master não significa supervisão automática nas caixas pessoais. */
export function podeSupervisionarChatInterno(
  usuario: { role?: string | null } | null | undefined,
  modo: 'minhas' | 'supervisao' = 'minhas',
): boolean {
  return usuario?.role === 'master' && modo === 'supervisao'
}

/** Conversa sem mensagem continua no banco, mas não polui o histórico da caixa pessoal. */
export function conversaInternaComHistorico(conversa: { ultima_mensagem_em?: string | null }): boolean {
  return Boolean(conversa.ultima_mensagem_em)
}
