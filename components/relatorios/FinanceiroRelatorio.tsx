'use client'

import { BarChart3, Landmark, WalletCards } from 'lucide-react'
export type FinanceiroRelatorioDados = {
 dre:{receitaObras:number;receitaBalcao:number;receitaTotal:number;cmvPrevisto:number;cmvObras:number;cmvBalcao:number;margemBrutaProjetada:number|null;margemPct:number|null;despesasOperacionais:null;tributos:null;lucroLiquido:null;semPrevisao:number;obras:number;balcao:number}
 caixa:{recebido:number;pago:number;saldoParcial:number;meses:{mes:string;recebido:number;pago:number}[]}
 contas:{aReceber:number;aPagar:number;receber:number;pagar:number}
 avisos:string[]
}
const moeda=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
function Cartao({titulo,valor,nota}:{titulo:string;valor:string;nota?:string}) {
 return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-1 text-xl font-bold text-slate-900">{valor}</p>{nota&&<p className="mt-1 text-xs text-slate-500">{nota}</p>}</div>
}
export default function FinanceiroRelatorio({dados,carregando}:{dados:FinanceiroRelatorioDados|null;carregando:boolean}) {
 if(!dados) return <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">{carregando?'Carregando dados financeiros...':'Selecione o período e clique em Aplicar período.'}</p>
 const escala=Math.max(1,...dados.caixa.meses.flatMap(m=>[m.recebido,m.pago]))
 const d=dados.dre
 const linha=(nome:string,valor:number|null,nota?:string)=> <div key={nome} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 py-2 text-sm"><span>{nome}{nota&&<small className="ml-1 text-xs text-slate-400">{nota}</small>}</span><b className="tabular-nums">{valor==null?'Não apurado':moeda(valor)}</b></div>
 return <section className="space-y-5">
  <div><h2 className="text-lg font-bold text-slate-900">Relatórios Financeiros</h2><p className="text-xs text-slate-500">DRE gerencial preliminar, fluxo de recebimentos/pagamentos e saldos a vencer. Baseados nos registros atuais do Atlas.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <Cartao titulo="Entradas registradas" valor={moeda(dados.caixa.recebido)} nota="Recebimentos com data no período"/>
   <Cartao titulo="Pagamentos registrados" valor={moeda(dados.caixa.pago)} nota="Contas pagas com data no período"/>
   <Cartao titulo="A receber" valor={moeda(dados.contas.aReceber)} nota="Parcelas com vencimento no período"/>
   <Cartao titulo="A pagar" valor={moeda(dados.contas.aPagar)} nota="Obrigações com vencimento no período"/>
  </div>
  <div className="grid gap-4 xl:grid-cols-2">
   <section className="rounded-xl border bg-white p-4">
    <div className="mb-3 flex items-center gap-2"><Landmark size={18} className="text-blue-600"/><h3 className="font-bold">DRE gerencial — prévia</h3></div>
    <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Não é uma DRE contábil/fiscal fechada. A receita refere-se a vendas confirmadas, e o CMV de obras é previsto.</p>
    {linha('Receita contratada de obras',d.receitaObras,'vendas confirmadas')}
    {linha('Vendas de balcão',d.receitaBalcao,'finalizadas')}
    {linha('Receita comercial total',d.receitaTotal)}
    {linha('(–) CMV previsto',-d.cmvPrevisto,'WVetro + custo de balcão')}
    {linha('Margem bruta projetada',d.margemBrutaProjetada)}
    <div className="py-2 text-xs text-slate-500">Margem bruta prevista: {d.margemPct==null?'não disponível':d.margemPct.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%'}</div>
    {linha('(–) Tributos sobre vendas',null)}
    {linha('(–) Despesas operacionais',null)}
    {linha('Lucro / prejuízo líquido',null)}
    {d.semPrevisao>0&&<p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">Existem {d.semPrevisao} venda(s) com previsão de CMV incompleta.</p>}
   </section>
   <section className="rounded-xl border bg-white p-4">
    <div className="mb-3 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600"/><h3 className="font-bold">Fluxo registrado por mês</h3></div>
    {dados.caixa.meses.map(m=><div key={m.mes} className="mb-3 border-b pb-3 last:border-0"><p className="mb-1 text-xs font-semibold">{m.mes.split('-').reverse().join('/')}</p>
     <div className="grid grid-cols-[65px_1fr_auto] items-center gap-2 text-xs"><span>Entradas</span><div className="h-3 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-blue-600" style={{width:(m.recebido/escala)*100+'%'}}/></div><b className="tabular-nums">{moeda(m.recebido)}</b>
     <span>Saídas</span><div className="h-3 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-amber-500" style={{width:(m.pago/escala)*100+'%'}}/></div><b className="tabular-nums">{moeda(m.pago)}</b></div></div>)}
    <div className="mt-3 border-t pt-3"><Cartao titulo="Diferença dos movimentos registrados" valor={moeda(dados.caixa.saldoParcial)} nota="Parcial; não é saldo bancário nem lucro líquido"/></div>
   </section>
  </div>
  <section className="rounded-xl border bg-white p-4"><div className="mb-3 flex items-center gap-2"><WalletCards size={18}/><h3 className="font-bold">Títulos por vencimento</h3></div><div className="grid gap-3 sm:grid-cols-2"><Cartao titulo="Contas a receber" valor={moeda(dados.contas.aReceber)} nota={dados.contas.receber+' título(s) no período'}/><Cartao titulo="Contas a pagar" valor={moeda(dados.contas.aPagar)} nota={dados.contas.pagar+' título(s) no período'}/></div><p className="mt-2 text-xs text-slate-500">Saldos abertos até a consulta, filtrados pela data de vencimento. Não somar esses valores às entradas e saídas realizadas.</p></section>
  <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><h3 className="text-sm font-semibold text-amber-950">Notas sobre fechamento contábil e conciliação</h3><div className="mt-2 space-y-1">{dados.avisos.map(a=><p key={a} className="text-xs text-amber-900">• {a}</p>)}</div></section>
 </section>
}
