/** Regra comercial: importação W.Vetro exige conferência antes do orçamento feito. */
import { statusItemWVetro } from './wvetroValidacaoItem'

export const MOTIVO_PADRAO_WVETRO =
  'Orçamento importado do W.Vetro; aguardando validação, conferência técnica ou correções pendentes.'

export function nomeEtapa(valor: unknown): string {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function ehEmAndamento(nome: unknown): boolean {
  return nomeEtapa(nome) === 'em andamento'
}

export function ehOrcamentoFeito(nome: unknown): boolean {
  return nomeEtapa(nome) === 'orcamento feito'
}

export function colunaRecebimentoWVetro<T extends { id: string; nome: string }>(colunas: T[]): T {
  const coluna = colunas.find(c => ehEmAndamento(c.nome))
  if (!coluna) throw new Error('Coluna Em andamento do Kanban Comercial ainda não configurada. Importação W.Vetro interrompida para não classificar um orçamento sem validação como feito.')
  return coluna
}

export function podeIrParaOrcamentoFeitoWVetro(
  card: { wvetro_fluxo?: unknown; itens?: unknown } | null | undefined,
): boolean {
  if (!card) return false
  const f = card.wvetro_fluxo as Record<string, any> | null | undefined
  if (!f || typeof f !== 'object' || !String(f.origem || '').toLowerCase().includes('wvetro')) return true
  if (String(f.validacao_status || '').toLowerCase() !== 'validado') return false
  if (f.validacao_por_item === true) {
    const itens = Array.isArray(card.itens) ? card.itens : []
    if (!itens.length) return false
    return itens.every((item: any) => statusItemWVetro(item, f) !== 'pendente')
  }
  return true
}
