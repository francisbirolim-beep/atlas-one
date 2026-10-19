'use client'
import { Printer, Download } from 'lucide-react'
import { periodoRapido, type PeriodoFinanceiro, type PeriodoPreset } from '@/lib/financeiroPeriodo'

export default function BarraFiltrosPeriodo({periodo,onPeriodo,onExportar,adicional}: {
 periodo:PeriodoFinanceiro;onPeriodo:(p:PeriodoFinanceiro)=>void;onExportar:()=>void;adicional?:React.ReactNode
}) {
 const alterar=(chave:'inicio'|'fim',valor:string)=>onPeriodo({...periodo,preset:'personalizado',[chave]:valor})
 return <section className="rounded-2xl border bg-white p-4 shadow-sm print:hidden" aria-label="Filtros do relatório financeiro">
  <div className="flex flex-wrap items-center gap-2">
   <span className="mr-1 text-sm font-semibold text-slate-700">Vencimento:</span>
   {([['todos','Todos'],['hoje','Hoje'],['semana','Esta semana'],['mes','Este mês'],['proximo_mes','Próximo mês']] as [PeriodoPreset,string][]).map(([v,label])=><button key={v} onClick={()=>onPeriodo(periodoRapido(v))} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${periodo.preset===v?'border-blue-700 bg-blue-900 text-white':'bg-white text-slate-600'}`}>{label}</button>)}
  </div>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs font-semibold text-slate-600">De<input aria-label="Vencimento inicial" type="date" value={periodo.inicio} onChange={e=>alterar('inicio',e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
   <label className="text-xs font-semibold text-slate-600">Até<input aria-label="Vencimento final" type="date" value={periodo.fim} min={periodo.inicio||undefined} onChange={e=>alterar('fim',e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
   {adicional}
   <button onClick={()=>window.print()} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2.5 text-xs font-bold text-slate-700"><Printer size={15}/>Imprimir / PDF</button>
   <button onClick={onExportar} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white"><Download size={15}/>Excel (CSV)</button>
  </div>
  {periodo.inicio&&periodo.fim&&periodo.inicio>periodo.fim&&<p className="mt-2 text-xs font-medium text-red-700">A data inicial não pode ultrapassar a final.</p>}
 </section>
}
