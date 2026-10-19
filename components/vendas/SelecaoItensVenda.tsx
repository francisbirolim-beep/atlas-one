'use client'
import { CheckCircle2, CircleAlert, CircleCheck, ListChecks } from 'lucide-react'
import { quantidadeOriginal, precoTotalItem, resumirSelecaoVenda, type ItemOrcamentoVenda, type SelecionadoVenda } from '@/lib/vendaSelecaoItens'

type Modo='total'|'parcial'
export default function SelecaoItensVenda({
 itens,modo,onModo,selecao,onSelecao,orcamentoValor,
}:{
 itens:ItemOrcamentoVenda[];modo:Modo;onModo:(v:Modo)=>void
 selecao:SelecionadoVenda[];onSelecao:(v:SelecionadoVenda[])=>void
 orcamentoValor:number
}) {
 const resumo=resumirSelecaoVenda(itens,selecao)
 function alternar(indice:number) {
  const existente=selecao.find(s=>s.indice===indice)
  if(existente)onSelecao(selecao.filter(s=>s.indice!==indice))
  else onSelecao([...selecao,{indice,quantidade:quantidadeOriginal(itens[indice])}])
 }
 function mudarValor(indice:number,valor:string){
  const n=valor.trim()===''?null:Number(valor)
  onSelecao(selecao.map(s=>s.indice===indice?{...s,valorFechado:n}:s))
 }
 function mudarQuantidade(indice:number,n:number){
  onSelecao(selecao.map(s=>s.indice===indice?{...s,quantidade:Math.min(quantidadeOriginal(itens[indice]),Math.max(1,Math.floor(n)||1))}:s))
 }
 return <section className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4" aria-label="Escolha de venda total ou parcial">
  <div className="mb-3"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ListChecks size={17}/> O que o cliente comprou?</h3>
   <p className="mt-1 text-xs text-slate-600">Confira quais tipologias foram vendidas. Itens não vendidos continuam no orçamento original.</p></div>
  <div className="grid gap-2 sm:grid-cols-2">
   <button type="button" onClick={()=>onModo('total')} aria-pressed={modo==='total'} className={`rounded-xl border p-3 text-left text-sm font-bold ${modo==='total'?'border-blue-700 bg-blue-100 text-blue-900':'bg-white text-slate-600'}`}>
    <CircleCheck size={17} className="mr-1 inline"/> Vendi tudo
    <span className="mt-1 block text-[11px] font-normal">Mantém a confirmação atual, com todas as tipologias.</span>
   </button>
   <button type="button" onClick={()=>onModo('parcial')} aria-pressed={modo==='parcial'} className={`rounded-xl border p-3 text-left text-sm font-bold ${modo==='parcial'?'border-blue-700 bg-blue-100 text-blue-900':'bg-white text-slate-600'}`}>
    <CheckCircle2 size={17} className="mr-1 inline"/> Vendi parcialmente
    <span className="mt-1 block text-[11px] font-normal">Escolha quais tipologias e quantidades foram fechadas.</span>
   </button>
  </div>
  {modo==='parcial'&&<div className="mt-4 space-y-3">
   {itens.map((item,indice)=>{
    const atual=selecao.find(s=>s.indice===indice),total=quantidadeOriginal(item)
    return <div key={String(item.id||indice)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
       <input type="checkbox" checked={!!atual} onChange={()=>alternar(indice)} className="h-4 w-4 accent-blue-700"/>
       <span className="min-w-0"><b className="block text-sm text-slate-800">Item {indice+1} — {String(item.ambiente||item.descricao||item.tipo_outro_texto||item.tipo_esquadria||'Sem descrição')}</b>
         <span className="block text-xs text-slate-500">{String(item.descricao||item.tipo_esquadria||'')} · {total} peça(s) orçada(s)</span>
       </span>
      </label>
      {atual&&<div className="flex flex-wrap items-end gap-2">
       <label className="text-xs font-semibold text-slate-600">Quantidade vendida
        <input type="number" min={1} max={total} step={1} value={atual.quantidade} onChange={e=>mudarQuantidade(indice,Number(e.target.value))} className="mt-1 block w-24 rounded-lg border p-2 text-sm" aria-label={`Quantidade vendida do item ${indice+1}`}/>
       </label>
       <label className="text-xs font-semibold text-slate-600">Valor fechado (R$)
        <input type="number" min={0} step="0.01" value={atual.valorFechado??''} onChange={e=>mudarValor(indice,e.target.value)} placeholder={precoTotalItem(item)===null?'Informe valor':String(Math.round(precoTotalItem(item)!*atual.quantidade/total*100)/100)} className="mt-1 block w-32 rounded-lg border p-2 text-sm" aria-label={`Valor fechado do item ${indice+1}`}/>
       </label>
      </div>}
    </div>
   })}
   <div className="rounded-xl border border-blue-200 bg-white p-3 text-xs">
    <div className="flex items-center justify-between gap-3"><b className="text-slate-800">Resumo da seleção</b><b>{resumo.pecas} peça(s)</b></div>
    <p className="mt-1 text-slate-600">{selecao.length} tipologia(s) selecionada(s) de {itens.length}</p>
    <p className="mt-1 text-slate-600">Orçamento original: {orcamentoValor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
    <p className="mt-1 text-slate-600">Valor selecionado (estimado ou informado): {resumo.valorEstimado===null?'Precificação individual não disponível':resumo.valorEstimado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
    {!resumo.valida&&<p className="mt-2 flex items-center gap-1 font-semibold text-amber-700"><CircleAlert size={13}/>{resumo.erros.join('; ')}</p>}
    {resumo.valida&&!resumo.parcial&&<p className="mt-2 text-amber-700">Todas as peças estão marcadas. Use “Vendi tudo” para manter a confirmação existente.</p>}
   </div>
   <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><b>Prévia segura:</b> a escolha parcial ainda não confirma a venda. O registro definitivo será liberado somente quando a seleção alimentar corretamente o financeiro, a engenharia, as compras e a produção. Nenhum item não vendido pode entrar nesses setores.</p>
  </div>}
 </section>
}
