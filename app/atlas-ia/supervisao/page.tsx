'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Bot, BrainCircuit, CircleDollarSign, GraduationCap, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type AgenteApi={nome:string;execucoes30d:number;custo30d:number;ultimaAtividadeEm:string|null;provider:string|null;modelo:string|null;setor:string|null}
type Uso={agente_nome:string|null;setor_id:string|null;created_at:string;sucesso:boolean}
type Dados={resumo:{custoEstimado:number};resumoHoje:{execucoes:number;sucessos:number;erros:number;custoEstimado:number};agentes:AgenteApi[];usoRecentes:Uso[]}
type Aprendizado={totais:{pendentes:number;aplicados:number;rejeitados:number}}

const ROLES=[
  {id:'whatsapp',nome:'IA WhatsApp',funcao:'Atendimento e triagem',termos:['whatsapp','comercial','atendimento'],cor:'#16a34a',emoji:'💬'},
  {id:'orcamento',nome:'IA Orçamentista',funcao:'Leitura e montagem de orçamento',termos:['orcamento','orçamento'],cor:'#2563eb',emoji:'📝'},
  {id:'catalogo',nome:'IA Catálogo',funcao:'Produtos e aprendizado',termos:['catalogo','catálogo','produto','aprendizado'],cor:'#7c3aed',emoji:'📚'},
  {id:'engenharia',nome:'IA Engenharia',funcao:'Regras técnicas',termos:['engenharia','medicao','medição'],cor:'#ea580c',emoji:'🧰'},
  {id:'financeiro',nome:'IA Financeiro',funcao:'Custos e conferências',termos:['financeiro','custo','preco','preço'],cor:'#0891b2',emoji:'💰'},
  {id:'supervisor',nome:'Supervisor IA',funcao:'Supervisão dos agentes',termos:['gestao','gestão','atlas','geral','pd'],cor:'#0f172a',emoji:'🧠'},
]
function norm(v:any){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function min(v?:string|null){return v?Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/60000)):99999}
function usd(v:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(v||0)}
function num(v:number){return new Intl.NumberFormat('pt-BR').format(v||0)}
function data(v?:string|null){return v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Sem atividade registrada'}

export default function SupervisaoIAPage(){
  const [dados,setDados]=useState<Dados|null>(null)
  const [apr,setApr]=useState<Aprendizado|null>(null)
  const [loading,setLoading]=useState(true)
  const [erro,setErro]=useState('')
  const [sel,setSel]=useState('supervisor')

  async function carregar(silencioso=false){
    if(!silencioso)setLoading(true);setErro('')
    try{
      const u=await usuarioAtual();if(!u||u.role!=='master')throw new Error('Acesso restrito ao Master.')
      const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
      const h={Authorization:'Bearer '+token}
      const [a,b]=await Promise.all([fetch('/api/ia/admin',{headers:h,cache:'no-store'}),fetch('/api/ia/central-aprendizado',{headers:h,cache:'no-store'})])
      const [aj,bj]=await Promise.all([a.json(),b.json()])
      if(!a.ok)throw new Error(aj.error||'Erro ao carregar supervisão.')
      setDados(aj);if(b.ok)setApr(bj)
    }catch(e:any){setErro(e?.message||'Erro ao carregar.')}finally{if(!silencioso)setLoading(false)}
  }
  useEffect(()=>{void carregar();const i=window.setInterval(()=>void carregar(true),20000);return()=>window.clearInterval(i)},[])

  const agentes=useMemo(()=>ROLES.map(r=>{
    const base=(dados?.agentes||[]).find(a=>r.termos.some(t=>norm([a.nome,a.setor].join(' ')).includes(norm(t))))
    const uso=(dados?.usoRecentes||[]).find(a=>r.termos.some(t=>norm([a.agente_nome,a.setor_id].join(' ')).includes(norm(t))))
    const ultima=uso?.created_at||base?.ultimaAtividadeEm||null
    const mins=min(ultima)
    let estado=mins<=3?'trabalhando':mins<=15?'observando':'disponível'
    let atividade=estado==='trabalhando'?'Processando uma tarefa agora':estado==='observando'?'Acompanhando atividade recente':'Aguardando nova tarefa'
    if(r.id==='catalogo'&&(apr?.totais.pendentes||0)>0){atividade='Revisando '+(apr?.totais.pendentes||0)+' validação(ões) pendente(s)';if(estado==='disponível')estado='observando'}
    return {...r,estado,atividade,ultima,exec:Number(base?.execucoes30d||0),custo:Number(base?.custo30d||0),provider:base?.provider||'—',modelo:base?.modelo||'—'}
  }),[dados,apr])
  const ativos=agentes.filter(a=>a.id!=='supervisor'&&a.estado==='trabalhando').length
  const supervisor=agentes.find(a=>a.id==='supervisor')
  if(supervisor){supervisor.estado=ativos?'trabalhando':'observando';supervisor.atividade=ativos?'Supervisionando '+ativos+' agente(s) em atividade':'Monitorando a operação da IA'}
  const escolhido=agentes.find(a=>a.id===sel)||agentes[0]

  if(loading)return <main className="min-h-screen grid place-items-center bg-slate-50"><div className="flex items-center gap-2 text-slate-600"><Loader2 className="animate-spin"/>Carregando Central de IA...</div></main>

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-7xl p-4 md:p-7">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <Link href="/atlas-ia" className="grid h-10 w-10 place-items-center rounded-xl border bg-white"><ArrowLeft size={18}/></Link>
          <div><h1 className="flex items-center gap-2 text-2xl font-black"><BrainCircuit/>Central de Supervisão da IA</h1><p className="text-sm text-slate-500">Quem está trabalhando, o que está fazendo, custos, erros e aprendizado.</p></div>
        </div>
        <button onClick={()=>void carregar()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-bold"><RefreshCw size={14}/>Atualizar</button>
      </header>
      {erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card icon={<Activity size={16}/>} label="Trabalhando agora" valor={String(ativos)} sub="últimos 3 minutos"/>
        <Card icon={<Bot size={16}/>} label="Execuções hoje" valor={num(dados?.resumoHoje?.execucoes||0)} sub={(dados?.resumoHoje?.sucessos||0)+' concluídas'}/>
        <Card icon={<CircleDollarSign size={16}/>} label="Custo hoje" valor={usd(dados?.resumoHoje?.custoEstimado||0)} sub="estimativa"/>
        <Card icon={<CircleDollarSign size={16}/>} label="Custo 30 dias" valor={usd(dados?.resumo?.custoEstimado||0)} sub="estimativa"/>
        <Card icon={<GraduationCap size={16}/>} label="Aguardando validação" valor={num(apr?.totais.pendentes||0)} sub="aprendizado"/>
        <Card icon={<TriangleAlert size={16}/>} label="Erros hoje" valor={num(dados?.resumoHoje?.erros||0)} sub="execuções com falha"/>
      </section>

      <section className="mb-5 overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-black">Escritório animado dos agentes</h2><p className="text-xs text-slate-500">Agentes em atividade se movimentam entre a mesa e a estação de trabalho.</p></div>
        <div className="office relative hidden h-[500px] overflow-hidden md:block">
          {ROLES.map((r,i)=><div key={r.id} className={'station station-'+(i+1)}><b>{r.emoji} {r.nome.replace('IA ','')}</b><small>{r.funcao}</small></div>)}
          {agentes.map((a,i)=><button key={a.id} onClick={()=>setSel(a.id)} className={'agent agent-'+(i+1)+' '+(a.estado==='trabalhando'?'working ':'')+(sel===a.id?'selected':'')}>
            <span className="bubble">{a.atividade}</span>
            <span className="person"><i style={{background:a.cor}}/><b>{a.emoji}</b></span>
            <span className="tag">{a.nome}</span>
          </button>)}
        </div>
        <div className="grid gap-2 p-4 md:hidden">{agentes.map(a=><button key={a.id} onClick={()=>setSel(a.id)} className="flex items-center gap-3 rounded-xl border p-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl text-lg text-white" style={{background:a.cor}}>{a.emoji}</span><span className="min-w-0 flex-1"><b className="block">{a.nome}</b><small className="block truncate text-slate-500">{a.atividade}</small></span></button>)}</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl text-white" style={{background:escolhido.cor}}>{escolhido.emoji}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{escolhido.nome}</h3><span className="rounded-full border bg-slate-50 px-2 py-1 text-[11px] font-bold">{escolhido.estado}</span></div><p className="text-sm text-slate-500">{escolhido.funcao}</p><div className="mt-3 rounded-xl bg-slate-50 p-3"><small className="font-bold uppercase text-slate-400">Atividade atual</small><p className="font-semibold">{escolhido.atividade}</p></div></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Mini l="Execuções 30d" v={num(escolhido.exec)}/><Mini l="Custo 30d" v={usd(escolhido.custo)}/><Mini l="Provider" v={escolhido.provider}/><Mini l="Modelo" v={escolhido.modelo}/></div>
          <p className="mt-3 text-xs text-slate-400">Última atividade: {data(escolhido.ultima)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black">Supervisão e validação</h3><p className="mt-1 text-xs text-slate-500">Acesse os controles ligados à operação dos agentes.</p><div className="mt-4 space-y-2"><Link href="/atlas-ia/aprendizado" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50"><GraduationCap/><span><b className="block text-sm">Central de Aprendizado</b><small className="text-slate-500">{apr?.totais.pendentes||0} pendente(s)</small></span></Link><Link href="/administracao/ia" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50"><ShieldCheck/><span><b className="block text-sm">Controle Master da IA</b><small className="text-slate-500">Custos, permissões e auditoria</small></span></Link></div></div>
      </section>
      <p className="mt-4 text-[11px] text-slate-400">Custos são estimativas registradas pelo Atlas. Providers locais podem aparecer como custo zero. Atualização automática a cada 20 segundos.</p>
    </div>
    <style jsx>{`
      .office{background:linear-gradient(90deg,#e2e8f066 1px,transparent 1px),linear-gradient(#e2e8f066 1px,transparent 1px),#f8fafc;background-size:40px 40px}
      .station{position:absolute;width:170px;height:72px;border:1px solid #dbe3ee;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 22px #0f17240d}.station b{font-size:11px}.station small{font-size:9px;color:#94a3b8}.station-1{left:4%;top:8%}.station-2{left:39%;top:6%}.station-3{right:4%;top:8%}.station-4{left:5%;bottom:8%}.station-5{left:40%;bottom:6%}.station-6{right:4%;bottom:8%}
      .agent{position:absolute;width:150px;height:112px;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;z-index:5}.agent-1{left:20%;top:28%}.agent-2{left:43%;top:25%}.agent-3{right:18%;top:28%}.agent-4{left:20%;bottom:26%}.agent-5{left:44%;bottom:23%}.agent-6{right:18%;bottom:26%}.selected{filter:drop-shadow(0 7px 12px #2563eb33)}
      .bubble{position:absolute;bottom:82px;max-width:170px;border-radius:10px;background:#0f172a;color:white;padding:6px 8px;font-size:9px;font-weight:700;line-height:1.2;opacity:.9}.person{position:relative;width:48px;height:58px;display:grid;place-items:center}.person i{position:absolute;bottom:0;width:42px;height:34px;border-radius:16px 16px 8px 8px}.person b{z-index:2;display:grid;width:34px;height:34px;place-items:center;border:2px solid #cbd5e1;border-radius:50%;background:white}.tag{margin-top:3px;border:1px solid #e2e8f0;border-radius:999px;background:white;padding:3px 7px;font-size:10px;font-weight:900}
      .working{animation:walk 4s ease-in-out infinite}.working .person{animation:hop 1.1s ease-in-out infinite}.working .bubble{animation:pulse 1.5s ease-in-out infinite}@keyframes walk{0%,100%{transform:translate(0)}45%{transform:translate(35px,-22px)}70%{transform:translate(-10px,12px)}}@keyframes hop{50%{transform:translateY(-5px)}}@keyframes pulse{50%{opacity:1}}@media(prefers-reduced-motion:reduce){.working,.working .person,.working .bubble{animation:none}}
    `}</style>
  </main>
}

function Card({icon,label,valor,sub}:{icon:React.ReactNode;label:string;valor:string;sub:string}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex justify-between text-xs font-bold text-slate-500"><span>{label}</span>{icon}</div><div className="mt-2 text-xl font-black">{valor}</div><div className="text-[11px] text-slate-400">{sub}</div></div>}
function Mini({l,v}:{l:string;v:string}){return <div className="rounded-xl border bg-slate-50 p-3"><small className="font-bold uppercase text-slate-400">{l}</small><div className="truncate text-xs font-black" title={v}>{v}</div></div>}
