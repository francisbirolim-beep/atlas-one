'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clock3, Filter, LayoutGrid, RefreshCw, Search, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, WalletCards } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import RelacionamentoPreview from '@/components/crm/RelacionamentoPreview'

type Etapa='novo'|'qualificacao'|'visita'|'proposta'|'negociacao'|'ganho'|'perdido'
type Oportunidade={
  id:string;clienteId:string|null;nome:string;obra:string|null;cidade:string|null;canal:string|null;
  responsavel:string;etapa:Etapa;temperatura:'quente'|'morno'|'frio';valor:number|null;
  atualizadoEm:string|null;proximaAcao:string|null;proximaAcaoEm:string|null;link:string|null;fonte:string
}
type Tarefa={id:string;cliente:string|null;titulo:string;vencimento:string|null;responsavel:string}
type Dados={ok:true;somenteLeitura:true;escopo:'todos'|'proprios';valorVisivel:boolean;oportunidades:Oportunidade[];agenda:Tarefa[];resultadoParcial:boolean;limitePorFonte:number}
const ETAPAS:{id:Etapa;nome:string;cor:string}[]=[
  {id:'novo',nome:'Novo contato',cor:'bg-sky-500'},
  {id:'qualificacao',nome:'Qualificação',cor:'bg-indigo-500'},
  {id:'visita',nome:'Visita / medição',cor:'bg-violet-500'},
  {id:'proposta',nome:'Proposta enviada',cor:'bg-amber-500'},
  {id:'negociacao',nome:'Negociação',cor:'bg-emerald-500'},
]
const nomeEtapa=(e:Etapa)=>[...ETAPAS,{id:'ganho' as Etapa,nome:'Ganho'},{id:'perdido' as Etapa,nome:'Perdido'}].find(x=>x.id===e)?.nome||e
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})
const dataBR=(s:string|null)=>s?new Date((s.length===10?s+'T12:00:00':s)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data'
function Status({valor}:{valor:Oportunidade['temperatura']}){
  const cor=valor==='quente'?'border-red-100 bg-red-50 text-red-700':valor==='frio'?'border-sky-100 bg-sky-50 text-sky-700':'border-amber-100 bg-amber-50 text-amber-700'
  return <span className={'rounded-full border px-2 py-1 text-[10px] font-bold capitalize '+cor}>{valor}</span>
}
function Iniciais({nome}:{nome:string}){return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600">{nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</span>}
export default function PreviewIntegrado(){
  const [dados,setDados]=useState<Dados|null>(null)
  const [erro,setErro]=useState('')
  const [carregando,setCarregando]=useState(true)
  const [aba,setAba]=useState<'painel'|'funil'|'agenda'|'analise'>('painel')
  const [busca,setBusca]=useState('')
  const [dono,setDono]=useState('')
  const [selecionado,setSelecionado]=useState<Oportunidade|null>(null)
  const carregar=useCallback(async()=>{
    setCarregando(true);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Entre no Atlas para consultar o CRM.')
      const resp=await fetch('/api/crm/comercial',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok)throw new Error(json.error||'Falha ao carregar a carteira comercial.')
      setDados(json as Dados)
    }catch(e){setDados(null);setErro(e instanceof Error?e.message:'Falha de conexão.')}
    finally{setCarregando(false)}
  },[])
  useEffect(()=>{void carregar()},[carregar])
  const base=dados?.oportunidades||[]
  const filtrados=useMemo(()=>{
    const termo=busca.trim().toLocaleLowerCase('pt-BR')
    return base.filter(o=>(!dono||o.responsavel===dono)&&(!termo||[o.nome,o.obra,o.cidade,o.canal,o.responsavel].some(v=>(v||'').toLocaleLowerCase('pt-BR').includes(termo))))
  },[base,dono,busca])
  const abertos=filtrados.filter(o=>o.etapa!=='ganho'&&o.etapa!=='perdido')
  const ganhos=filtrados.filter(o=>o.etapa==='ganho')
  const perdidos=filtrados.filter(o=>o.etapa==='perdido')
  const valores=abertos.filter(o=>o.valor!==null)
  const total=valores.reduce((s,o)=>s+(o.valor||0),0)
  const previsao=abertos.reduce((s,o)=>s+(o.valor||0)*({novo:.1,qualificacao:.2,visita:.4,proposta:.6,negociacao:.8} as Record<string,number>)[o.etapa],0)
  const equipe=[...new Set(base.map(o=>o.responsavel))].sort()
  const tarefas=dados?.agenda||[]
  const atrasadas=tarefas.filter(t=>t.vencimento&&t.vencimento<new Date().toISOString().slice(0,10))
  const propostas=abertos.filter(o=>o.etapa==='proposta')
  const origem=Array.from(new Set(filtrados.map(o=>o.canal||'Não informada')))
  const cards=[
    {nome:'Pipeline aberto',valor:dados?.valorVisivel?moeda(total):'Restrito',detalhe:'Somente valores autorizados',icone:WalletCards},
    {nome:'Oportunidades',valor:String(abertos.length),detalhe:'Orçamentos e prospecções',icone:Target},
    {nome:'Tarefas pendentes',valor:String(tarefas.length),detalhe:atrasadas.length+' retorno(s) em atraso',icone:CalendarDays},
    {nome:'Propostas enviadas',valor:String(propostas.length),detalhe:'Pelo status registrado',icone:BarChart3},
    {nome:'Previsão estimada',valor:dados?.valorVisivel?moeda(previsao):'Restrito',detalhe:'Pesos ilustrativos por etapa',icone:TrendingUp},
  ]
  return <div className="min-h-screen bg-[#f5f7fb] pb-20 text-[#1b2941]">
    <header className="bg-[#102747] text-white"><div className="mx-auto max-w-[1700px] px-4 pb-7 pt-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3">
        <Link href="/crm/preview" className="rounded-lg border border-white/20 p-2 hover:bg-white/10"><ArrowLeft size={18}/></Link>
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#7ce1d3]">ATLAS ONE / COMERCIAL</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Central de Relacionamento</h1></div></div>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-teal-300/30 bg-teal-400/10 px-3 py-2 text-[11px] font-bold text-teal-100">PRÉVIA INTEGRADA · SOMENTE LEITURA</span>
          <Link href="/crm/preview" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Voltar ao modelo aprovado</Link>
          <button onClick={()=>void carregar()} disabled={carregando} className="flex items-center gap-2 rounded-lg bg-[#24b6a7] px-3 py-2 text-xs font-black text-[#0d2642] disabled:opacity-50"><RefreshCw size={14} className={carregando?'animate-spin':''}/>Atualizar</button>
        </div></div>
      <p className="mt-3 text-sm text-slate-300">Visão do comercial com dados reais de orçamentos, prospecções e tarefas, sem modificar seus registros.</p>
      {dados&&<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(k=><div key={k.nome} className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between gap-1"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{k.nome}</p><k.icone size={17} className="text-teal-200"/></div><p className="mt-3 text-2xl font-black">{k.valor}</p><p className="mt-1 text-[11px] text-slate-300">{k.detalhe}</p></div>)}</div>}
    </div></header>
    <main className="mx-auto max-w-[1700px] space-y-5 px-4 pt-5 sm:px-7">
      {erro&&<section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><CircleAlert size={18} className="mr-2 inline"/>{erro} <button onClick={()=>void carregar()} className="ml-2 font-black underline">Tentar novamente</button></section>}
      {carregando&&!dados&&<div className="rounded-2xl border bg-white p-12 text-center text-sm text-slate-500"><RefreshCw size={22} className="mx-auto mb-3 animate-spin"/>Consultando a carteira autorizada...</div>}
      {dados&&<><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-white p-1 shadow-sm">
        {([{id:'painel',titulo:'Visão do gestor',icone:LayoutGrid},{id:'funil',titulo:'Funil de vendas',icone:Target},{id:'agenda',titulo:'Agenda e tarefas',icone:CalendarDays},{id:'analise',titulo:'Inteligência comercial',icone:Sparkles}] as const).map(t=><button key={t.id} onClick={()=>setAba(t.id)} className={'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold '+(aba===t.id?'bg-[#102747] text-white':'text-slate-600 hover:bg-slate-50')}><t.icone size={15}/>{t.titulo}</button>)}
      </div><span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><ShieldCheck size={15}/> Dados protegidos por permissão</span></div>
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
        <div className="relative min-w-[180px] flex-[2]"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente, cidade, obra ou origem..." aria-label="Buscar oportunidades" className="w-full rounded-xl bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal-400"/></div>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Filter size={14}/> Carteira</span>
        <select aria-label="Filtrar vendedor" value={dono} onChange={e=>setDono(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="">Toda carteira autorizada</option>{equipe.map(r=><option key={r} value={r}>{r}</option>)}</select>
        <span className="ml-auto text-xs text-slate-500">{filtrados.length} registro(s)</span>
      </section>
      {dados.resultadoParcial&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><CircleAlert size={14} className="mr-1 inline"/>Mostrando apenas os {dados.limitePorFonte} registros mais recentes por fonte. Os indicadores representam esse recorte, não a carteira inteira.</p>}
      {(aba==='painel'||aba==='funil')&&<div className={aba==='painel'?'grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]':''}>
        <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-700">Pipeline comercial</p><h2 className="mt-1 text-lg font-black">Funil de oportunidades</h2><p className="mt-1 text-xs text-slate-500">Dados reais; alterações de etapas estarão disponíveis somente depois da homologação.</p></div><span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">Leitura</span></div>
          <div className="flex gap-3 overflow-x-auto pb-3">{ETAPAS.map(e=>{const os=abertos.filter(p=>p.etapa===e.id);return <div key={e.id} className="min-w-[215px] flex-1 rounded-2xl bg-[#f6f8fb] p-2.5">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+e.cor}/><b className="text-xs">{e.nome}</b></div><span className="rounded-md bg-white px-2 py-1 text-[11px] font-black">{os.length}</span></div>
            <div className="space-y-2.5">{os.map(o=><button key={o.id} onClick={()=>setSelecionado(o)} className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm hover:border-teal-300 hover:shadow-md"><div className="flex items-start justify-between gap-2"><b className="text-[13px] text-slate-900">{o.nome}</b><ChevronRight size={15} className="shrink-0 text-slate-400"/></div><p className="mt-1 truncate text-[11px] text-slate-500">{o.obra||o.cidade||o.fonte}</p><p className="mt-3 text-[16px] font-black">{o.valor===null?'Valor não disponível':moeda(o.valor)}</p><div className="mt-3 flex items-center justify-between gap-2"><Status valor={o.temperatura}/><span className="text-[10px] font-bold text-slate-500">{o.fonte}</span></div><div className="mt-3 flex items-center gap-2 border-t pt-2.5"><Iniciais nome={o.responsavel}/><span className="truncate text-[11px] text-slate-500">{o.responsavel}</span></div></button>)}
            {!os.length&&<div className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-400">Sem oportunidades nesta etapa</div>}
            </div></div>})}</div>
          <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-xs text-slate-600"><span>Ganhos: <b>{ganhos.length}</b></span><span>Perdidos: <b>{perdidos.length}</b></span><span>Escopo: <b>{dados.escopo==='todos'?'Carteira completa autorizada':'Somente carteira própria'}</b></span></div>
        </section>
        {aba==='painel'&&<aside className="space-y-4"><div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-sm font-black">Próximos retornos</h2><p className="mt-1 text-xs text-slate-500">Tarefas pendentes já cadastradas.</p><div className="mt-4 space-y-2">{tarefas.slice(0,7).map(t=><div key={t.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{t.titulo}</p><p className="mt-1 text-[11px] text-slate-500">{t.cliente||'Sem cliente'} · {dataBR(t.vencimento)}</p></div>)}{!tarefas.length&&<p className="py-3 text-xs text-slate-400">Sem tarefas pendentes.</p>}</div><button onClick={()=>setAba('agenda')} className="mt-3 flex items-center gap-1 text-xs font-black text-blue-700">Abrir agenda <ArrowRight size={14}/></button></div>
          <div className="rounded-2xl border border-teal-100 bg-[#eafbf8] p-5"><Sparkles size={19} className="text-teal-800"/><h2 className="mt-2 text-sm font-black">Alertas comerciais</h2><p className="mt-2 text-xs leading-relaxed text-teal-900">{atrasadas.length} tarefa(s) atrasada(s). {propostas.length} proposta(s) enviada(s). Indicadores automáticos por regra; IA ainda não conectada.</p></div></aside>}
      </div>}
      {aba==='agenda'&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Agenda e tarefas comerciais</h2><p className="text-xs text-slate-500">Dados reais das tarefas cadastradas no CRM.</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{atrasadas.length} atrasadas</span></div><div className="mt-4 divide-y">{tarefas.map(t=><div key={t.id} className="flex flex-wrap items-center gap-3 py-4"><div className="flex h-12 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs font-black"><Clock3 size={14} className="mr-1"/>{dataBR(t.vencimento)}</div><div className="min-w-[170px] flex-1"><b className="text-sm">{t.titulo}</b><p className="mt-1 text-xs text-slate-500">{t.cliente||'Cliente não informado'}</p></div><span className="text-xs text-slate-500">{t.responsavel}</span></div>)}{!tarefas.length&&<p className="py-12 text-center text-sm text-slate-400">Nenhuma tarefa pendente.</p>}</div></section>}
      {aba==='analise'&&<section className="grid gap-4 xl:grid-cols-2"><div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Origem dos negócios</h2><p className="mt-1 text-xs text-slate-500">Quantidade de registros por origem informada.</p><div className="mt-5 space-y-3">{origem.map(c=>{const n=filtrados.filter(x=>(x.canal||'Não informada')===c).length;return <div key={c}><div className="mb-1 flex justify-between text-xs"><b>{c}</b><b>{n}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{width:(100*n/Math.max(1,filtrados.length))+'%'}}/></div></div>})}</div></div><div className="rounded-2xl border bg-white p-5 shadow-sm"><Sparkles size={20} className="text-teal-700"/><h2 className="mt-2 text-lg font-black">Recomendações para a próxima etapa</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Unificar histórico de interações, registrar motivo de perda, evitar duplicidade entre prospecção e orçamento e criar alertas para propostas com validade de sete dias. O sistema só automatizará ações após configurar autorização e confirmação humana.</p><p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Os pesos de previsão são ilustrativos; não representam receita garantida.</p></div></section>}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed bg-white p-4 text-xs text-slate-500"><span><ShieldCheck size={15} className="mr-1 inline text-emerald-700"/> Consulta segura e isolada · Nenhuma gravação no banco</span><Link href="/crm/preview" className="font-bold text-blue-700">Abrir modelo aprovado <ArrowUpRight size={13} className="inline"/></Link></div>
      </>}
    </main>
    {selecionado&&<div className="fixed inset-0 z-[100] flex justify-end bg-[#102747]/60" onClick={()=>setSelecionado(null)}><aside className="h-full w-full max-w-[430px] overflow-y-auto bg-white shadow-2xl" onClick={e=>e.stopPropagation()}><div className="bg-[#102747] p-6 text-white"><button className="mb-4 text-xs text-teal-200" onClick={()=>setSelecionado(null)}>← Voltar ao funil</button><p className="text-[11px] font-bold uppercase tracking-wide text-teal-200">Oportunidade · somente leitura</p><h2 className="mt-2 text-2xl font-black">{selecionado.nome}</h2><p className="mt-2 text-sm text-slate-300">{selecionado.obra||selecionado.cidade||'Sem obra informada'}</p><p className="mt-5 text-2xl font-black">{selecionado.valor===null?'Valor indisponível':moeda(selecionado.valor)}</p></div><div className="space-y-4 p-6"><div className="flex flex-wrap gap-2"><Status valor={selecionado.temperatura}/><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{nomeEtapa(selecionado.etapa)}</span></div><p className="text-xs text-slate-500">Responsável: <b className="text-slate-900">{selecionado.responsavel}</b></p><p className="text-xs text-slate-500">Origem: <b className="text-slate-900">{selecionado.canal||'Não informada'}</b></p><p className="text-xs text-slate-500">Última atualização: <b className="text-slate-900">{dataBR(selecionado.atualizadoEm)}</b></p>{selecionado.proximaAcao&&<p className="rounded-lg bg-teal-50 p-3 text-sm">Próxima ação: {selecionado.proximaAcao}</p>}{selecionado.link&&<Link href={selecionado.link} className="flex items-center justify-between rounded-xl bg-[#102747] p-4 text-sm font-bold text-white">Abrir registro original <ArrowUpRight size={16}/></Link>}<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Para editar, utilize o fluxo original autorizado. Esta prévia nunca altera registros.</p><RelacionamentoPreview oportunidadeId={selecionado.id}/></div></aside></div>}
  </div>
}