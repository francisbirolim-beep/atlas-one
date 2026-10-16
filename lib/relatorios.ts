import { tokenAtual } from './auth'

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


async function resumo(tipo:'comercial'|'producao',filtro:FiltroPeriodoRelatorio){
 const token=await tokenAtual()
 if(!token)throw Error('Entre novamente no Atlas.')
 const params=new URLSearchParams({tipo,...filtro})
 const resp=await fetch('/api/relatorios/resumos?'+params,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 const json=await resp.json()
 if(!resp.ok)throw Error(json.error||'Não foi possível carregar o relatório.')
 return json
}
export async function carregarResumoComercial(filtro:FiltroPeriodoRelatorio):Promise<ResumoComercial>{return resumo('comercial',filtro)}
export async function carregarResumoMedicao(filtro:FiltroPeriodoRelatorio):Promise<ResumoMedicao>{return resumo('producao',filtro)}

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
