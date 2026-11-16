'use client'

import { Plus, Trash2 } from 'lucide-react'
import {
  resumoPagamentoOrcamento, reais, valorMoeda,
  type DestinoSaldoOrcamento
} from '@/lib/previews/pagamentoOrcamento'

export type LinhaCondicaoPreview={id:number;forma:string;valor:string}
type Props={
  condicoes:LinhaCondicaoPreview[]
  total:number
  temPendencias:boolean
  clienteId:string
  clienteNome:string
  destinoSaldo:DestinoSaldoOrcamento
  inputClass:string
  onAlterar:(id:number,campo:'forma'|'valor',valor:string)=>void
  onAdicionar:()=>void
  onRemover:(id:number)=>void
  onDestinoSaldo:(tipo:DestinoSaldoOrcamento)=>void
  onDescontoAdicional:(diferencaReais:number)=>void
  children?:React.ReactNode
}
const formas=['PIX','Dinheiro','Cartão de débito','Cartão de crédito','Transferência','Boleto']

export default function CondicoesPagamentoOrcamentoPreview({
  condicoes,total,temPendencias,clienteId,clienteNome,destinoSaldo,inputClass,
  onAlterar,onAdicionar,onRemover,onDestinoSaldo,onDescontoAdicional,children
}:Props){
  const resumo=resumoPagamentoOrcamento(total,condicoes)
  const temSaldo=resumo.saldoCentavos>0
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-black">Condições de pagamento da proposta</h3>
    <p className="mt-1 text-xs text-slate-500">
      Informe os valores de cada forma de pagamento. A distribuição é apenas prevista; nenhum recebimento ou dívida é registrado.
    </p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-4 py-3 text-blue-900">
      <span className="text-sm font-bold">{temPendencias?'Subtotal conhecido (orçamento ainda pendente)':'Valor total do orçamento'}</span>
      <strong className="text-lg">{valorMoeda(total)}</strong>
    </div>
    <div className="mt-3 space-y-3">
      {condicoes.map((c,i)=><div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <label className="min-w-0 text-xs font-bold">Forma {i+1}
          <select className={inputClass+' mt-1'} value={c.forma}
            onChange={e=>onAlterar(c.id,'forma',e.target.value)}>
            {formas.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold">Valor previsto (R$)
          <input className={inputClass+' mt-1'} type="text" inputMode="decimal" value={c.valor}
            onChange={e=>onAlterar(c.id,'valor',e.target.value)}
            placeholder="Ex.: 100,00" aria-label={'Valor da forma de pagamento '+(i+1)}/>
        </label>
        <button type="button" disabled={condicoes.length===1}
          onClick={()=>onRemover(c.id)} aria-label={'Remover forma '+(i+1)}
          className="rounded-xl border p-3 text-red-600 disabled:opacity-30">
          <Trash2 size={16}/>
        </button>
      </div>)}
    </div>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
      <button type="button" onClick={onAdicionar}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700">
        <Plus size={15}/> Adicionar outra forma de pagamento
      </button>
      {children}
    </div>
    <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span>Valor total do orçamento{temPendencias?' (parcial conhecido)':''}</span>
        <b>{valorMoeda(total)}</b>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Distribuído entre formas de pagamento</span>
        <b>{valorMoeda(reais(resumo.valorPrevistoCentavos))}</b>
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2 font-extrabold">
        <span>{resumo.excedenteCentavos?'Valor excedente':'Saldo ainda não distribuído'}</span>
        <b className={resumo.excedenteCentavos||temSaldo?'text-amber-800':'text-green-700'}>
          {valorMoeda(reais(resumo.excedenteCentavos||resumo.saldoCentavos))}
        </b>
      </div>
      {resumo.possuiValorInvalido&&<p role="alert" className="text-xs font-bold text-red-700">
        Digite somente valores em reais (ex.: 100,00), sem percentual ou texto. {resumo.quantosInvalidos} campo(s) inválido(s).
      </p>}
      {resumo.excedenteCentavos>0&&<p role="alert" className="text-xs font-bold text-red-700">
        A soma das formas de pagamento ultrapassou o valor do orçamento. Corrija os valores antes de imprimir.
      </p>}
      {!resumo.temValorInformado&&<p className="text-xs text-slate-500">
        Informe os valores para acompanhar a distribuição. Se nenhuma condição for definida, a proposta sairá com pagamento a combinar.
      </p>}
      {temPendencias&&<p className="text-xs font-bold text-amber-800">
        Existem itens ou fórmulas sem preço. O saldo acima é apenas sobre os produtos já precificados.
      </p>}
    </div>
    {temSaldo&&!resumo.excedenteCentavos&&!resumo.possuiValorInvalido&&!temPendencias&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <b className="block text-sm text-amber-950">Como tratar os {valorMoeda(reais(resumo.saldoCentavos))} que faltam?</b>
      <p className="mt-1 text-xs text-amber-900">Defina a diferença antes de gerar a proposta, caso tenha informado algum valor de pagamento.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {resumo.temValorInformado&&<button type="button"
          onClick={()=>{onDescontoAdicional(reais(resumo.saldoCentavos));onDestinoSaldo('a_definir')}}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950">
          Aplicar {valorMoeda(reais(resumo.saldoCentavos))} como desconto adicional
        </button>}
        <label className={'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold '+
          (destinoSaldo==='cliente'?'border-indigo-700 bg-indigo-50 text-indigo-900':'border-amber-300 bg-white text-amber-950')}>
          <input type="checkbox" checked={destinoSaldo==='cliente'}
            onChange={e=>onDestinoSaldo(e.target.checked?'cliente':'a_definir')}
            disabled={!clienteId}/>
          Deixar saldo previsto no cliente
        </label>
      </div>
      {!clienteId&&<p className="mt-2 text-xs font-bold text-amber-900">
        Para deixar marcado, selecione primeiro um cliente já cadastrado no Atlas One.
      </p>}
      {destinoSaldo==='cliente'&&clienteId&&<p className="mt-2 text-xs font-bold text-indigo-800">
        Saldo previsto para {clienteNome||'cliente cadastrado'}: {valorMoeda(reais(resumo.saldoCentavos))}.
        Não é feito lançamento no cadastro nesta prévia.
      </p>}
    </div>}
  </section>
}
