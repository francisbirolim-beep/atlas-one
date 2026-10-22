// Contadores por conversa (e não por mensagem). Compartilha a mesma regra
// de visibilidade da caixa do usuário, sem expor conversas de outros atendentes.
export type ConversaIndicador = {
  whatsapp_chat_tipo?: string | null
  whatsapp_canal_id?: string | null
  ultima_mensagem_em?: string | null
  status: string
  nao_lidas?: number | null
}

export function calcularIndicadoresWhatsApp<T extends ConversaIndicador>(
  conversas: T[],
  canalId: string,
  pertenceAoUsuario: (conversa: T) => boolean,
) {
  const visiveis = conversas.filter(conversa =>
    (canalId === 'todos' || conversa.whatsapp_canal_id === canalId) &&
    pertenceAoUsuario(conversa) &&
    Boolean(conversa.ultima_mensagem_em),
  )
  const individuais = visiveis.filter(c => c.whatsapp_chat_tipo !== 'grupo' && c.status !== 'finalizado')
  const grupos = visiveis.filter(c => c.whatsapp_chat_tipo === 'grupo' && c.status !== 'finalizado')
  const aguardando = individuais.filter(c => c.status === 'aguardando' || Number(c.nao_lidas || 0) > 0)
  const gruposNaoLidos = grupos.filter(c => Number(c.nao_lidas || 0) > 0)
  return {
    atendimentos: individuais.length,
    aguardando: aguardando.length,
    grupos: grupos.length,
    gruposNaoLidos: gruposNaoLidos.length,
  }
}
