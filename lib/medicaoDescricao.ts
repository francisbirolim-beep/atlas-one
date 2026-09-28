import type { ItemEsquadria, MedicaoItem } from './tipos'

export function descricaoGenericaMedicao(descricao?: string | null) {
  return !descricao?.trim() || /^(?:item|peça|peca)\s*\d*$/i.test(descricao.trim())
}

/** Preserve the PDF wording; structured Atlas budgets may only have a product name. */
export function descricaoItemMedicao(item: { descricao?: string | null; tipo_outro_texto?: string | null; folhas?: string | null; ambiente?: string | null }): string {
  if (!descricaoGenericaMedicao(item.descricao)) return item.descricao!.trim()
  let nome = item.tipo_outro_texto?.trim() || ''
  const folhas = String(item.folhas || '').trim()
  if (nome && /^\d+$/.test(folhas) && !/\bfolhas?\b/i.test(nome)) {
    nome += ` ${Number(folhas)} ${Number(folhas) === 1 ? 'folha' : 'folhas'}`
  }
  return [nome, item.ambiente?.trim()].filter(Boolean).join(' — ') || 'Descrição não informada no orçamento'
}

/** Read-only recovery for legacy Item N rows. Never touch field measurements or answers.
 * Positional recovery is allowed only for a complete, unchanged type/quantity sequence.
 */
export function identificarItensMedicao(itens: MedicaoItem[], origem: ItemEsquadria[]): MedicaoItem[] {
  const sequenciaIntegra = itens.length === origem.length && itens.every((item, indice) =>
    item.ordem === indice && item.tipo_esquadria === origem[indice]?.tipo_esquadria
    && Number(item.quantidade) === Number(origem[indice]?.quantidade || 1)
  )
  return itens.map((item, indice) => {
    if (!descricaoGenericaMedicao(item.descricao)) return item
    return { ...item, descricao: descricaoItemMedicao(sequenciaIntegra ? origem[indice] : item) }
  })
}
