/** Medidas de impressão em milímetros (A4 retrato: 210 x 297 mm). */
export type LayoutMedicaoA4 = {
  itensPorPagina: 1 | 2 | 3
  exibirCroqui: boolean
  larguraCroquiMm: number
  fonteMedidasPt: number
  alturaFotoMm: number
  fotosPorLinha: 2 | 3 | 4
  fonteChecklistPt: number
}

export const LAYOUT_MEDICAO_A4_PADRAO: LayoutMedicaoA4 = {
  itensPorPagina: 3,
  exibirCroqui: true,
  larguraCroquiMm: 58,
  fonteMedidasPt: 6,
  alturaFotoMm: 25,
  fotosPorLinha: 4,
  fonteChecklistPt: 6.2,
}

function limitar(valor: unknown, minimo: number, maximo: number, padrao: number) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.max(minimo, Math.min(maximo, numero)) : padrao
}

export function normalizarLayoutMedicaoA4(valor: unknown): LayoutMedicaoA4 {
  const dados = valor && typeof valor === 'object' ? valor as Record<string, unknown> : {}
  return {
    itensPorPagina: ([1, 2, 3].includes(Number(dados.itensPorPagina)) ? Number(dados.itensPorPagina) : 3) as 1 | 2 | 3,
    exibirCroqui: typeof dados.exibirCroqui === 'boolean' ? dados.exibirCroqui : true,
    larguraCroquiMm: limitar(dados.larguraCroquiMm, 35, 60, 58),
    fonteMedidasPt: limitar(dados.fonteMedidasPt, 6, 12, 6),
    alturaFotoMm: limitar(dados.alturaFotoMm, 25, 58, 25),
    fotosPorLinha: ([2, 3, 4].includes(Number(dados.fotosPorLinha)) ? Number(dados.fotosPorLinha) : 4) as 2 | 3 | 4,
    fonteChecklistPt: limitar(dados.fonteChecklistPt, 6.2, 9, 6.2),
  }
}
