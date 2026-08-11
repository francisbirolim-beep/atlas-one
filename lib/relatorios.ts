import { supabase } from './supabase'

export type FiltroPeriodoRelatorio = {
  inicio?: string
  fim?: string
}

export type ResumoComercial = {
  totalOrcamentos: number
  valorOrcado: number
  aprovados: number
  recusados: number
  vendidos: number
  taxaConversao: number
  ticketMedio: number
}

export type ResumoMedicao = {
  totalMedicoes: number
  medicoesComItens: number
  itensTotal: number
  itensMedidos: number
  percentualItensMedidos: number
}

function dentroPeriodo(dataIso: string | null | undefined, filtro: FiltroPeriodoRelatorio) {
  if (!dataIso) return false
  const t = new Date(dataIso).getTime()
  if (Number.isNaN(t)) return false
  if (filtro.inicio) {
    const ini = new Date(`${filtro.inicio}T00:00:00`).getTime()
    if (t < ini) return false
  }
  if (filtro.fim) {
    const fim = new Date(`${filtro.fim}T23:59:59.999`).getTime()
    if (t > fim) return false
  }
  return true
}

export async function carregarResumoComercial(filtro: FiltroPeriodoRelatorio): Promise<ResumoComercial> {
  const { data } = await supabase
    .from('orcamentos')
    .select('id, created_at, valor_estimado, status, coluna_id')

  const { data: colunasVenda } = await supabase
    .from('kanban_colunas')
    .select('id')
    .eq('gera_medicao_final', true)

  const idsVenda = new Set((colunasVenda || []).map((c: any) => c.id))
  const lista = (data || []).filter((o: any) => dentroPeriodo(o.created_at, filtro))
  const totalOrcamentos = lista.length
  const valorOrcado = lista.reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0)
  const aprovados = lista.filter((o: any) => o.status === 'aprovado' || o.status === 'convertido').length
  const recusados = lista.filter((o: any) => o.status === 'recusado').length
  const vendidos = lista.filter((o: any) => idsVenda.has(o.coluna_id) || o.status === 'convertido').length
  const taxaConversao = totalOrcamentos > 0 ? Math.round((vendidos / totalOrcamentos) * 1000) / 10 : 0
  const ticketMedio = vendidos > 0
    ? lista.filter((o: any) => idsVenda.has(o.coluna_id) || o.status === 'convertido')
        .reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0) / vendidos
    : 0

  return { totalOrcamentos, valorOrcado, aprovados, recusados, vendidos, taxaConversao, ticketMedio }
}

export async function carregarResumoMedicao(filtro: FiltroPeriodoRelatorio): Promise<ResumoMedicao> {
  const { data: medicoes } = await supabase
    .from('medicoes_finais')
    .select('id, created_at')

  const filtradas = (medicoes || []).filter((m: any) => dentroPeriodo(m.created_at, filtro))
  const ids = filtradas.map((m: any) => m.id)

  if (ids.length === 0) {
    return { totalMedicoes: 0, medicoesComItens: 0, itensTotal: 0, itensMedidos: 0, percentualItensMedidos: 0 }
  }

  const { data: itens } = await supabase
    .from('medicao_itens')
    .select('id, medicao_id, medido')
    .in('medicao_id', ids)

  const listaItens = itens || []
  const medicoesComItens = new Set(listaItens.map((i: any) => i.medicao_id)).size
  const itensTotal = listaItens.length
  const itensMedidos = listaItens.filter((i: any) => !!i.medido).length
  const percentualItensMedidos = itensTotal > 0 ? Math.round((itensMedidos / itensTotal) * 1000) / 10 : 0

  return {
    totalMedicoes: filtradas.length,
    medicoesComItens,
    itensTotal,
    itensMedidos,
    percentualItensMedidos,
  }
}

export function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const escapar = (v: string | number) => {
    const s = String(v ?? '')
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = linhas.map(l => l.map(escapar).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
