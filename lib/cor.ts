// Utilitários para pintar os cards do painel com cores customizáveis.

export function corTextoParaFundo(hex?: string | null): string {
  if (!hex) return '#1e293b'
  const limpo = hex.replace('#', '')
  if (limpo.length !== 6) return '#1e293b'
  const r = parseInt(limpo.substring(0, 2), 16)
  const g = parseInt(limpo.substring(2, 4), 16)
  const b = parseInt(limpo.substring(4, 6), 16)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia > 0.6 ? '#1e293b' : '#ffffff'
}

export function hexParaRgba(hex: string, alpha: number): string {
  const limpo = hex.replace('#', '')
  if (limpo.length !== 6) return hex
  const r = parseInt(limpo.substring(0, 2), 16)
  const g = parseInt(limpo.substring(2, 4), 16)
  const b = parseInt(limpo.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
