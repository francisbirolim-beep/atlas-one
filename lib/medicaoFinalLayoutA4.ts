import { tokenAtual } from './auth'
import { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4, type LayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'
export { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'
export type { LayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'

/** Configuração central por empresa; em caso de indisponibilidade, mantém o PDF legado. */
export async function carregarLayoutMedicaoA4(): Promise<LayoutMedicaoA4> {
  try {
    const token = await tokenAtual()
    if (!token) return { ...LAYOUT_MEDICAO_A4_PADRAO }
    const resposta = await fetch('/api/medicao-final/layout', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
    })
    if (!resposta.ok) return { ...LAYOUT_MEDICAO_A4_PADRAO }
    const json = await resposta.json()
    return normalizarLayoutMedicaoA4(json.layout)
  } catch {
    return { ...LAYOUT_MEDICAO_A4_PADRAO }
  }
}

export async function salvarLayoutMedicaoA4(layout: LayoutMedicaoA4) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const resposta = await fetch('/api/medicao-final/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ layout: normalizarLayoutMedicaoA4(layout) }),
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json.error || 'Não foi possível salvar o layout para todos.')
  return normalizarLayoutMedicaoA4(json.layout)
}
