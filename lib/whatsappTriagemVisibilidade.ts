/** Regras de visibilidade da triagem privada, sem acesso ao banco ou ao cliente. */
export type ConversaTriagem = {
  responsavel_id?: string | null
  triagem_destinos?: string[] | null
}
export function pertenceFilaPrivada(conversa: ConversaTriagem, usuarioId: string, podeAtender: boolean): boolean {
  if (!usuarioId) return false
  if (conversa.responsavel_id) return conversa.responsavel_id === usuarioId
  return podeAtender && Array.isArray(conversa.triagem_destinos)
    && conversa.triagem_destinos.includes(usuarioId)
}
