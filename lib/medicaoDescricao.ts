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
    const origemItem = sequenciaIntegra ? origem[indice] : null
    return {
      ...item,
      descricao: descricaoGenericaMedicao(item.descricao) ? descricaoItemMedicao(origemItem || item) : item.descricao,
      observacoes_medicao: item.observacoes_medicao || origemItem?.observacao_producao || null,
      ambiente: origemItem?.ambiente || item.ambiente || null,
      folhas: origemItem?.folhas || item.folhas || null,
      orcamento_largura_mm: origemItem?.largura_mm ?? item.orcamento_largura_mm ?? null,
      orcamento_altura_mm: origemItem?.altura_mm ?? item.orcamento_altura_mm ?? null,
      // Nunca apaga uma medição de campo. Apenas recupera do orçamento/W.Vetro
      // o que ainda estiver vazio no item da Medida Final.
      largura_baixo_mm: item.largura_baixo_mm ?? origemItem?.largura_baixo_mm ?? null,
      largura_meio_mm: item.largura_meio_mm ?? origemItem?.largura_meio_mm ?? null,
      largura_cima_mm: item.largura_cima_mm ?? origemItem?.largura_cima_mm ?? null,
      altura_direita_mm: item.altura_direita_mm ?? origemItem?.altura_direita_mm ?? null,
      altura_meio_mm: item.altura_meio_mm ?? origemItem?.altura_meio_mm ?? null,
      altura_esquerda_mm: item.altura_esquerda_mm ?? origemItem?.altura_esquerda_mm ?? null,
      foto_larguras_url: item.foto_larguras_url || origemItem?.foto_larguras_url || null,
      foto_alturas_url: item.foto_alturas_url || origemItem?.foto_alturas_url || null,
      referencia_vista: item.referencia_vista || origemItem?.referencia_vista || null,
    }
  })
}