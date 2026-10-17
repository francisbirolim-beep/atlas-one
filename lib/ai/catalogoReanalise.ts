// Reanalisar um catálogo nunca pode desfazer decisões ou correções humanas.
export function podeAtualizarCandidatoCatalogo(anterior: {
  status?: string | null;
  validado_em?: string | null;
  dados?: Record<string, any> | null;
}): boolean {
  return anterior.status === 'pendente'
    && !anterior.validado_em
    && !anterior.dados?.arquivado_em
    && !anterior.dados?.revisado_manualmente
}

export function dadosReanaliseCatalogo(
  anterior: Record<string, any> | null | undefined,
  extraido: Record<string, any> | null | undefined,
): Record<string, any> {
  // Regras novas completam os dados, mas recorte/foto homologados pertencem
  // à validação humana anterior e nunca devem ser substituídos pelo PDF bruto.
  const resultado = { ...(anterior || {}), ...(extraido || {}) }
  if (anterior?.imagem_confirmada === true) {
    resultado.imagem_confirmada = true
    resultado.imagem_item_url = anterior.imagem_item_url || null
    resultado.imagem_codigo_validado = anterior.imagem_codigo_validado || null
    resultado.imagem_origem = anterior.imagem_origem || null
  }
  return resultado
}
