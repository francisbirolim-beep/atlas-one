'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowDownCircle,ArrowUpCircle,RefreshCw,Landmark,ShieldCheck,BarChart3,List,CalendarDays,Tags,Plus,Search,Wallet,Pencil,Info} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Movimento={id:string;tipo:'entrada'|'saida';situacao:'realizado'|'previsto';data:string;descricao:string;origem:string;valor:number;categoria:string;grupo:string}
type Resumo={entradasRealizadas:number;saidasRealizadas:number;entradasPrevistas:number;saidasPrevistas:number}
type Dados={movimentos:Movimento[];resumo:Resumo;avisos:string[]}
type Aba='geral'|'movimentacoes'|'previsao'|'bancos'|'dre'
type Escala='dia'|'semana'|'mes'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const dataBR=(s:string)=>s.split('-').reverse().join('/')
const campo='block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none'
function periodoInicial(){const d=new Date();const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);return {inicio:local.slice(0,7)+'-01',fim:local}}
const abas:{id:Aba;nome:string;icon:typeof BarChart3}[]=[
 {id:'geral',nome:'Visão Geral',icon:BarChart3},
 {id:'movimentacoes',nome:'Movimentações',icon:List},
 {id:'previsao',nome:'Previsão',icon:CalendarDays},
 {id:'bancos',nome:'Bancos e Saldos',icon:Landmark},
 {id:'dre',nome:'Categorias / DRE',icon:Tags}
]
function chaveEscala(s:string,escala:Escala){
 if(escala==='dia')return s
 if(escala==='mes')return s.slice(0,7)
 const d=new Date(s+'T12:00:00Z');const wd=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-wd)
 return d.toISOString().slice(0,10)
}
function Grafico({movimentos,escala}:{movimentos:Movimento[];escala:Escala}){
 const pontos=useMemo(()=>{
  const porPeriodo=new Map<string,{entrada:number;saida:number}>()
  for(const m of movimentos){
   if(m.situacao!=='realizado')continue
   const k=chaveEscala(m.data,escala);const item=porPeriodo.get(k)||{entrada:0,saida:0}
   item[m.tipo]+=m.valor;porPeriodo.set(k,item)
  }
  let acumulado=0
  return Array.from(porPeriodo.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([data,v])=>{
   acumulado+=v.entrada-v.saida;return {data,...v,saldo:acumulado}
  })
 },[movimentos,escala])
 if(!pontos.length)return <div className="flex h-56 items-center justify-center text-sm text-slate-500">Nenhuma movimentação realizada no período selecionado.</div>
 const w=760,h=245,top=16,bottom=39,left=60,right=18,usableW=w-left-right,usableH=h-top-bottom
 const valores=pontos.flatMap(p=>[p.entrada,p.saida,p.saldo])
 const max=Math.max(1,...valores),min=Math.min(0,...valores)
 const intervalo=Math.max(1,max-min),y=(v:number)=>top+(max-v)/intervalo*usableH
 const step=usableW/pontos.length,barW=Math.min(12,step*.24),zero=y(0)
 const linha=pontos.map((p,i)=>(i===0?'M':'L')+(left+step*(i+.5)).toFixed(2)+' '+y(p.saldo).toFixed(2)).join(' ')
 const pulos=Math.max(1,Math.ceil(pontos.length/9))
 return <div className="overflow-x-auto">
  <svg viewBox={'0 0 '+w+' '+h} className="min-w-[500px] w-full" role="img" aria-label="Gráfico de entradas, saídas e saldo acumulado do período, sem saldo bancário">
   {Array.from({length:5},(_,i)=>{const v=min+intervalo*(i/4),yy=y(v);return <g key={i}><line x1={left} y1={yy} x2={w-right} y2={yy} stroke="#e2e8f0"/><text x={left-8} y={yy+4} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(v).toLocaleString('pt-BR')}</text></g>})}
   <line x1={left} x2={w-right} y1={zero} y2={zero} stroke="#94a3b8" strokeWidth="1"/>
   {pontos.map((p,i)=>{const cx=left+step*(i+.5),a=y(p.entrada),b=y(-p.saida);return <g key={p.data}>
    <rect x={cx-barW-1} y={Math.min(a,zero)} width={barW} height={Math.max(1,Math.abs(zero-a))} fill="#22a06b"/>
    <rect x={cx+1} y={Math.min(b,zero)} width={barW} height={Math.max(1,Math.abs(zero-b))} fill="#ed6666"/>
    {i%pulos===0&&<text x={cx} y={h-19} fontSize="10" textAnchor="middle" fill="#64748b">{escala==='mes'?p.data.slice(5,7)+'/'+p.data.slice(0,4):dataBR(p.data).slice(0,5)}</text>}
   </g>})}
   <path d={linha} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round"/>
   {pontos.map((p,i)=><circle key={p.data} cx={left+step*(i+.5)} cy={y(p.saldo)} r="2.4" fill="#2563eb"/>)}
  </svg>
  <div className="flex flex-wrap justify-center gap-5 text-xs text-slate-600"><span><b className="text-emerald-600">■</b> Entradas</span><span><b className="text-red-500">■</b> Saídas</span><span><b className="text-blue-600">●</b> Saldo acumulado no período</span></div>
 </div>
}
export default function FluxoCaixaPage(){
 const [periodo,setPeriodo]=useState(periodoInicial)
 const [dados,setDados]=useState<Dados|null>(null)
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [aba,setAba]=useState<Aba>('geral')
 const [escala,setEscala]=useState<Escala>('dia')
 const [busca,setBusca]=useState('')
 const [categoria,setCategoria]=useState('todas')
 const [incluirPrevistos,setIncluirPrevistos]=useState(true)
 const [novoAberto,setNovoAberto]=useState(false)
 const carregar=useCallback(async()=>{
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Faça login para visualizar o fluxo de caixa.')
   const q=new URLSearchParams({inicio:periodo.inicio,fim:periodo.fim})
   const res=await fetch('/api/financeiro/fluxo-caixa?'+q.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await res.json()
   if(!res.ok)throw Error(j.error||'Não foi possível consultar o fluxo de caixa.')
   setDados({movimentos:j.movimentos||[],resumo:j.resumo,avisos:j.avisos||[]})
  }catch(e){setErro(e instanceof Error?e.message:'Falha na consulta');setDados(null)}
  finally{setCarregando(false)}
 },[periodo.inicio,periodo.fim])
 useEffect(()=>{void carregar()},[carregar])
 const categorias=useMemo(()=>Array.from(new Set((dados?.movimentos||[]).map(m=>m.categoria))).sort(),[dados])
 const base=useMemo(()=>(dados?.movimentos||[]).filter(m=>(categoria==='todas'||m.categoria===categoria)&&(!busca.trim()||(m.descricao+' '+m.categoria+' '+m.origem+' '+m.grupo).toLowerCase().includes(busca.trim().toLowerCase()))),[dados,categoria,busca])
 const movimentos=useMemo(()=>base.filter(m=>incluirPrevistos||m.situacao==='realizado').filter(m=>aba!=='previsao'||m.situacao==='previsto'),[base,incluirPrevistos,aba])
 const totals=useMemo(()=>{
  const soma=(tipo:Movimento['tipo'],situacao:Movimento['situacao'])=>base.filter(m=>m.tipo===tipo&&m.situacao===situacao).reduce((s,m)=>s+m.valor,0)
  return {entradas:soma('entrada','realizado'),saidas:soma('saida','realizado'),prevEntradas:soma('entrada','previsto'),prevSaidas:soma('saida','previsto')}
 },[base])
 const resultado=totals.entradas-totals.saidas
 const resumodre=useMemo(()=>{
  const grupos=new Map<string,{entrada:number;saida:number}>()
  for(const m of base){if(m.situacao!=='realizado')continue;const g=m.grupo==='nao_classificado'?'A classificar':m.grupo;const v=grupos.get(g)||{entrada:0,saida:0};v[m.tipo]+=m.valor;grupos.set(g,v)}
  return Array.from(grupos.entries()).sort(([a],[b])=>a.localeCompare(b))
 },[base])
 return <main className="min-h-screen bg-slate-50 p-3 sm:p-5"><div className="mx-auto max-w-[1500px] space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><div className="text-xs font-semibold text-slate-500">FINANCEIRO · Atlas One</div><h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1></div>
   <button onClick={()=>void carregar()} disabled={carregando} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={carregando?'animate-spin':''}/>Atualizar dados</button>
  </header>
  <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Seções do Fluxo de Caixa">{abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} className={'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm '+(aba===a.id?'bg-blue-700 text-white':'text-slate-700 hover:bg-slate-200')}><a.icon size={15}/>{a.nome}</button>)}</nav>
  <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
   <label className="min-w-[140px] flex-1 text-xs font-semibold text-slate-600">Data inicial<input type="date" value={periodo.inicio} max={periodo.fim} onChange={e=>setPeriodo(p=>({...p,inicio:e.target.value}))} className={'mt-1 '+campo}/></label>
   <label className="min-w-[140px] flex-1 text-xs font-semibold text-slate-600">Data final<input type="date" value={periodo.fim} min={periodo.inicio} onChange={e=>setPeriodo(p=>({...p,fim:e.target.value}))} className={'mt-1 '+campo}/></label>
   <label className="min-w-[150px] flex-1 text-xs font-semibold text-slate-600">Conta / Banco<select value="nao-vinculado" disabled className={'mt-1 '+campo+' cursor-not-allowed bg-slate-50'}><option value="nao-vinculado">Sem conciliação bancária</option></select></label>
   <label className="min-w-[170px] flex-1 text-xs font-semibold text-slate-600">Categoria DRE<select value={categoria} onChange={e=>setCategoria(e.target.value)} className={'mt-1 '+campo}><option value="todas">Todas as categorias</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={incluirPrevistos} onChange={e=>setIncluirPrevistos(e.target.checked)} className="accent-blue-700"/>Considerar previstos</label>
   <div className="relative">
    <button onClick={()=>setNovoAberto(v=>!v)} aria-expanded={novoAberto} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"><Plus size={16}/>Novo lançamento</button>
    {novoAberto&&<div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border bg-white p-1 shadow-lg"><Link href="/financeiro/contas-pagar" className="block rounded px-3 py-2 text-sm hover:bg-slate-100">Em Contas a Pagar</Link><Link href="/financeiro/contas-receber" className="block rounded px-3 py-2 text-sm hover:bg-slate-100">Em Contas a Receber</Link></div>}
   </div>
  </section>
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
  {carregando&&<p className="rounded-lg border bg-white p-5 text-sm text-slate-600">Consultando movimentações financeiras...</p>}
  {!carregando&&dados&&<>
   <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ArrowUpCircle size={18} className="text-emerald-600"/>Entradas (recebimentos)</div><div className="mt-2 text-xl font-bold tabular-nums text-emerald-700">{money(totals.entradas)}</div></div>
    <div className="rounded-xl border border-red-100 bg-red-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ArrowDownCircle size={18} className="text-red-600"/>Saídas (pagamentos)</div><div className="mt-2 text-xl font-bold tabular-nums text-red-700">{money(totals.saidas)}</div></div>
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Wallet size={18} className="text-blue-600"/>Saldo do período</div><div className="mt-2 text-xl font-bold tabular-nums text-blue-700">{money(resultado)}</div></div>
    <div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Wallet size={18} className="text-violet-600"/>Saldo anterior</div><div className="mt-2 text-lg font-bold text-slate-600">Não conciliado</div></div>
    <div className="rounded-xl border border-green-100 bg-green-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Landmark size={18} className="text-emerald-600"/>Saldo atual</div><div className="mt-2 text-lg font-bold text-slate-600">Não conciliado</div></div>
   </section>
   {(aba==='geral'||aba==='movimentacoes'||aba==='previsao')&&<div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_285px]">
    <div className="min-w-0 space-y-3">
     {aba==='geral'&&<section className="rounded-xl border bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold text-slate-900">Evolução do Fluxo de Caixa</h2>
       <div className="flex gap-1">{(['dia','semana','mes'] as const).map(e=><button key={e} onClick={()=>setEscala(e)} className={'rounded px-3 py-1 text-xs font-semibold '+(escala===e?'bg-blue-700 text-white':'border bg-white text-slate-600')}>{e==='dia'?'Diário':e==='semana'?'Semanal':'Mensal'}</button>)}</div></div>
      <Grafico movimentos={base} escala={escala}/>
     </section>}
     <section className="rounded-xl border bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">{aba==='previsao'?'Movimentações previstas':'Movimentações do período'}</h2>
       <label className="flex items-center gap-2 rounded-lg border px-2"><Search size={14} className="text-slate-500"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar lançamento..." className="w-44 py-2 text-xs outline-none sm:w-60"/></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2">Categoria (DRE)</th><th className="p-2">Tipo</th><th className="p-2">Conta/Banco</th><th className="p-2 text-right">Valor (R$)</th><th className="p-2">Origem</th></tr></thead>
       <tbody>{movimentos.map(m=><tr key={m.id} className="border-t"><td className="whitespace-nowrap p-2">{dataBR(m.data)}</td><td className="max-w-52 p-2 font-medium text-slate-800">{m.descricao}</td><td className="p-2"><span className="rounded bg-violet-50 px-1.5 py-1 text-violet-800">{m.categoria}</span></td><td className="p-2"><span className={'rounded px-1.5 py-1 '+(m.tipo==='entrada'?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-800')}>{m.tipo==='entrada'?'↑ Entrada':'↓ Saída'}</span></td><td className="p-2 text-slate-500">Não vinculado</td><td className={'whitespace-nowrap p-2 text-right font-bold tabular-nums '+(m.tipo==='entrada'?'text-emerald-700':'text-red-700')}>{m.tipo==='entrada'?'+':'−'} {money(m.valor)}</td><td className="p-2 text-slate-600">{m.origem}{m.situacao==='previsto'?' · Previsto':''}</td></tr>)}
       {!movimentos.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">Nenhuma movimentação neste filtro.</td></tr>}</tbody></table></div>
     </section>
    </div>
    <aside className="space-y-3">
     <section className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><Landmark size={16}/>Saldos por Banco / Conta</h2><button onClick={()=>setAba('bancos')} className="rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700">Ver bancos</button></div>
      <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Não há contas bancárias conciliadas. Saldo real não pode ser calculado apenas pelos títulos a pagar e receber.</div>
     </section>
     <section className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={16}/>Impacto na DRE</h2><button onClick={()=>setAba('dre')} className="rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700">Ver categorias</button></div>
      <div className="mt-3 flex justify-between border-b py-2 text-xs"><span>Entradas classificadas / a classificar</span><b className="text-emerald-700">{money(totals.entradas)}</b></div>
      <div className="flex justify-between border-b py-2 text-xs"><span>Saídas classificadas / a classificar</span><b className="text-red-700">{money(totals.saidas)}</b></div>
      <div className="flex justify-between py-2 text-xs font-semibold"><span>Diferença financeira do período</span><b>{money(resultado)}</b></div>
      <p className="mt-1 rounded bg-slate-50 p-2 text-[11px] text-slate-500">Esta diferença não é lucro nem uma DRE contábil por competência.</p>
     </section>
    </aside>
   </div>}
   {aba==='bancos'&&<section className="rounded-xl border bg-white p-5">
    <h2 className="flex items-center gap-2 font-bold"><Landmark size={18}/>Bancos e Contas</h2>
    <p className="mt-3 text-sm text-slate-700">O Atlas ainda não possui cadastro bancário e conciliação vinculados às baixas financeiras. Antes de habilitar “Cadastrar Banco”, “Editar” e “Atualizar Saldos”, é necessário registrar saldos iniciais auditáveis, vincular a conta de cada pagamento e recebimento e conferir transferências, estornos e divergências.</p>
    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Nenhum saldo bancário foi presumido ou alterado nesta prévia.</p>
   </section>}
   {aba==='previsao'&&<section className="rounded-xl border bg-white p-4 text-sm text-slate-700"><b>Resumo previsto</b><div className="mt-2 flex flex-wrap gap-6"><span>Entradas: <b className="text-emerald-700">{money(totals.prevEntradas)}</b></span><span>Saídas: <b className="text-red-700">{money(totals.prevSaidas)}</b></span><span>Diferença prevista: <b>{money(totals.prevEntradas-totals.prevSaidas)}</b></span></div></section>}
   {aba==='dre'&&<section className="rounded-xl border bg-white p-5">
    <h2 className="flex items-center gap-2 font-bold"><Tags size={18}/>Categorias financeiras e DRE</h2><p className="mt-2 text-sm text-slate-600">Resumo dos pagamentos e recebimentos realizados classificados nas categorias já cadastradas. Não equivale à DRE oficial por competência.</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="bg-slate-50 text-left text-xs"><tr><th className="p-3">Grupo</th><th className="p-3 text-right">Entradas</th><th className="p-3 text-right">Saídas</th><th className="p-3 text-right">Diferença</th></tr></thead><tbody>{resumodre.map(([g,v])=><tr key={g} className="border-t"><td className="p-3">{g}</td><td className="p-3 text-right tabular-nums text-emerald-700">{money(v.entrada)}</td><td className="p-3 text-right tabular-nums text-red-700">{money(v.saida)}</td><td className="p-3 text-right tabular-nums">{money(v.entrada-v.saida)}</td></tr>)}{!resumodre.length&&<tr><td colSpan={4} className="p-6 text-center text-slate-500">Sem movimentos realizados nesse período.</td></tr>}</tbody></table></div>
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Info size={15}/>Receitas e despesas exigem classificação e tratamento por competência antes da apuração contábil.</p>
   </section>}
   <footer className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={15}/>Integração segura com os registros existentes</p><p className="mt-1">Pagamentos e recebimentos já registrados alimentam este fluxo sem lançamentos duplicados. O Caixa operacional da Venda Balcão não foi alterado. Banco, saldos e conciliação exigem implementação e homologação próprias.</p></footer>
  </>}
 </div></main>
}
