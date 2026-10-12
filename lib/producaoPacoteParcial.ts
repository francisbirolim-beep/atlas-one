// Seleção conservadora: somente unidades individualmente aprovadas podem entrar
// no pacote de Medição Final. Não altera as tipologias vendidas.
export type UnidadeMedePacote = {
  id?: string | null
  ordem?: number | null
  quantidade?: number | null
  medido?: boolean | null
  status_medicao?: string | null
  producao_largura_mm?: number | null
  producao_altura_mm?: number | null
  largura_baixo_mm?: number | null
  largura_meio_mm?: number | null
  largura_cima_mm?: number | null
  altura_direita_mm?: number | null
  altura_meio_mm?: number | null
  altura_esquerda_mm?: number | null
  ambiente?: string | null
  descricao?: string | null
  contramarco?: string | null
}

function menorPositivo(...v: unknown[]): number {
  const valores = v.map(Number).filter(n => Number.isFinite(n) && n > 0)
  return valores.length ? Math.min(...valores) : 0
}

export function selecionarUnidadesAprovadas(
  itensVenda: Array<Record<string, any>>,
  itensMedicao: UnidadeMedePacote[],
  medicaoId: string,
  aprovadoEm: string | null,
) {
  const aprovados = itensMedicao.filter(m =>
    m.medido === true && m.status_medicao === 'aprovada' && Number(m.quantidade ?? 1) === 1)
  if (aprovados.length === 0) return { itens: [], erro: 'Não existem unidades individualmente aprovadas nesta Medição Final.' }
  const usaBlocos = itensMedicao.some(m => Number(m.ordem ?? 0) >= 100)
  const usados = new Set<string>()
  const itens: Array<Record<string, any>> = []
  for (const med of aprovados) {
    if (!med.id || usados.has(med.id)) return { itens: [], erro: 'Unidade medida sem identificação única.' }
    usados.add(med.id)
    const ordem = Number(med.ordem)
    if (!Number.isInteger(ordem) || ordem < 0) return { itens: [], erro: 'Ordem da unidade medida inválida.' }
    const indice = usaBlocos ? Math.floor(ordem / 100) : ordem
    const base = itensVenda[indice]
    if (!base) return { itens: [], erro: 'A posição aprovada não corresponde à tipologia vendida.' }
    const largura = menorPositivo(med.producao_largura_mm) ||
      menorPositivo(med.largura_baixo_mm, med.largura_meio_mm, med.largura_cima_mm)
    const altura = menorPositivo(med.producao_altura_mm) ||
      menorPositivo(med.altura_direita_mm, med.altura_meio_mm, med.altura_esquerda_mm)
    if (largura <= 0 || altura <= 0) return { itens: [], erro: 'Peça aprovada sem largura e altura final válidas.' }
    itens.push({
      ...base,
      ambiente: med.ambiente || base.ambiente || null,
      descricao: med.descricao || base.descricao || null,
      contramarco: med.contramarco || base.contramarco || null,
      largura_mm: largura, altura_mm: altura, quantidade: 1,
      medicao_final: {
        medicao_id: medicaoId,
        medicao_item_id: med.id,
        largura_mm: largura, altura_mm: altura,
        larguras_mm: [med.largura_baixo_mm, med.largura_meio_mm, med.largura_cima_mm],
        alturas_mm: [med.altura_direita_mm, med.altura_meio_mm, med.altura_esquerda_mm],
        aprovado_em: aprovadoEm,
      },
    })
  }
  return { itens, erro: null }
}
