/** Visibilidade de configuracao: o historico de grupos desconectados permanece salvo. */
export function idsCanaisWhatsAppConectados(
  canais: readonly { id: string; gateway_status?: string | null }[],
): Set<string> {
  return new Set(canais.filter(canal => canal.gateway_status === 'connected').map(canal => canal.id))
}

export function filtrarGruposDosCanaisConectados<T extends { whatsapp_canal_id: string }>(
  grupos: readonly T[],
  canaisConectados: ReadonlySet<string>,
): T[] {
  return grupos.filter(grupo => canaisConectados.has(grupo.whatsapp_canal_id))
}

export function filtrarConfiguracoesDeGruposVisiveis<T extends { grupo_id: string }>(
  configuracoes: readonly T[],
  idsGrupos: ReadonlySet<string>,
): T[] {
  return configuracoes.filter(item => idsGrupos.has(item.grupo_id))
}
