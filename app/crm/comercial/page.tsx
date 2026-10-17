'use client'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,BarChart3,CalendarClock,ChevronRight,Clock3,Columns3,FileText,Filter,RefreshCw,Search,ShieldCheck,Target,TrendingUp,WalletCards} from 'lucide-react'
import {supabase} from '@/lib/supabase'
import {usuarioAtual} from '@/lib/auth'
import {listarPermissoesUsuario,nivelEfetivo} from '@/lib/setores'
import {lerAcessoUsuarioConfig} from '@/lib/acessoUsuario'
import type {NivelPermissao,OrcamentoRapido,Tarefa} from '@/lib/tipos'

type Orc=Pick<OrcamentoRapido,'id'|'numero'|'cliente_id'|'cliente_nome'|'cidade'|'origem'|'valor_estimado'|'status'|'temperatura'|'created_at'|'criado_por_id'|'criado_por_nome'>
type Fase='rascunho'|'enviado'|'ganho'|'perdido'
const FASES:{id:Fase;nome:string;cor:string}[]=[{id:'rascunho',nome:'Em elaboração',cor:'bg-sky-500'},{id:'enviado',nome:'Proposta enviada',cor:'bg-amber-500'},{id:'ganho',nome:'Ganho',cor:'bg-emerald-500'},{id:'perdido',nome:'Perdido',cor:'bg-rose-500'}]
function fase(s:string):Fase{return s==='enviado'?'enviado':s==='aprovado'||s==='convertido'?'ganho':s==='recusado'?'perdido':'rascunho'}
function moeda(v:number){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}
function dataBR(v?:string|null){return v?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data'}
function vencida(t:Tarefa){return Boolean(t.data_vencimento&&t.data_vencimento.slice(0,10)<new Date().toISOString().slice(0,10))}
function Cartao({o,tarefa}:{o:Orc;tarefa?:Tarefa}){
 return <Link href={'/kanban?orcamento='+encodeURIComponent(o.id)} className="block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
  <div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate text-[13px] font-black text-slate-900">{o.cliente_nome||'Cliente sem nome'}</p><p className="mt-1 text-[11px] text-slate-500">Orçamento {o.numero?'#'+o.numero:'sem número'} · {o.cidade||'Sem cidade'}</p></div><ChevronRight size={15} className="shrink-0 text-slate-300"/></div>
  <p className="mt-3 text-xl font-black text-[#142b4d]">{o.valor_estimado==null?'Sem valor':moeda(Number(o.valor_estimado)||0)}</p>
  <div className="mt-3 flex flex-wrap gap-1.5">{o.temperatura&&<span className={'rounded-full px-2 py-1 text-[10px] font-bold '+(o.temperatura==='quente'?'bg-rose-50 text-rose-700':o.temperatura==='morno'?'bg-amber-50 text-amber-700':'bg-sky-50 text-sky-700')}>{o.temperatura.toUpperCase()}</span>}{o.origem&&<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{o.origem}</span>}</div>
  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span>{o.criado_por_nome||'Não atribuído'}</span><span className={'inline-flex items-center gap-1 '+(tarefa&&vencida(tarefa)?'font-bold text-rose-600':'')}><Clock3 size={12}/>{tarefa?'Retorno '+dataBR(tarefa.data_vencimento):'Sem retorno agendado'}</span></div>
 </Link>
}
export default function CRMComercialOperacional(){
 const [nivel,setNivel]=useState<NivelPermissao>('oculto')
 const [escopo,setEscopo]=useState<'proprios'|'todos'>('proprios')
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [orcamentos,setOrcamentos]=useState<Orc[]>([])
 const [tarefas,setTarefas]=useState<Tarefa[]>([])
 const [busca,setBusca]=useState('')
 const [vendedor,setVendedor]=useState('todos')
 const [origem,setOrigem]=useState('todas')
 const [aba,setAba]=useState<'funil'|'agenda'|'indicadores'>('funil')
 async function carregar(){
  setCarregando(true);setErro('')
  try{
   const me=await usuarioAtual()
   if(!me){setNivel('oculto');return}
   const mapa=me.role==='master'?{}:await listarPermissoesUsuario(me.id)
   const nv=nivelEfetivo(me,'crm',mapa);setNivel(nv)
   if(nv==='oculto')return
   const acesso=await lerAcessoUsuarioConfig(me)
   const proprio=me.role!=='master'&&acesso.crmEscopo!=='todos'
   setEscopo(proprio?'proprios':'todos')
   let oq=supabase.from('orcamentos').select('id,numero,cliente_id,cliente_nome,cidade,origem,valor_estimado,status,temperatura,created_at,criado_por_id,criado_por_nome').order('created_at',{ascending:false}).limit(500)
   if(proprio)oq=oq.eq('criado_por_id',me.id)
   let tq=supabase.from('crm_tarefas').select('id,cliente_id,cliente_nome,orcamento_id,titulo,descricao,data_vencimento,concluida,responsavel_id,responsavel_nome,created_at').eq('concluida',false).order('data_vencimento',{ascending:true}).limit(500)
   if(proprio)tq=tq.eq('responsavel_id',me.id)
   const [o,t]=await Promise.all([oq,tq])
   if(o.error||t.error)throw new Error(o.error?.message||t.error?.message||'Consulta falhou')
   setOrcamentos((o.data||[]) as Orc[]);setTarefas((t.data||[]) as Tarefa[])
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar CRM');setOrcamentos([]);setTarefas([])}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 const filtrados=useMemo(()=>orcamentos.filter(o=>(vendedor==='todos'||(o.criado_por_nome||'Não atribuído')===vendedor)&&(origem==='todas'||o.origem===origem)&&(!busca.trim()||[o.cliente_nome,o.cidade,o.origem,o.criado_por_nome,String(o.numero||'')].some(v=>String(v||'').toLowerCase().includes(busca.toLowerCase().trim())))),[orcamentos,busca,vendedor,origem])
 const ids=new Set(filtrados.map(o=>o.id)),clientes=new Set(filtrados.map(o=>o.cliente_id).filter(Boolean))
 const tarefasVisiveis=tarefas.filter(t=>t.orcamento_id?ids.has(t.orcamento_id):Boolean(t.cliente_id&&clientes.has(t.cliente_id)))
 const tarefasPorOrc=useMemo(()=>{const mapa:Record<string,Tarefa>={};for(const t of tarefas)if(t.orcamento_id&&!mapa[t.orcamento_id])mapa[t.orcamento_id]=t;return mapa},[tarefas])
 const abertas=filtrados.filter(o=>fase(o.status)==='rascunho'||fase(o.status)==='enviado')
 const fechadas=filtrados.filter(o=>fase(o.status)==='ganho'||fase(o.status)==='perdido')
 const ganho=fechadas.filter(o=>fase(o.status)==='ganho').length
 const enviadas=filtrados.filter(o=>fase(o.status)==='enviado').length
 const atrasadas=tarefasVisiveis.filter(vencida).length
 const equipe=[...new Set(orcamentos.map(o=>o.criado_por_nome||'Não atribuído'))].sort()
 const origens=[...new Set(orcamentos.map(o=>o.origem).filter(Boolean) as string[])].sort()
 if(carregando)return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-500"><RefreshCw size={17} className="animate-spin"/> Carregando CRM Comercial...</div>
 if(nivel==='oculto')return <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><ShieldCheck size={26} className="mx-auto text-amber-700"/><h1 className="mt-3 text-lg font-bold">CRM sem autorização</h1><p className="mt-2 text-sm">Solicite ao Master acesso ao setor CRM.</p><Link href="/" className="mt-4 inline-block text-sm font-bold text-blue-700">Voltar</Link></div>
 return <div className="min-h-screen bg-[#f5f7fb] pb-16 text-[#1b2941]">
  <header className="bg-[#0f2341] text-white"><div className="mx-auto max-w-[1700px] px-4 pb-7 pt-6 sm:px-6">
   <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/" className="rounded-xl border border-white/20 p-2.5 hover:bg-white/10" title="Início"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#77dacf]">ATLAS ONE / COMERCIAL</p><h1 className="mt-1 text-2xl font-black">Central Comercial · CRM</h1><p className="mt-1 text-xs text-slate-300">Orçamentos e retornos reais em uma visão gerencial.</p></div></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-teal-300/40 bg-teal-300/10 px-3 py-2 text-[11px] font-bold text-teal-100">DADOS REAIS · {escopo==='proprios'?'MINHA CARTEIRA':'EQUIPE AUTORIZADA'}</span><button onClick={()=>void carregar()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold hover:bg-white/10"><RefreshCw size={14}/> Atualizar</button><Link href="/crm/oportunidades" className="rounded-xl bg-teal-100 px-3 py-2.5 text-xs font-bold text-[#102c44] hover:bg-white">Oportunidades consolidadas</Link><Link href="/crm/preview" className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold hover:bg-white/10">Ver prévia completa</Link><Link href="/crm" className="inline-flex items-center gap-2 rounded-xl bg-[#31c3b1] px-4 py-2.5 text-xs font-black text-[#102c44]">CRM atual · Tarefas <ArrowRight size={14}/></Link></div></div>
   <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
    {nome:'Pipeline em aberto',valor:moeda(abertas.reduce((s,o)=>s+Number(o.valor_estimado||0),0)),sub:'Valor das oportunidades',icone:WalletCards},
    {nome:'Oportunidades',valor:String(abertas.length),sub:'Em elaboração ou enviadas',icone:Target},
    {nome:'Retornos atrasados',valor:String(atrasadas),sub:'Tarefas vencidas',icone:CalendarClock},
    {nome:'Propostas enviadas',valor:String(enviadas),sub:'Aguardando resposta',icone:FileText},
    {nome:'Conversão registrada',valor:Math.round(100*ganho/Math.max(1,fechadas.length))+'%',sub:'Ganhos entre encerrados',icone:TrendingUp},
   ].map(m=><div key={m.nome} className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase text-slate-300">{m.nome}</p><m.icone size={17} className="text-[#7bdfd0]"/></div><p className="mt-3 text-2xl font-black tracking-tight">{m.valor}</p><p className="mt-1 text-[11px] text-slate-300">{m.sub}</p></div>)}</div>
  </div></header>
  <main className="mx-auto max-w-[1700px] space-y-5 px-4 pt-5 sm:px-6">
   {erro&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Falha na consulta: {erro} <button onClick={()=>void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
   {nivel==='consulta'&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-700">Seu acesso ao CRM é somente de consulta. Edições continuam sujeitas à autorização de cada módulo.</div>}
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">{([{id:'funil',nome:'Funil real',icone:Columns3},{id:'agenda',nome:'Agenda e retornos',icone:CalendarClock},{id:'indicadores',nome:'Indicadores',icone:BarChart3}] as const).map(i=><button key={i.id} onClick={()=>setAba(i.id)} className={'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold '+(aba===i.id?'bg-[#142b4d] text-white':'text-slate-600')}><i.icone size={14}/>{i.nome}</button>)}</div><span className="text-xs text-slate-500"><ShieldCheck size={14} className="mr-1 inline text-teal-700"/> Alterações continuam no Kanban original</span></div>
   <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"><div className="relative min-w-[190px] flex-[2]"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Pesquisar CRM" placeholder="Cliente, cidade, número, responsável..." className="w-full rounded-xl bg-slate-50 py-2.5 pl-10 pr-3 text-xs outline-none focus:ring-2 focus:ring-teal-400"/></div><Filter size={15} className="text-slate-400"/><select value={vendedor} onChange={e=>setVendedor(e.target.value)} aria-label="Filtrar vendedor" className="rounded-xl border border-slate-200 p-2.5 text-xs"><option value="todos">Todos os vendedores</option>{equipe.map(v=><option key={v}>{v}</option>)}</select><select value={origem} onChange={e=>setOrigem(e.target.value)} aria-label="Filtrar origem" className="rounded-xl border border-slate-200 p-2.5 text-xs"><option value="todas">Todas as origens</option>{origens.map(v=><option key={v}>{v}</option>)}</select><span className="ml-auto text-xs text-slate-500">{filtrados.length} orçamentos</span></div>
   {aba==='funil'&&<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Pipeline comercial</p><h2 className="mt-1 text-lg font-black">Andamento de orçamentos</h2><p className="text-xs text-slate-500">Clique no card para abrir a negociação no Kanban existente, conforme sua permissão.</p></div><div className="flex gap-3 overflow-x-auto pb-3">{FASES.map(f=>{const lista=filtrados.filter(o=>fase(o.status)===f.id);return <div key={f.id} className="min-w-[230px] flex-1 rounded-2xl bg-[#f6f8fb] p-2.5"><div className="pb-3"><div className="flex items-center justify-between gap-2"><h3 className="inline-flex items-center gap-2 text-xs font-black"><span className={'h-2.5 w-2.5 rounded-full '+f.cor}/>{f.nome}</h3><span className="rounded-md bg-white px-2 py-1 text-xs font-black">{lista.length}</span></div><p className="mt-2 text-lg font-black">{moeda(lista.reduce((a,o)=>a+Number(o.valor_estimado||0),0))}</p></div><div className="max-h-[700px] space-y-2.5 overflow-y-auto">{lista.slice(0,100).map(o=><Cartao key={o.id} o={o} tarefa={tarefasPorOrc[o.id]}/>)}</div>{lista.length>100&&<p className="mt-3 text-center text-xs text-slate-500">Exibindo 100 de {lista.length} · utilize os filtros</p>}{!lista.length&&<div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400">Sem registros</div>}</div>})}</div></section>}
   {aba==='agenda'&&<section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Agenda de retornos</h2><p className="mt-1 text-xs text-slate-500">Tarefas cadastradas no CRM, referentes aos orçamentos visíveis.</p><div className="mt-5 divide-y divide-slate-100">{tarefasVisiveis.map(t=><div key={t.id} className="flex flex-wrap items-center gap-3 py-3"><span className={'rounded-lg px-3 py-2 text-xs font-bold '+(vencida(t)?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-600')}>{dataBR(t.data_vencimento)}</span><div className="min-w-[170px] flex-1"><p className="text-sm font-bold">{t.titulo}</p><p className="text-xs text-slate-500">{t.cliente_nome||'Sem cliente'} · {t.responsavel_nome||'Não atribuído'}</p></div>{t.orcamento_id&&<Link href={'/kanban?orcamento='+encodeURIComponent(t.orcamento_id)} className="inline-flex items-center text-xs font-bold text-blue-700">Abrir orçamento <ChevronRight size={14}/></Link>}</div>)}{!tarefasVisiveis.length&&<p className="py-12 text-center text-sm text-slate-500">Sem tarefas pendentes neste filtro.</p>}</div><Link href="/crm" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Criar e concluir tarefas no CRM atual <ArrowRight size={14}/></Link></section>}
   {aba==='indicadores'&&<div className="grid gap-4 lg:grid-cols-3"><section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><h2 className="text-lg font-black">Origem das oportunidades</h2><p className="mt-1 text-xs text-slate-500">Orçamentos reais na carteira autorizada.</p><div className="mt-5 space-y-4">{origens.map(i=>{const os=filtrados.filter(o=>o.origem===i),v=os.reduce((a,o)=>a+Number(o.valor_estimado||0),0),m=Math.max(1,...origens.map(x=>filtrados.filter(o=>o.origem===x).reduce((a,o)=>a+Number(o.valor_estimado||0),0)));return <div key={i}><div className="flex justify-between text-xs"><b>{i} ({os.length})</b><b>{moeda(v)}</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{width:Math.round(v/m*100)+'%'}}/></div></div>})}</div></section><aside className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Carteira da equipe</h2><div className="mt-5 space-y-3">{equipe.map(n=><div className="flex justify-between text-xs" key={n}><b>{n}</b><span>{filtrados.filter(o=>o.criado_por_nome===n).length} orçamento(s)</span></div>)}</div></aside></div>}
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-4 text-xs text-slate-500"><span><ShieldCheck size={14} className="mr-1 inline text-teal-700"/> Visão dos dados existentes; nenhuma negociação é movimentada automaticamente.</span><div className="flex gap-4"><Link href="/crm" className="font-bold text-blue-700">CRM atual <ArrowRight size={12} className="inline"/></Link><Link href="/prospeccao" className="font-bold text-blue-700">Prospecção <ArrowRight size={12} className="inline"/></Link></div></div>
  </main>
 </div>
}