import { tokenAtual } from './auth'
import { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4, type LayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'
export { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'
export type { LayoutMedicaoA4 } from './medicaoFinalLayoutA4Schema'

export type ConfiguracaoLayoutMedicaoA4 = {
  layout: LayoutMedicaoA4
  layoutGeral: LayoutMedicaoA4
  origem: 'obra' | 'geral'
  obraId: string | null
}
export type ContextoLayoutMedicaoA4 = { obraId?: string | null; medicaoId?: string | null }

async function pedirConfiguracao(metodo: 'GET' | 'PUT' | 'DELETE', contexto?: ContextoLayoutMedicaoA4, layout?: LayoutMedicaoA4) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const busca = new URLSearchParams()
  if (contexto?.obraId) busca.set('obraId', contexto.obraId)
  if (contexto?.medicaoId && metodo === 'GET') busca.set('medicaoId', contexto.medicaoId)
  const url = `/api/medicao-final/layout${busca.size ? `?${busca.toString()}` : ''}`
  const response = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(metodo === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    ...(metodo === 'PUT' ? { body: JSON.stringify({ layout: normalizarLayoutMedicaoA4(layout), escopo: contexto?.obraId ? 'obra' : 'geral', obraId: contexto?.obraId || null }) } : {}),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error || 'Não foi possível consultar ou salvar a configuração da medição final.')
  return json
}

/** Carrega o layout efetivo: o da obra, quando existir, ou o padrão para todos. */
export async function consultarConfiguracaoLayoutMedicaoA4(contexto?: ContextoLayoutMedicaoA4): Promise<ConfiguracaoLayoutMedicaoA4> {
  const json = await pedirConfiguracao('GET', contexto)
  return {
    layout: normalizarLayoutMedicaoA4(json.layout),
    layoutGeral: normalizarLayoutMedicaoA4(json.layoutGeral),
    origem: json.origem === 'obra' ? 'obra' : 'geral',
    obraId: typeof json.obraId === 'string' ? json.obraId : null,
  }
}

/** Compatibilidade: indisponibilidade da configuração nunca impede emitir um PDF. */
export async function carregarLayoutMedicaoA4(contexto?: ContextoLayoutMedicaoA4): Promise<LayoutMedicaoA4> {
  try {
    return (await consultarConfiguracaoLayoutMedicaoA4(contexto)).layout
  } catch {
    return { ...LAYOUT_MEDICAO_A4_PADRAO }
  }
}

/** Sem obraId, mantém a ação antiga de salvar padrão para toda a empresa. */
export async function salvarLayoutMedicaoA4(layout: LayoutMedicaoA4, contexto?: Pick<ContextoLayoutMedicaoA4, 'obraId'>) {
  const json = await pedirConfiguracao('PUT', contexto, layout)
  return normalizarLayoutMedicaoA4(json.layout)
}

export async function restaurarLayoutGeralDaObra(obraId: string): Promise<void> {
  await pedirConfiguracao('DELETE', { obraId })
}
