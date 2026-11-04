// Ordem visual das abas da central da obra. Não modifica as etapas operacionais.
export const ABAS_OBRA_PADRAO = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'custos', label: 'Custos / CMV' },
  { id: 'compras', label: 'Compras' },
  { id: 'materiais', label: 'Materiais' },
  { id: 'tipologias', label: 'Tipologias' },
  { id: 'medida-final', label: 'Medida Final' },
  { id: 'producao', label: 'Produção' },
  { id: 'instalacao', label: 'Instalação' },
  { id: 'notas', label: 'Notas / Recibos' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'historico', label: 'Histórico' },
] as const

export type AbaObraId = typeof ABAS_OBRA_PADRAO[number]['id']
export const ORDEM_ABAS_OBRA_PADRAO: AbaObraId[] = ABAS_OBRA_PADRAO.map(aba => aba.id)

export function normalizarOrdemAbasObra(valor: unknown): AbaObraId[] {
  const idsValidos = new Set<string>(ORDEM_ABAS_OBRA_PADRAO)
  const salvas = Array.isArray(valor) ? valor : []
  const validas = salvas.filter((id): id is AbaObraId => typeof id === 'string' && idsValidos.has(id))
  return [...new Set([...validas, ...ORDEM_ABAS_OBRA_PADRAO])]
}

export function moverAbaObra(ordem: readonly AbaObraId[], origem: AbaObraId, destino: AbaObraId): AbaObraId[] {
  const atual = normalizarOrdemAbasObra(ordem)
  if (origem === destino || !atual.includes(origem) || !atual.includes(destino)) return atual
  const nova = atual.filter(id => id !== origem)
  nova.splice(atual.indexOf(destino), 0, origem)
  return nova
}

function chaveOrdemAbas(usuarioId: string) {
  return `atlas:abas-obra:ordem:v1:${usuarioId}`
}

// Configuração por usuário, comum a todas as obras abertas neste navegador.
export function lerOrdemAbasObra(usuarioId: string): AbaObraId[] {
  if (!usuarioId || typeof window === 'undefined') return [...ORDEM_ABAS_OBRA_PADRAO]
  try {
    const bruto = window.localStorage.getItem(chaveOrdemAbas(usuarioId))
    return normalizarOrdemAbasObra(bruto ? JSON.parse(bruto) : null)
  } catch {
    return [...ORDEM_ABAS_OBRA_PADRAO]
  }
}

export function salvarOrdemAbasObra(usuarioId: string, ordem: readonly AbaObraId[]): boolean {
  if (!usuarioId || typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(chaveOrdemAbas(usuarioId), JSON.stringify(normalizarOrdemAbasObra(ordem)))
    return true
  } catch {
    return false
  }
}
