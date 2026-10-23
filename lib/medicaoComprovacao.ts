import type { MedicaoItem } from './tipos'

const CAMPOS_MEDIDAS = [
  'largura_baixo_mm',
  'largura_meio_mm',
  'largura_cima_mm',
  'altura_direita_mm',
  'altura_meio_mm',
  'altura_esquerda_mm',
] as const

type ComprovanteMedicao = Pick<MedicaoItem,
  (typeof CAMPOS_MEDIDAS)[number] | 'foto_larguras_url' | 'foto_alturas_url'>

export function medidasNumericasCompletas(item: ComprovanteMedicao): boolean {
  return CAMPOS_MEDIDAS.every(campo => {
    const valor = Number(item[campo])
    return Number.isFinite(valor) && valor > 0
  })
}

export function possuiFotoTrena(item: ComprovanteMedicao): boolean {
  return Boolean(String(item.foto_larguras_url || '').trim() || String(item.foto_alturas_url || '').trim())
}

// Medição documentada: todas as seis medidas válidas OU foto original de trena vinculada.
// A foto não substitui os números na fabricação; sinalizar conferência quando incompletos.
export function medicaoComprovada(item: ComprovanteMedicao): boolean {
  return medidasNumericasCompletas(item) || possuiFotoTrena(item)
}

export function medicaoRequerConferencia(item: ComprovanteMedicao): boolean {
  return possuiFotoTrena(item) && !medidasNumericasCompletas(item)
}
