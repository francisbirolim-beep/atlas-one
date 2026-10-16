import { statusItemWVetro } from './wvetroValidacaoItem'

function objeto(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, any> : {}
}

export function houveConferenciaHumanaWVetro(fluxo: unknown): boolean {
  const dados = objeto(fluxo)
  return Object.keys(objeto(dados.validacoes_itens)).length > 0 ||
    String(dados.validacao_status || '').toLowerCase() === 'validado'
}

/**
 * Reconcilia a importação sem perder as alterações e confirmações humanas.
 * Um payload inalterado não deve gerar novos UUIDs nem apagar feedback por item.
 * Payload alterado com conferência humana precisa de revisão, nunca de sobrescrita automática.
 */
export function reconciliarSincronizacaoWVetro(
  anterior: { itens?: unknown; wvetro_fluxo?: unknown },
  novosItens: any[],
  novoFluxo: Record<string, any>,
  mesmoPayload: boolean,
): { bloqueado: boolean; itens: any[]; fluxo: Record<string, any> } {
  const fluxoAntigo = objeto(anterior.wvetro_fluxo)
  const temConferencia = houveConferenciaHumanaWVetro(fluxoAntigo)
  const itensAntigos: any[] = Array.isArray(anterior.itens) ? anterior.itens : []

  if (!mesmoPayload) {
    return {
      bloqueado: temConferencia,
      itens: temConferencia ? itensAntigos : novosItens,
      fluxo: temConferencia ? fluxoAntigo : novoFluxo,
    }
  }

  // Mesmo documento: preserva sempre os IDs estáveis, rascunhos e correções humanas.
  const itens = itensAntigos.length ? itensAntigos : novosItens
  const validacoes = objeto(fluxoAntigo.validacoes_itens)
  const porItem = Object.keys(validacoes).length > 0 || fluxoAntigo.validacao_por_item === true
  const todos = porItem
    ? itens.length > 0 && itens.every(i => statusItemWVetro(i, { validacoes_itens: validacoes }) !== 'pendente')
    : String(fluxoAntigo.validacao_status).toLowerCase() === 'validado'

  return {
    bloqueado: false,
    itens,
    fluxo: {
      ...novoFluxo,
      ...(porItem ? { validacoes_itens: validacoes, validacao_por_item: true } : {}),
      validacao_status: todos ? 'validado' : 'aguardando',
      ...(todos ? {
        validado_em: fluxoAntigo.validado_em || null,
        validado_por_id: fluxoAntigo.validado_por_id || null,
        validado_por_nome: fluxoAntigo.validado_por_nome || null,
        validacao_resultado: fluxoAntigo.validacao_resultado || null,
      } : {}),
    },
  }
}
