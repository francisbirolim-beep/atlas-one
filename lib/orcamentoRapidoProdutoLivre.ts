/** Nome do item de medida padrão sem criar um produto fictício no catálogo. */
export function descricaoMedidaPadrao(item: { produtoNome?: string | null; tipoOutroTexto?: string | null; descricao?: string | null }): string {
  return [item.produtoNome, item.tipoOutroTexto, item.descricao]
    .find(valor => typeof valor === 'string' && valor.trim().length > 0)?.trim() || ''
}