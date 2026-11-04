import type { ResultadoPeca } from './formulasCorteEngine'

export type BarraSimulada = {
  codigo: string
  numero: number
  cortes_mm: number[]
  consumo_mm: number
  sobra_mm: number
}

export function simularBarras(
  pecas: ResultadoPeca[],
  comprimentoBarraMm: number,
  espessuraSerraMm: number,
): { barras: BarraSimulada[]; alertas: string[]; aproveitamento: number } {
  if (!Number.isFinite(comprimentoBarraMm) || comprimentoBarraMm <= 0 ||
      !Number.isFinite(espessuraSerraMm) || espessuraSerraMm < 0 || espessuraSerraMm > 20) {
    throw new Error('Informe comprimento da barra e espessura de serra válidos.')
  }
  const grupos = new Map<string, number[]>()
  const alertas: string[] = []
  for (const p of pecas) {
    const qtd = p.quantidade ?? 1
    if (!Number.isSafeInteger(qtd) || qtd < 1 || qtd > 500) {
      alertas.push('Quantidade de peças inválida para ' + p.codigo)
      continue
    }
    if (!Number.isFinite(p.tamanho) || p.tamanho <= 0 ||
        p.tamanho + espessuraSerraMm > comprimentoBarraMm) {
      alertas.push('Corte incompatível com a barra simulada: ' + p.codigo + ' (' + p.tamanho + ' mm)')
      continue
    }
    const atual = grupos.get(p.codigo) || []
    for (let i = 0; i < qtd; i++) atual.push(p.tamanho)
    grupos.set(p.codigo, atual)
  }
  const barras: BarraSimulada[] = []
  for (const [codigo, tamanhos] of grupos) {
    const abertas: BarraSimulada[] = []
    for (const corte of tamanhos.sort((a, b) => b - a)) {
      let barra = abertas.find(item => item.sobra_mm + 1e-9 >= corte + espessuraSerraMm)
      if (!barra) {
        barra = { codigo, numero: abertas.length + 1, cortes_mm: [], consumo_mm: 0, sobra_mm: comprimentoBarraMm }
        abertas.push(barra)
      }
      barra.cortes_mm.push(corte)
      barra.consumo_mm += corte + espessuraSerraMm
      barra.sobra_mm = Math.max(0, comprimentoBarraMm - barra.consumo_mm)
    }
    barras.push(...abertas)
  }
  const comprimentoTotal = barras.length * comprimentoBarraMm
  const aproveitado = barras.reduce((s, b) => s + b.cortes_mm.reduce((s2, n) => s2 + n, 0), 0)
  return {
    barras,
    alertas,
    aproveitamento: comprimentoTotal ? aproveitado / comprimentoTotal * 100 : 0,
  }
}
