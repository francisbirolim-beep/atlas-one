'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Bot, BrainCircuit, CircleDollarSign, GraduationCap, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type AgenteApi={nome:string;execucoes30d:number;custo30d:number;ultimaAtividadeEm:string|null;provider:string|null;modelo:string|null;setor:string|null}
type Uso={agente_nome:string|null;setor_id:string|null;created_at:string;sucesso:boolean}
type OperacaoAgente={trabalhando:boolean;monitorando?:boolean;atividade:string;ultimaAtividadeEm:string|null;aguardandoValidacao?:number;correcoes30d?:number;modo?:string|null}
type Dados={resumo:{custoEstimado:number};resumoHoje:{execucoes:number;sucessos:number;erros:number;custoEstimado:number};agentes:AgenteApi[];usoRecentes:Uso[];operacaoAgora?:Partial<Record<string,OperacaoAgente>>;runtimeGratis?:any}
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
  useEffect(()=>{
    void carregar()
    const atualizar=()=>{if(document.visibilityState==='visible')void carregar(true)}
    const i=window.setInterval(atualizar,15000)
    document.addEventListener('visibilitychange',atualizar)
    return()=>{window.clearInterval(i);document.removeEventListener('visibilitychange',atualizar)}
  },[])

  const agentes=useMemo(()=>ROLES.map(r=>{
    const base=(dados?.agentes||[]).find(a=>r.termos.some(t=>norm([a.nome,a.setor].join(' ')).includes(norm(t))))
    const uso=(dados?.usoRecentes||[]).find(a=>r.termos.some(t=>norm([a.agente_nome,a.setor_id].join(' ')).includes(norm(t))))
    const operacional=dados?.operacaoAgora?.[r.id]
    const ultima=operacional?.ultimaAtividadeEm||uso?.created_at||base?.ultimaAtividadeEm||null
    const mins=min(ultima)
    let estado=operacional?.trabalhando?'trabalhando':operacional?.monitorando?'monitorando':mins<=4?'trabalhando':mins<=20?'observando':'disponível'
    let atividade=operacional?.atividade||(estado==='trabalhando'?'Processando uma tarefa agora':estado==='monitorando'?'Monitorando e aprendendo continuamente':estado==='observando'?'Acompanhando atividade recente':'Aguardando nova tarefa')
    if(r.id==='orcamento'&&(operacional?.aguardandoValidacao||0)>0&&estado==='disponível')estado='monitorando'
    if(r.id==='catalogo'&&(apr?.totais.pendentes||0)>0&&!operacional?.trabalhando){atividade='Acompanhando '+(apr?.totais.pendentes||0)+' validação(ões) pendente(s)';if(estado==='disponível')estado='observando'}
    return {...r,estado,atividade,ultima,exec:Number(base?.execucoes30d||0),custo:Number(base?.custo30d||0),provider:base?.provider||'—',modelo:base?.modelo||'—'}
  }),[dados,apr])
  const ativosEspecialistas=agentes.filter(a=>a.id!=='supervisor'&&a.estado==='trabalhando').length
  const monitorandoContinuo=agentes.filter(a=>a.id!=='supervisor'&&a.estado==='monitorando').length
  const supervisor=agentes.find(a=>a.id==='supervisor')
  const supervisorOperacao=dados?.operacaoAgora?.supervisor
  if(supervisor){
    if(supervisorOperacao?.trabalhando){
      supervisor.estado='trabalhando'
      supervisor.atividade=supervisorOperacao.atividade||'Atendendo uma solicitação na IA geral'
      supervisor.ultima=supervisorOperacao.ultimaAtividadeEm||supervisor.ultima
    }else{
      supervisor.estado=ativosEspecialistas?'trabalhando':'observando'
      supervisor.atividade=ativosEspecialistas?'Supervisionando '+ativosEspecialistas+' agente(s) em atividade':'Monitorando a operação da IA'
    }
  }
  const ativos=ativosEspecialistas+(supervisor?.estado==='trabalhando'?1:0)
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
        <Card icon={<Activity size={16}/>} label="Trabalhando agora" valor={String(ativos)} sub={monitorandoContinuo+' agente(s) monitorando continuamente'}/>
        <Card icon={<Bot size={16}/>} label="Execuções hoje" valor={num(dados?.resumoHoje?.execucoes||0)} sub={(dados?.resumoHoje?.sucessos||0)+' concluídas'}/>
        <Card icon={<CircleDollarSign size={16}/>} label="Custo hoje" valor={usd(dados?.resumoHoje?.custoEstimado||0)} sub="estimativa"/>
        <Card icon={<CircleDollarSign size={16}/>} label="Custo 30 dias" valor={usd(dados?.resumo?.custoEstimado||0)} sub="histórico; política atual = zero-custo"/>
        <Card icon={<GraduationCap size={16}/>} label="Aguardando validação" valor={num(apr?.totais.pendentes||0)} sub="aprendizado"/>
        <Card icon={<TriangleAlert size={16}/>} label="Erros hoje" valor={num(dados?.resumoHoje?.erros||0)} sub="execuções com falha"/>
      </section>

      <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck size={19} className="text-emerald-700"/><h2 className="font-black text-emerald-950">Política Zero Custo</h2></div>
            <p className="mt-1 text-xs text-emerald-800">{dados?.runtimeGratis?.politicaDescricao||'Banco/regra interna → Ollama local → FreeLLMAPI. Sem fallback pago automático.'}</p>
          </div>
          <span className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white">{dados?.runtimeGratis?.paidProvidersBloqueados!==false?'PAGOS BLOQUEADOS':'ATENÇÃO: política alterada'}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RuntimeCard titulo="1 · Ollama local" ativo={Boolean(dados?.runtimeGratis?.opencode?.ordemGratis?.[0]?.habilitado)} detalhe={(dados?.runtimeGratis?.opencode?.ordemGratis?.[0]?.modelId||'modelo local')+(dados?.runtimeGratis?.opencode?.ordemGratis?.[0]?.temporariamentePulado?' · em espera após falha':'')}/>
          <RuntimeCard titulo="2 · FreeLLMAPI" ativo={Boolean(dados?.runtimeGratis?.runtimes?.opencode?.configurado)} detalhe={(dados?.runtimeGratis?.opencode?.providerId||'freellmapi')+'/'+(dados?.runtimeGratis?.opencode?.modelId||'free-router')}/>
          <RuntimeCard titulo="Áudio · Whisper local" ativo={Boolean(dados?.runtimeGratis?.runtimes?.whisper?.configurado)} detalhe={dados?.runtimeGratis?.runtimes?.whisper?.configurado?'conectado · US$ 0':'aguardando runtime local'}/>
          <RuntimeCard titulo="Imagem · Stable Diffusion" ativo={Boolean(dados?.runtimeGratis?.runtimes?.imagem_local?.configurado)} detalhe={dados?.runtimeGratis?.runtimes?.imagem_local?.configurado?'conectado · US$ 0':'aguardando runtime local'}/>
        </div>
        <p className="mt-3 text-[11px] text-emerald-800">Consultas internas do Atlas usam banco e regras antes de chamar qualquer modelo. Se um runtime gratuito cair, o Atlas não migra silenciosamente para API paga.</p>
      </section>

      <section className="mb-5 overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-black">Escritório animado dos agentes</h2><p className="text-xs text-slate-500">Agentes em atividade se movimentam entre a mesa e a estação de trabalho.</p></div>
        <div className="office relative hidden h-[500px] overflow-hidden md:block">
          {ROLES.map((r,i)=>{
            const a=agentes.find(x=>x.id===r.id)
            return <div key={r.id} className={'station station-'+(i+1)+' '+(a?.estado==='trabalhando'?'station-active':a?.estado==='monitorando'?'station-learning':a?.estado==='observando'?'station-watch':'')}>
              <span className="station-state">{a?.estado==='trabalhando'?'● trabalhando':a?.estado==='monitorando'?'● monitorando/aprendendo':a?.estado==='observando'?'● observando':'○ disponível'}</span>
              <b>{r.emoji} {r.nome.replace('IA ','')}</b><small>{r.funcao}</small>
            </div>
          })}
          {agentes.map((a,i)=>{
            const movimento=a.id==='supervisor'
              ? (a.estado==='trabalhando'?'patrolling supervisor-working':'watching')
              : a.estado==='trabalhando'?'working':a.estado==='monitorando'?'learning':a.estado==='observando'?'watching':'idle'
            return <button key={a.id} onClick={()=>setSel(a.id)} className={'agent agent-'+(i+1)+' '+movimento+' '+(sel===a.id?'selected':'')}>
              <span className="bubble"><i className={'dot '+a.estado}/>{a.atividade}</span>
              <span className="person"><i style={{background:a.cor}}/><b>{a.emoji}</b></span>
              <span className="tag">{a.nome}</span>
            </button>
          })}
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
      <p className="mt-4 text-[11px] text-slate-400">Custos são estimativas registradas pelo Atlas. Providers locais podem aparecer como custo zero. Atualização automática em segundo plano, com frequência reduzida para não pesar na navegação. Movimento representa estado operacional: trabalhando, monitorando/aprendendo, observando ou disponível. WhatsApp e Orçamentista permanecem ativos em monitoramento contínuo enquanto suas automações estiverem ligadas.</p>
    </div>
    <style jsx>{`
      .office{background:linear-gradient(90deg,#e2e8f066 1px,transparent 1px),linear-gradient(#e2e8f066 1px,transparent 1px),#f8fafc;background-size:40px 40px}
      .station{position:absolute;width:170px;height:72px;border:1px solid #dbe3ee;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 22px #0f17240d;transition:.3s}.station b{font-size:11px}.station small{font-size:9px;color:#94a3b8}.station-state{position:absolute;right:8px;top:6px;font-size:8px;font-weight:900;color:#94a3b8}.station-active{border-color:#86efac;box-shadow:0 0 0 3px #dcfce7,0 12px 30px #16a34a26}.station-active .station-state{color:#16a34a}.station-learning{border-color:#c4b5fd;box-shadow:0 0 0 3px #ede9fe,0 12px 30px #7c3aed1f}.station-learning .station-state{color:#7c3aed}.station-watch{border-color:#bfdbfe}.station-watch .station-state{color:#2563eb}.station-1{left:4%;top:8%}.station-2{left:39%;top:6%}.station-3{right:4%;top:8%}.station-4{left:5%;bottom:8%}.station-5{left:40%;bottom:6%}.station-6{right:4%;bottom:8%}
      .agent{--wx:0px;--wy:0px;position:absolute;width:150px;height:112px;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;z-index:5;will-change:transform}.agent-1{left:20%;top:28%;--wx:-125px;--wy:-105px}.agent-2{left:43%;top:25%;--wx:-22px;--wy:-100px}.agent-3{right:18%;top:28%;--wx:125px;--wy:-105px}.agent-4{left:20%;bottom:26%;--wx:-120px;--wy:100px}.agent-5{left:44%;bottom:23%;--wx:-25px;--wy:105px}.agent-6{right:18%;bottom:26%}.selected{filter:drop-shadow(0 7px 12px #2563eb33)}
      .bubble{position:absolute;bottom:82px;max-width:185px;border-radius:10px;background:#0f172a;color:white;padding:6px 8px;font-size:9px;font-weight:700;line-height:1.2;opacity:.9;box-shadow:0 5px 14px #0f172426}.bubble .dot{display:inline-block;width:6px;height:6px;border-radius:999px;margin-right:5px;background:#94a3b8}.bubble .dot.trabalhando{background:#22c55e;box-shadow:0 0 0 3px #22c55e33}.bubble .dot.monitorando{background:#8b5cf6;box-shadow:0 0 0 3px #8b5cf633}.bubble .dot.observando{background:#3b82f6}.person{position:relative;width:48px;height:58px;display:grid;place-items:center}.person i{position:absolute;bottom:0;width:42px;height:34px;border-radius:16px 16px 8px 8px}.person b{z-index:2;display:grid;width:34px;height:34px;place-items:center;border:2px solid #cbd5e1;border-radius:50%;background:white}.tag{margin-top:3px;border:1px solid #e2e8f0;border-radius:999px;background:white;padding:3px 7px;font-size:10px;font-weight:900;white-space:nowrap}
      .working{animation:walkToDesk 6s ease-in-out infinite}.working .person{animation:hop 650ms ease-in-out infinite}.working .bubble{animation:pulse 1.2s ease-in-out infinite}.learning{animation:learningLoop 9s ease-in-out infinite}.learning .person{animation:learningHop 1.8s ease-in-out infinite}.learning .bubble{animation:learningPulse 2.4s ease-in-out infinite}.watching{animation:inspect 7s ease-in-out infinite}.watching .person b{animation:look 2.4s ease-in-out infinite}.idle .person{animation:breathe 3.5s ease-in-out infinite}.patrolling{animation:patrol 8s ease-in-out infinite}.patrolling .person{animation:hop .75s ease-in-out infinite}.supervisor-working .bubble{background:#4c1d95;box-shadow:0 0 0 4px #8b5cf633,0 8px 24px #4c1d9540}
      @keyframes walkToDesk{0%,12%,100%{transform:translate(0,0)}42%,68%{transform:translate(var(--wx),var(--wy))}82%{transform:translate(calc(var(--wx)*.35),calc(var(--wy)*.35))}}
      @keyframes learningLoop{0%,100%{transform:translate(0,0)}28%{transform:translate(calc(var(--wx)*.28),calc(var(--wy)*.28))}55%{transform:translate(calc(var(--wx)*.08),calc(var(--wy)*.08))}78%{transform:translate(calc(var(--wx)*.2),calc(var(--wy)*.2))}}
      @keyframes learningHop{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes learningPulse{0%,100%{opacity:.9}50%{opacity:1;box-shadow:0 0 0 4px #8b5cf633,0 5px 14px #0f172426}}
      @keyframes inspect{0%,100%{transform:translate(0,0)}25%{transform:translate(12px,-5px)}50%{transform:translate(-8px,4px)}75%{transform:translate(8px,8px)}}
      @keyframes patrol{0%,100%{transform:translate(0,0)}22%{transform:translate(-90px,-60px)}48%{transform:translate(-220px,-12px)}72%{transform:translate(-100px,72px)}}
      @keyframes hop{50%{transform:translateY(-5px)}}@keyframes look{0%,100%{transform:rotate(0)}35%{transform:rotate(-8deg)}70%{transform:rotate(8deg)}}@keyframes breathe{50%{transform:translateY(-2px)}}@keyframes pulse{50%{opacity:1;transform:scale(1.03)}}
      @media(prefers-reduced-motion:reduce){.working,.learning,.watching,.idle .person,.patrolling,.working .person,.working .bubble,.learning .person,.learning .bubble,.watching .person b,.patrolling .person{animation:none}}
    `}</style>
  </main>
}

function Card({icon,label,valor,sub}:{icon:React.ReactNode;label:string;valor:string;sub:string}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex justify-between text-xs font-bold text-slate-500"><span>{label}</span>{icon}</div><div className="mt-2 text-xl font-black">{valor}</div><div className="text-[11px] text-slate-400">{sub}</div></div>}
function RuntimeCard({titulo,ativo,detalhe}:{titulo:string;ativo:boolean;detalhe:string}){return <div className="rounded-2xl border border-emerald-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-slate-800">{titulo}</b><span className={'rounded-full px-2 py-0.5 text-[9px] font-black '+(ativo?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')}>{ativo?'ATIVO':'PENDENTE'}</span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{detalhe}</p></div>}
function Mini({l,v}:{l:string;v:string}){return <div className="rounded-xl border bg-slate-50 p-3"><small className="font-bold uppercase text-slate-400">{l}</small><div className="truncate text-xs font-black" title={v}>{v}</div></div>}
