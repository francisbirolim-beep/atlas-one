'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Bot, BrainCircuit, CircleDollarSign, GraduationCap, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type AgenteApi={nome:string;execucoes30d:number;custo30d:number;ultimaAtividadeEm:string|null;provider:string|null;modelo:string|null;setor:string|null}
type Uso={agente_nome:string|null;setor_id:string|null;created_at:string;sucesso:boolean}
type OperacaoAgente={trabalhando:boolean;monitorando?:boolean;atividade:string;ultimaAtividadeEm:string|null;aguardandoValidacao?:number;correcoes30d?:number;modo?:string|null}
type AtividadeRecente={id:string;agente_id?:string|null;agente_nome?:string|null;contexto?:string|null;tarefa?:string|null;status?:string|null;iniciou_em?:string|null;atualizou_em?:string|null;finalizou_em?:string|null}
type Dados={resumo:{custoEstimado:number};resumoHoje:{execucoes:number;sucessos:number;erros:number;custoEstimado:number};agentes:AgenteApi[];usoRecentes:Uso[];atividadesRecentes?:AtividadeRecente[];operacaoAgora?:Partial<Record<string,OperacaoAgente>>;runtimeGratis?:any}
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
  const [movimentoAtivo,setMovimentoAtivo]=useState(true)

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
    let fonte=operacional
      ? 'Status vindo da operação real do Atlas'
      : uso
        ? 'Status inferido pelo último log real de execução'
        : base
          ? 'Status inferido pelo histórico real de 30 dias'
          : 'Sem evento real recente; animação em espera'
    if(r.id==='orcamento'&&(operacional?.aguardandoValidacao||0)>0&&estado==='disponível')estado='monitorando'
    if(r.id==='catalogo'&&(apr?.totais.pendentes||0)>0&&!operacional?.trabalhando){atividade='Acompanhando '+(apr?.totais.pendentes||0)+' validação(ões) pendente(s)';fonte='Status vindo da Central de Aprendizado';if(estado==='disponível')estado='observando'}
    return {...r,estado,atividade,fonte,ultima,exec:Number(base?.execucoes30d||0),custo:Number(base?.custo30d||0),provider:base?.provider||'—',modelo:base?.modelo||'—'}
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
      supervisor.fonte=ativosEspecialistas?'Status derivado dos agentes ativos':'Status de supervisão contínua'
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-black">Escritório vivo dos agentes</h2>
            <p className="text-xs text-slate-500">Os bonequinhos representam o estado real lido no Atlas; o trajeto é uma animação visual, e a fonte do status aparece no detalhe do agente.</p>
          </div>
          <button onClick={()=>setMovimentoAtivo(v=>!v)} className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
            {movimentoAtivo?'Pausar movimento':'Continuar movimento'}
          </button>
        </div>

        <div className="p-3 md:p-5">
          <div className={'atlas-office relative hidden h-[560px] overflow-hidden rounded-2xl border md:block '+(!movimentoAtivo?'office-paused':'')}>
            <div className="office-wall office-wall-top"/>
            <div className="office-title">ATLAS ONE · CENTRAL DE IA</div>
            <div className="office-plant plant-1">🪴</div>
            <div className="office-plant plant-2">🌿</div>
            <div className="office-printer">🖨️<small>Impressora</small></div>

            {ROLES.map((r,i)=>{
              const a=agentes.find(x=>x.id===r.id)
              return <button key={r.id} onClick={()=>setSel(r.id)} className={'workstation workstation-'+(i+1)+' '+(sel===r.id?'workstation-selected ':'')+(a?.estado==='trabalhando'?'workstation-active':a?.estado==='monitorando'?'workstation-learning':a?.estado==='observando'?'workstation-watch':'')}>
                <span className="desk-label"><b>{r.nome}</b><small>{r.funcao}</small></span>
                <span className="desk">
                  <i className="monitor"><em/></i>
                  <i className="keyboard"/>
                  <i className="desk-paper">📄</i>
                  <i className="desk-cup">☕</i>
                </span>
                <span className="chair"><i/></span>
                <span className="station-state">{a?.estado==='trabalhando'?'● trabalhando':a?.estado==='monitorando'?'● monitorando':a?.estado==='observando'?'● observando':'○ disponível'}</span>
              </button>
            })}

            <div className="office-central">
              <span className="central-brain">🧠</span>
              <b>Central Atlas IA</b>
              <small>recebe · cruza · distribui</small>
              <i className="central-pulse"/>
            </div>

            {agentes.map((a,i)=>{
              const movimento=a.id==='supervisor'
                ? (a.estado==='trabalhando'?'agent-patrol supervisor-working':'agent-watch')
                : a.estado==='trabalhando'?'agent-working':a.estado==='monitorando'?'agent-learning':a.estado==='observando'?'agent-watch':'agent-idle'
              const pessoa=['🧑‍💼','🧑‍💻','👩‍💻','🧑‍🔧','👩‍💼','🧑‍💼'][i]||'🧑‍💻'
              return <button key={a.id} onClick={()=>setSel(a.id)} className={'office-agent office-agent-'+(i+1)+' '+movimento+' '+(sel===a.id?'agent-selected':'')}>
                <span className="activity-bubble"><i className={'dot '+a.estado}/>{a.atividade}</span>
                <span className="walker">
                  <span className="person-emoji">{pessoa}</span>
                  <span className="carried-file">{a.estado==='trabalhando'?'📁':a.estado==='monitorando'?'📋':'📄'}</span>
                  <i className="step-shadow"/>
                </span>
                <span className="agent-name">{a.nome.replace('IA ','')}</span>
              </button>
            })}

            <div className="office-legend">
              <span><i className="legend-dot working-dot"/> trabalhando</span>
              <span><i className="legend-dot learning-dot"/> monitorando</span>
              <span><i className="legend-dot watch-dot"/> observando</span>
            </div>
          </div>

          <div className="grid gap-2 md:hidden">
            {agentes.map(a=><button key={a.id} onClick={()=>setSel(a.id)} className="flex items-center gap-3 rounded-xl border p-3 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-xl text-lg text-white" style={{background:a.cor}}>{a.emoji}</span>
              <span className="min-w-0 flex-1"><b className="block">{a.nome}</b><small className="block truncate text-slate-500">{a.atividade}</small></span>
            </button>)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl text-white" style={{background:escolhido.cor}}>{escolhido.emoji}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{escolhido.nome}</h3><span className="rounded-full border bg-slate-50 px-2 py-1 text-[11px] font-bold">{escolhido.estado}</span></div><p className="text-sm text-slate-500">{escolhido.funcao}</p><div className="mt-3 rounded-xl bg-slate-50 p-3"><small className="font-bold uppercase text-slate-400">Atividade atual</small><p className="font-semibold">{escolhido.atividade}</p></div></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Mini l="Execuções 30d" v={num(escolhido.exec)}/><Mini l="Custo 30d" v={usd(escolhido.custo)}/><Mini l="Provider" v={escolhido.provider}/><Mini l="Modelo" v={escolhido.modelo}/></div>
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><b>Fonte do movimento:</b> {escolhido.fonte}</div>
          <p className="mt-3 text-xs text-slate-400">Última atividade: {data(escolhido.ultima)}</p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black">Supervisão e validação</h3><p className="mt-1 text-xs text-slate-500">Acesse os controles ligados à operação dos agentes.</p><div className="mt-4 space-y-2"><Link href="/atlas-ia/aprendizado" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50"><GraduationCap/><span><b className="block text-sm">Central de Aprendizado</b><small className="text-slate-500">{apr?.totais.pendentes||0} pendente(s)</small></span></Link><Link href="/administracao/ia" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50"><ShieldCheck/><span><b className="block text-sm">Controle Master da IA</b><small className="text-slate-500">Custos, permissões e auditoria</small></span></Link></div></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-black">Atividades reais recentes</h3>
            <p className="mt-1 text-xs text-slate-500">Eventos gravados na tabela de atividade dos agentes. Isso é o rastro real por trás da animação.</p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {(dados?.atividadesRecentes||[]).slice(0,8).map(item=><div key={item.id} className="rounded-xl border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate text-xs text-slate-900">{item.agente_nome||item.agente_id||'Agente IA'}</b>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.status||'—'}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.tarefa||item.contexto||'Atividade registrada'}</p>
                <p className="mt-1 text-[10px] text-slate-400">{data(item.atualizou_em||item.finalizou_em||item.iniciou_em)}</p>
              </div>)}
              {!(dados?.atividadesRecentes||[]).length&&<div className="rounded-xl border border-dashed p-4 text-center text-xs text-slate-400">Nenhuma atividade real recente registrada nos últimos minutos.</div>}
            </div>
          </div>
        </div>
      </section>
      <p className="mt-4 text-[11px] text-slate-400">Custos são estimativas registradas pelo Atlas. Providers locais podem aparecer como custo zero. Atualização automática em segundo plano, com frequência reduzida para não pesar na navegação. Movimento representa estado operacional: trabalhando, monitorando/aprendendo, observando ou disponível. WhatsApp e Orçamentista permanecem ativos em monitoramento contínuo enquanto suas automações estiverem ligadas.</p>
    </div>
    <style jsx>{`
      .atlas-office{
        background:
          linear-gradient(90deg,rgba(148,163,184,.10) 1px,transparent 1px),
          linear-gradient(rgba(148,163,184,.10) 1px,transparent 1px),
          linear-gradient(180deg,#f8fafc,#eef2f7);
        background-size:32px 32px,32px 32px,100% 100%;
      }
      .office-wall{position:absolute;background:#dbe4ee}.office-wall-top{left:0;right:0;top:0;height:10px}
      .office-title{position:absolute;left:50%;top:15px;transform:translateX(-50%);font-size:10px;font-weight:900;letter-spacing:.18em;color:#64748b;background:#fff;border:1px solid #dbe3ee;border-radius:999px;padding:5px 12px}
      .office-plant{position:absolute;font-size:25px;filter:drop-shadow(0 4px 3px #0f172420)}.plant-1{left:2%;top:43%}.plant-2{right:2%;top:47%}
      .office-printer{position:absolute;left:46%;bottom:13px;display:flex;gap:5px;align-items:center;border:1px solid #dbe3ee;border-radius:10px;background:white;padding:6px 9px;font-size:17px}.office-printer small{font-size:8px;color:#64748b;font-weight:800}
      .workstation{position:absolute;width:180px;height:128px;border:0;background:transparent;z-index:2;text-align:center}
      .workstation-1{left:4%;top:10%}.workstation-2{left:39%;top:8%}.workstation-3{right:4%;top:10%}.workstation-4{left:4%;bottom:9%}.workstation-5{left:39%;bottom:7%}.workstation-6{right:4%;bottom:9%}
      .desk-label{position:absolute;left:50%;top:0;transform:translateX(-50%);width:176px;border-radius:9px;background:#fff;border:1px solid #e2e8f0;padding:4px 6px;box-shadow:0 4px 10px #0f172410;z-index:3}
      .desk-label b{display:block;font-size:9px;color:#0f172a}.desk-label small{display:block;font-size:7px;color:#94a3b8}
      .desk{position:absolute;left:12px;right:12px;top:39px;height:49px;border-radius:7px;background:linear-gradient(180deg,#a16207,#854d0e);box-shadow:0 5px 0 #713f12,0 9px 14px #0f172422}
      .desk:before,.desk:after{content:'';position:absolute;bottom:-24px;width:7px;height:26px;background:#713f12;border-radius:2px}.desk:before{left:13px}.desk:after{right:13px}
      .monitor{position:absolute;left:50%;top:-17px;transform:translateX(-50%);width:40px;height:28px;border:3px solid #334155;border-radius:4px;background:#dbeafe;box-shadow:0 2px 5px #0f172433}
      .monitor:after{content:'';position:absolute;left:15px;bottom:-9px;width:6px;height:7px;background:#475569}.monitor em{position:absolute;inset:4px;background:linear-gradient(135deg,#93c5fd,#e0f2fe);border-radius:2px}
      .keyboard{position:absolute;left:55px;bottom:7px;width:42px;height:8px;border-radius:3px;background:#e2e8f0;border:1px solid #cbd5e1}.desk-paper{position:absolute;left:12px;bottom:5px;font-size:14px}.desk-cup{position:absolute;right:12px;bottom:5px;font-size:13px}
      .chair{position:absolute;left:50%;top:92px;transform:translateX(-50%);width:40px;height:26px;border-radius:10px 10px 5px 5px;background:#475569;box-shadow:0 4px 0 #334155}.chair:after{content:'';position:absolute;left:18px;bottom:-13px;width:4px;height:13px;background:#64748b}.chair i:before,.chair i:after{content:'';position:absolute;bottom:-15px;width:17px;height:3px;background:#64748b}.chair i:before{left:4px;transform:rotate(-18deg)}.chair i:after{right:4px;transform:rotate(18deg)}
      .station-state{position:absolute;right:7px;top:43px;z-index:4;font-size:7px;font-weight:900;color:#94a3b8;background:#fff;border-radius:999px;padding:2px 5px;border:1px solid #e2e8f0}
      .workstation-active .station-state{color:#16a34a}.workstation-learning .station-state{color:#7c3aed}.workstation-watch .station-state{color:#2563eb}
      .workstation-active .desk-label{border-color:#86efac;box-shadow:0 0 0 3px #dcfce7,0 4px 12px #16a34a1c}.workstation-learning .desk-label{border-color:#c4b5fd;box-shadow:0 0 0 3px #ede9fe}.workstation-selected .desk-label{outline:2px solid #334155;outline-offset:2px}
      .office-central{position:absolute;left:50%;top:49%;transform:translate(-50%,-50%);width:180px;height:105px;border-radius:50%;border:2px solid #cbd5e1;background:radial-gradient(circle at 50% 35%,#fff,#e2e8f0);box-shadow:0 12px 30px #0f17241a;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1}
      .office-central b{font-size:11px}.office-central small{font-size:8px;color:#64748b}.central-brain{font-size:25px}.central-pulse{position:absolute;inset:-8px;border:2px solid #94a3b8;border-radius:50%;opacity:.25;animation:centralPulse 2.2s ease-in-out infinite}
      .office-agent{position:absolute;width:142px;height:110px;border:0;background:transparent;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;will-change:transform}
      .office-agent-1{left:29%;top:36%;--tx:-205px;--ty:-128px}.office-agent-2{left:42%;top:34%;--tx:0px;--ty:-140px}.office-agent-3{left:55%;top:36%;--tx:205px;--ty:-128px}.office-agent-4{left:29%;top:52%;--tx:-205px;--ty:145px}.office-agent-5{left:42%;top:55%;--tx:0px;--ty:142px}.office-agent-6{left:55%;top:52%;--tx:205px;--ty:145px}
      .activity-bubble{position:absolute;bottom:79px;max-width:190px;border-radius:10px;background:#0f172a;color:#fff;padding:6px 8px;font-size:8px;font-weight:800;line-height:1.25;box-shadow:0 5px 14px #0f172426;white-space:normal}
      .dot{display:inline-block;width:6px;height:6px;border-radius:999px;margin-right:5px;background:#94a3b8}.dot.trabalhando{background:#22c55e;box-shadow:0 0 0 3px #22c55e33}.dot.monitorando{background:#8b5cf6;box-shadow:0 0 0 3px #8b5cf633}.dot.observando{background:#3b82f6}
      .walker{position:relative;height:58px;width:62px;display:grid;place-items:center}.person-emoji{position:relative;z-index:2;font-size:36px;filter:drop-shadow(0 3px 2px #0f172426)}.carried-file{position:absolute;right:2px;top:21px;z-index:3;font-size:15px;transform:rotate(9deg)}.step-shadow{position:absolute;left:13px;right:13px;bottom:2px;height:7px;border-radius:50%;background:#0f172a1c;filter:blur(1px)}
      .agent-name{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:3px 7px;font-size:8px;font-weight:900;color:#334155;white-space:nowrap}.agent-selected .agent-name{border-color:#334155;box-shadow:0 0 0 2px #cbd5e1}
      .agent-working{animation:walkToDesk 7s ease-in-out infinite}.agent-working .walker{animation:stepBob .48s ease-in-out infinite}.agent-working .carried-file{animation:fileSwing .5s ease-in-out infinite}
      .agent-learning{animation:walkToDesk 10s ease-in-out infinite}.agent-learning .walker{animation:stepBob .8s ease-in-out infinite}.agent-watch{animation:smallPatrol 8s ease-in-out infinite}.agent-idle .walker{animation:breathe 3.2s ease-in-out infinite}
      .agent-patrol{animation:supervisorPatrol 12s ease-in-out infinite}.agent-patrol .walker{animation:stepBob .6s ease-in-out infinite}.supervisor-working .activity-bubble{background:#4c1d95}
      .office-legend{position:absolute;right:14px;bottom:10px;display:flex;gap:9px;align-items:center;border:1px solid #e2e8f0;background:#ffffffd9;border-radius:999px;padding:5px 8px;font-size:7px;color:#64748b;font-weight:800}.legend-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px}.working-dot{background:#22c55e}.learning-dot{background:#8b5cf6}.watch-dot{background:#3b82f6}
      .office-paused *{animation-play-state:paused!important}
      @keyframes walkToDesk{0%,14%,100%{transform:translate(0,0)}38%,65%{transform:translate(var(--tx),var(--ty))}76%{transform:translate(calc(var(--tx)*.75),calc(var(--ty)*.75))}88%{transform:translate(calc(var(--tx)*.3),calc(var(--ty)*.3))}}
      @keyframes stepBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-5px) rotate(1deg)}}@keyframes fileSwing{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-8deg)}}@keyframes smallPatrol{0%,100%{transform:translate(0,0)}30%{transform:translate(22px,-10px)}58%{transform:translate(-18px,10px)}80%{transform:translate(10px,16px)}}@keyframes breathe{50%{transform:translateY(-2px)}}@keyframes supervisorPatrol{0%,100%{transform:translate(0,0)}20%{transform:translate(-160px,-95px)}42%{transform:translate(110px,-100px)}64%{transform:translate(130px,115px)}82%{transform:translate(-140px,105px)}}@keyframes centralPulse{0%,100%{transform:scale(.98);opacity:.15}50%{transform:scale(1.05);opacity:.35}}
      @media(prefers-reduced-motion:reduce){.agent-working,.agent-learning,.agent-watch,.agent-idle .walker,.agent-patrol,.agent-working .walker,.agent-working .carried-file,.agent-learning .walker,.central-pulse{animation:none}}
    `}</style>
  </main>
}

function Card({icon,label,valor,sub}:{icon:React.ReactNode;label:string;valor:string;sub:string}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex justify-between text-xs font-bold text-slate-500"><span>{label}</span>{icon}</div><div className="mt-2 text-xl font-black">{valor}</div><div className="text-[11px] text-slate-400">{sub}</div></div>}
function RuntimeCard({titulo,ativo,detalhe}:{titulo:string;ativo:boolean;detalhe:string}){return <div className="rounded-2xl border border-emerald-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-slate-800">{titulo}</b><span className={'rounded-full px-2 py-0.5 text-[9px] font-black '+(ativo?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')}>{ativo?'ATIVO':'PENDENTE'}</span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{detalhe}</p></div>}
function Mini({l,v}:{l:string;v:string}){return <div className="rounded-xl border bg-slate-50 p-3"><small className="font-bold uppercase text-slate-400">{l}</small><div className="truncate text-xs font-black" title={v}>{v}</div></div>}
