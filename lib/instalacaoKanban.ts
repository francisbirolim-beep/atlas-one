// Estado físico da instalação, independente do vínculo administrativo da obra.
export type EtapaKanbanInstalacao = 'a_instalar' | 'em_instalacao' | 'com_pendencia' | 'finalizados'
export type ItemKanbanInstalacao = {
  status?: string | null
  quantidade?: number | null
  quantidade_instalada?: number | null
  pendencia?: string | null
}
export function etapaKanbanInstalacao(item: ItemKanbanInstalacao): EtapaKanbanInstalacao {
  if (item.status === 'instalado') {
    const total=Number(item.quantidade||0)
    return total>0 && Number(item.quantidade_instalada||0)>=total && !String(item.pendencia||'').trim()
      ? 'finalizados':'com_pendencia'
  }
  if (item.status === 'pendencia' || String(item.pendencia || '').trim()) return 'com_pendencia'
  if (item.status === 'em_instalacao' || Number(item.quantidade_instalada || 0) > 0) return 'em_instalacao'
  return 'a_instalar'
}

export function validarFinalizacaoInstalacao(args: {
  quantidadePrevista: number
  confirmadoInstalado: boolean
  pendencia?: string | null
  resolverPendencia: boolean
}): string | null {
  if (!Number.isInteger(args.quantidadePrevista) || args.quantidadePrevista <= 0) return 'Quantidade prevista inválida para finalizar.'
  if (!args.confirmadoInstalado) return 'Confirme que todas as peças desta tipologia foram instaladas.'
  if (String(args.pendencia || '').trim() && !args.resolverPendencia) return 'Confirme a resolução da pendência antes de finalizar.'
  return null
}
