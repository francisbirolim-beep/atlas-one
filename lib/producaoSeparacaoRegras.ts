// Regras puras: uma peça só entra na Produção após conferência da Medição Final.
export type ItemMedicaoSeparacao = {
  id: string
  medido?: boolean | null
  status_medicao?: string | null
  quantidade?: number | null
}
export type ItemPacoteSeparacao = {
  id?: string | null
  medicao_final?: { medicao_item_id?: string | null } | null
}
export type MaterialSeparacao = {
  id: string
  item_ref?: string | null
  medicao_item_id?: string | null
  status_calculo?: string | null
  produto_id?: string | null
  categoria?: string | null
  codigo?: string | null
  descricao?: string | null
  excluido?: boolean | null
  quantidade_ajustada?: number | null
  quantidade_tecnica?: number | null
}
export const pecaAprovadaParaSeparacao = (item: ItemMedicaoSeparacao) =>
  item.medido === true && item.status_medicao === 'aprovada' && Number(item.quantidade || 1) === 1

export function conferirPacoteDaPeca(
  medicaoItemId: string,
  itensPacote: ItemPacoteSeparacao[],
  materiais: MaterialSeparacao[],
) {
  const relacionados = itensPacote.filter(i => i.medicao_final?.medicao_item_id === medicaoItemId)
  if (relacionados.length !== 1) {
    return { disponivel: false, motivo: 'O pacote técnico não identifica esta unidade medida de forma única.', materiais: [] as MaterialSeparacao[] }
  }
  const item = relacionados[0]
  const ref = String(item.id || '')
  if (!ref) return { disponivel: false, motivo: 'Identificador técnico da peça ausente.', materiais: [] as MaterialSeparacao[] }
  // Pacotes novos têm vínculo direto com a unidade. item_ref permanece a
  // referência da tipologia comercial para não quebrar Vendas/Instalação.
  const ligados = materiais.filter(m => !m.excluido && m.medicao_item_id === medicaoItemId)
  const semVinculo = materiais.filter(m => !m.excluido && !m.medicao_item_id && m.item_ref === ref)
  if (ligados.length > 0 && semVinculo.length > 0) {
    return { disponivel: false,
      motivo: 'Há materiais adicionados sem identificação da unidade. A Engenharia deve conferir a vinculação antes da separação.',
      materiais: ligados }
  }
  const compartilhaRef = itensPacote.filter(i => String(i.id || '') === ref).length !== 1
  if (!ligados.length && compartilhaRef) {
    return { disponivel: false, motivo: 'Lista técnica antiga compartilhada entre unidades. Regerar o pacote da Medição Final para separar individualmente.', materiais: [] as MaterialSeparacao[] }
  }
  // Para pacotes antigos com uma única unidade, preservar a referência já usada.
  const lista = ligados.length ? ligados : materiais.filter(m => !m.excluido && m.item_ref === ref)
  if (!lista.length) return { disponivel: false, motivo: 'Não existem materiais individualizados para esta peça no pacote técnico.', materiais: [] as MaterialSeparacao[] }
  const incompletos = lista.filter(m => {
    const qtd = Number(m.quantidade_ajustada ?? m.quantidade_tecnica)
    return !Number.isFinite(qtd) || qtd <= 0 || m.status_calculo === 'pendente_formula' ||
      (['perfil', 'contramarco'].includes(m.categoria || '') && !m.produto_id)
  })
  if (incompletos.length) {
    const referencia = incompletos.slice(0, 2).map(m => m.codigo || m.descricao || m.categoria || 'material').join(', ')
    return { disponivel: false,
      motivo: 'Lista técnica incompleta: ' + referencia + '. Corrigir fórmula, quantidade ou produto antes de concluir a separação.',
      materiais: lista.filter(m => Number(m.quantidade_ajustada ?? m.quantidade_tecnica) > 0) }
  }
  return { disponivel: true, motivo: null, materiais: lista }
}

export function podeConcluirSeparacao(lista: MaterialSeparacao[], ids: string[], disponivel: boolean) {
  if (!disponivel || !lista.length) return false
  const marcados = new Set(ids)
  return lista.every(m => marcados.has(m.id))
}

export function assinaturaListaSeparacao(pacoteId: string, materiais: Array<MaterialSeparacao & {
  codigo?: string | null; descricao?: string | null; cor_ref?: string | null; categoria?: string | null;
}>) {
  return JSON.stringify({
    pacoteId,
    linhas: [...materiais].sort((a, b) => a.id.localeCompare(b.id)).map(m => [
      m.id, Number(m.quantidade_ajustada ?? m.quantidade_tecnica ?? 0),
      m.codigo || '', m.descricao || '', m.cor_ref || '', m.categoria || '',
      m.medicao_item_id || '', m.status_calculo || '', m.produto_id || '',
    ]),
  })
}

export function vincularMateriaisGerados<T extends Record<string, unknown>>(
  materiais: T[],
  marcadores: Array<{ inicio: number; medicaoItemId: string | null }>,
): Array<T & { medicao_item_id: string | null }> {
  const resultado = materiais.map(m => ({ ...m, medicao_item_id: null as string | null }))
  marcadores.forEach((marcador, indice) => {
    const fim = marcadores[indice + 1]?.inicio ?? resultado.length
    for (let i = marcador.inicio; i < fim; i += 1) {
      resultado[i].medicao_item_id = marcador.medicaoItemId
    }
  })
  return resultado
}
