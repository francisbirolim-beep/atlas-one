'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {ArrowDownCircle,ArrowUpCircle,RefreshCw,Wallet,Landmark,ShieldCheck} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Movimento={id:string;tipo:'entrada'|'saida';situacao:'realizado'|'previsto';data:string;descricao:string;origem:string;valor:number;categoria:string;grupo:string}
type Resumo={entradasRealizadas:number;saidasRealizadas:number;entradasPrevistas:number;saidasPrevistas:number}
type Dados={movimentos:Movimento[];resumo:Resumo;avisos:string[]}
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
function mesAtual(){
 const agora=new Date()
 const f=new Date(agora.getTime()-agora.getTimezoneOffset()*60000).toISOString().slice(0,10)
 return {inicio:f.slice(0,7)+'-01',fim:f}
}
const classes='rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
export default function FluxoCaixaPage(){
 const [periodo,setPeriodo]=useState(mesAtual)
 const [dados,setDados]=useState<Dados|null>(null)
 const [erro,setErro]=useState('')
 const [loading,setLoading]=useState(true)
 const [tab,setTab]=useState<'todos'|'realizado'|'previsto'>('todos')
 const [busca,setBusca]=useState('')
 const carregar=useCallback(async()=>{
  setLoading(true);setErro('')
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Faça login para visualizar o fluxo de caixa.')
   const query=new URLSearchParams({inicio:periodo.inicio,fim:periodo.fim})
   const r=await fetch('/api/financeiro/fluxo-caixa?'+query.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Não foi possível carregar o fluxo de caixa.')
   setDados({movimentos:j.movimentos||[],resumo:j.resumo,avisos:j.avisos||[]})
  }catch(e){setErro(e instanceof Error?e.message:'Falha na consulta.');setDados(null)}
  finally{setLoading(false)}
 },[periodo.inicio,periodo.fim])
 useEffect(()=>{void carregar()},[carregar])
 const movimentos=useMemo(()=>dados?.movimentos.filter(m=>
  (tab==='todos'||m.situacao===tab)&&
  (!busca.trim()||(m.descricao+' '+m.origem+' '+m.categoria+' '+m.grupo).toLowerCase().includes(busca.toLowerCase().trim())))||[],[dados,tab,busca])
 const r=dados?.resumo
 const saldo=r?(r.entradasRealizadas-r.saidasRealizadas):0
 const previsto=r?(r.entradasPrevistas-r.saidasPrevistas):0
 const cards=[
  {nome:'Entradas realizadas',valor:r?.entradasRealizadas||0,cor:'text-emerald-700',icon:ArrowUpCircle},
  {nome:'Saídas realizadas',valor:r?.saidasRealizadas||0,cor:'text-red-700',icon:ArrowDownCircle},
  {nome:'Diferença do período',valor:saldo,cor:'text-blue-700',icon:Wallet},
  {nome:'Diferença prevista',valor:previsto,cor:'text-amber-700',icon:Landmark}
 ]
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Financeiro · Homologação</div>
    <h1 className="mt-1 text-2xl font-extrabold text-slate-950">Fluxo de Caixa</h1>
    <p className="mt-1 text-sm text-slate-600">Consulta das movimentações do Contas a Pagar e do Contas a Receber, sem duplicar lançamentos.</p></div>
   <div className="flex flex-wrap gap-2">
    <Link href="/financeiro/contas-pagar" className={classes}>Contas a Pagar</Link>
    <Link href="/financeiro/contas-receber" className={classes}>Contas a Receber</Link>
    <button className={classes} disabled={loading} onClick={()=>void carregar()}><RefreshCw size={16} className={'inline mr-1 '+(loading?'animate-spin':'')}/>Atualizar</button>
   </div>
  </header>
  <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
    <div className="flex items-start gap-2"><ShieldCheck className="shrink-0" size={19}/><div><b>Consulta integrada em homologação — exclusiva do Master.</b>
     <p className="mt-1">Os números vêm das contas existentes. Esta tela não cria pagamentos, altera o banco nem calcula saldo bancário oficial.
       A vinculação com bancos, conciliação diária e DRE por competência ainda exige validação contábil e técnica.</p></div></div>
  </section>
  <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
    <label className="text-xs font-semibold text-slate-600">De<input type="date" value={periodo.inicio} max={periodo.fim} onChange={e=>setPeriodo(p=>({...p,inicio:e.target.value}))} className={'mt-1 block '+classes}/></label>
    <label className="text-xs font-semibold text-slate-600">Até<input type="date" value={periodo.fim} min={periodo.inicio} onChange={e=>setPeriodo(p=>({...p,fim:e.target.value}))} className={'mt-1 block '+classes}/></label>
    <span className="ml-auto text-xs text-slate-500">Período selecionado · datas de liquidação e vencimento</span>
  </section>
  {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}
  {loading?<p className="p-5 text-sm text-slate-500">Consultando dados financeiros...</p>:dados&&<>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(c=><div key={c.nome} className="rounded-xl border bg-white p-5"><p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><c.icon size={17}/>{c.nome}</p><p className={'mt-3 text-xl font-bold tabular-nums '+c.cor}>{money(c.valor)}</p></div>)}</div>
   <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
    <section className="min-w-0 rounded-xl border bg-white p-4">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-bold text-slate-900">Movimentações</h2>
      <div className="flex gap-2">{(['todos','realizado','previsto'] as const).map(op=><button key={op} onClick={()=>setTab(op)} className={'rounded-lg px-3 py-1.5 text-xs font-bold '+(tab===op?'bg-blue-700 text-white':'border bg-white text-slate-600')}>{op==='todos'?'Todas':op==='realizado'?'Realizadas':'Previstas'}</button>)}</div>
     </div>
     <input aria-label="Buscar movimentações" placeholder="Buscar descrição, origem ou grupo DRE..." value={busca} onChange={e=>setBusca(e.target.value)} className={'my-4 w-full '+classes}/>
     <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Grupo / categoria DRE</th><th className="p-3">Origem</th><th className="p-3">Situação</th><th className="p-3 text-right">Valor</th></tr></thead>
      <tbody>{movimentos.map(m=><tr key={m.id} className="border-t"><td className="p-3">{m.data.split('-').reverse().join('/')}</td><td className="p-3 font-semibold text-slate-800">{m.descricao}</td><td className="p-3"><span>{m.categoria}</span><div className="text-[10px] text-slate-500">{m.grupo==='nao_classificado'?'Classificação pendente':m.grupo}</div></td><td className="p-3">{m.origem}</td><td className="p-3">{m.situacao==='realizado'?'Realizado':'Previsto'}</td><td className={'p-3 text-right font-bold tabular-nums '+(m.tipo==='entrada'?'text-emerald-700':'text-red-700')}>{m.tipo==='entrada'?'+':'−'} {money(m.valor)}</td></tr>)}
      {!movimentos.length&&<tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma movimentação neste filtro.</td></tr>}</tbody></table>
     </div>
    </section>
    <aside className="space-y-4">
     <section className="rounded-xl border bg-white p-4"><h2 className="flex items-center gap-2 font-bold"><Landmark size={18}/>Bancos e saldos</h2>
       <p className="mt-2 text-sm text-slate-600">A conciliação diária só será habilitada após o cadastro seguro dos bancos e o vínculo de cada baixa à conta de origem ou destino.</p>
       <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">Saldo bancário não calculado nesta versão. Não confundir diferença do fluxo com dinheiro disponível.</p></section>
     <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">DRE e classificação</h2>
       <p className="mt-2 text-sm text-slate-600">Descrições identificam o que foi pago ou recebido; o grupo DRE deve ser escolhido separadamente, conforme o plano de contas já existente.</p>
       <p className="mt-2 text-xs text-slate-500">Uma saída de caixa nem sempre é despesa da DRE (por exemplo, transferência, estoque ou equipamento).</p></section>
    </aside>
   </div>
   <section className="rounded-xl border bg-slate-50 p-4 text-xs text-slate-600"><b>Limites desta homologação</b><ul className="mt-2 list-inside list-disc space-y-1">{dados.avisos.map(a=><li key={a}>{a}</li>)}</ul></section>
  </>}
 </div></main>
}