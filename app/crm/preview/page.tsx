'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3,
  CalendarClock, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clock3,
  Filter, Flame, LayoutGrid, ListTodo, MapPin, MessageCircle, MoreHorizontal,
  Plus, Search, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, Users,
  WalletCards, X,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao } from '@/lib/tipos'

type Etapa = 'novo' | 'qualificacao' | 'visita' | 'proposta' | 'negociacao' | 'ganho' | 'perdido'
type Temperatura = 'quente' | 'morno' | 'frio'
type Aba = 'painel' | 'funil' | 'agenda' | 'analise'
interface Oportunidade {
  id: string
  cliente: string
  obra: string
  cidade: string
  origem: string
  responsavel: string
  etapa: Etapa
  valor: number
  temperatura: Temperatura
  proximaAcao: string
  prazo: string
  ultimoContato: string
  observacao: string
  diasProposta?: number
}
const ETAPAS: Array<{ id: Etapa; nome: string; curto: string; detalhe: string; cor: string }> = [
  { id: 'novo', nome: 'Novo contato', curto: 'Novos', detalhe: 'Identificar necessidade', cor: 'bg-sky-500' },
  { id: 'qualificacao', nome: 'Qualificação', curto: 'Qualificação', detalhe: 'Projeto, medidas e cidade', cor: 'bg-indigo-500' },
  { id: 'visita', nome: 'Visita / medição', curto: 'Visita', detalhe: 'Levantamento técnico', cor: 'bg-violet-500' },
  { id: 'proposta', nome: 'Proposta enviada', curto: 'Proposta', detalhe: 'Acompanhar validade', cor: 'bg-amber-500' },
  { id: 'negociacao', nome: 'Negociação', curto: 'Negociação', detalhe: 'Próximo passo decisivo', cor: 'bg-emerald-500' },
]
const ETAPA_NOMES: Record<Etapa, string> = {
  novo: 'Novo contato', qualificacao: 'Qualificação', visita: 'Visita / medição',
  proposta: 'Proposta enviada', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido',
}
const ORIGENS = ['Indicação','Arquiteto','Instagram','Google','WhatsApp','Engenheiro','Construtora','Passou em frente']
function isoDias(dias: number) {
  const d = new Date()
  d.setHours(12,0,0,0)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0,10)
}
function demo(): Oportunidade[] {
  return [
    { id:'1',cliente:'Mariana Lopes',obra:'Residência Jardim Sul',cidade:'José Bonifácio',origem:'Arquiteto',responsavel:'Francis',etapa:'novo',valor:18500,temperatura:'quente',proximaAcao:'Solicitar projeto arquitetônico',prazo:isoDias(0),ultimoContato:'Hoje, 09:20',observacao:'Interessada em portas de correr e esquadrias pretas.' },
    { id:'2',cliente:'Construtora Horizonte',obra:'Condomínio das Flores',cidade:'São José do Rio Preto',origem:'Construtora',responsavel:'Keila',etapa:'novo',valor:63000,temperatura:'morno',proximaAcao:'Confirmar cronograma da obra',prazo:isoDias(2),ultimoContato:'Ontem, 16:10',observacao:'Levantamento inicial de 8 unidades.' },
    { id:'3',cliente:'Paulo Ribeiro',obra:'Ampliação área gourmet',cidade:'Mirassol',origem:'Indicação',responsavel:'Francis',etapa:'qualificacao',valor:12400,temperatura:'morno',proximaAcao:'Conferir medidas enviadas',prazo:isoDias(-1),ultimoContato:'Há 3 dias',observacao:'Cliente pediu alternativas Suprema e Plus.' },
    { id:'4',cliente:'Juliana Martins',obra:'Reforma residencial',cidade:'José Bonifácio',origem:'Instagram',responsavel:'Keila',etapa:'qualificacao',valor:9700,temperatura:'frio',proximaAcao:'Retomar contato por WhatsApp',prazo:isoDias(3),ultimoContato:'Há 2 dias',observacao:'Aguardando confirmação de cor e vidro.' },
    { id:'5',cliente:'Ricardo Almeida',obra:'Casa Alto da Boa Vista',cidade:'Bady Bassitt',origem:'Arquiteto',responsavel:'Francis',etapa:'visita',valor:42100,temperatura:'quente',proximaAcao:'Realizar medição comercial',prazo:isoDias(1),ultimoContato:'Hoje, 11:40',observacao:'Arquiteto quer orçamento completo após visita.' },
    { id:'6',cliente:'Cláudia Ferreira',obra:'Espaço comercial',cidade:'Potirendaba',origem:'Google',responsavel:'Keila',etapa:'visita',valor:26700,temperatura:'morno',proximaAcao:'Agendar visita técnica',prazo:isoDias(0),ultimoContato:'Ontem, 10:20',observacao:'Fachada de vidro e porta de acesso.' },
    { id:'7',cliente:'Eduardo Moreira',obra:'Residência Nova Europa',cidade:'José Bonifácio',origem:'Indicação',responsavel:'Francis',etapa:'proposta',valor:34500,temperatura:'quente',proximaAcao:'Confirmar recebimento da proposta',prazo:isoDias(-2),ultimoContato:'Há 4 dias',observacao:'Orçamento sob medida enviado; prazo de validade de 7 dias.',diasProposta:6 },
    { id:'8',cliente:'Ana Beatriz Costa',obra:'Casa no Centro',cidade:'Mirassol',origem:'WhatsApp',responsavel:'Keila',etapa:'proposta',valor:15800,temperatura:'morno',proximaAcao:'Enviar opções de pagamento',prazo:isoDias(1),ultimoContato:'Ontem, 14:00',observacao:'Solicitou condições de pagamento.',diasProposta:3 },
    { id:'9',cliente:'Felipe Nogueira',obra:'Residência Primavera',cidade:'José Bonifácio',origem:'Engenheiro',responsavel:'Francis',etapa:'negociacao',valor:58500,temperatura:'quente',proximaAcao:'Ligar para concluir negociação',prazo:isoDias(0),ultimoContato:'Hoje, 08:50',observacao:'Proposta revisada; aguardando sinal.' },
    { id:'10',cliente:'Sônia Mendes',obra:'Espaço gourmet',cidade:'São José do Rio Preto',origem:'Instagram',responsavel:'Keila',etapa:'negociacao',valor:22200,temperatura:'morno',proximaAcao:'Revisar escopo da proposta',prazo:isoDias(-3),ultimoContato:'Há 5 dias',observacao:'Possível alteração para menor quantidade de folhas.' },
    { id:'11',cliente:'Daniel Batista',obra:'Portas residenciais',cidade:'José Bonifácio',origem:'Indicação',responsavel:'Francis',etapa:'ganho',valor:18700,temperatura:'quente',proximaAcao:'Encaminhar para o módulo Vendas',prazo:isoDias(1),ultimoContato:'Ontem, 17:10',observacao:'Venda demonstrativa concluída.' },
    { id:'12',cliente:'Patrícia Oliveira',obra:'Reforma escritório',cidade:'Mirassol',origem:'Google',responsavel:'Keila',etapa:'perdido',valor:11500,temperatura:'frio',proximaAcao:'Registrar motivo de perda',prazo:isoDias(-4),ultimoContato:'Há 9 dias',observacao:'Escolheu outro fornecedor: registrar motivo e aprender.' },
  ]
}
function brl(n: number) { return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) }
function dataBR(iso:string) { return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) }
function diasAte(iso:string) {
  const hoje = new Date(); hoje.setHours(12,0,0,0)
  const d = new Date(iso+'T12:00:00')
  return Math.round((d.getTime()-hoje.getTime())/86400000)
}
function situacao(p:Oportunidade) {
  if (p.etapa==='ganho'||p.etapa==='perdido') return 'encerrado'
  return diasAte(p.prazo)<0?'atrasado':diasAte(p.prazo)===0?'hoje':'futuro'
}
function pillTemperatura(t:Temperatura){
  return t==='quente'?'bg-rose-50 text-rose-700 border-rose-100':t==='morno'?'bg-amber-50 text-amber-700 border-amber-100':'bg-sky-50 text-sky-700 border-sky-100'
}
function Iniciais({nome}:{nome:string}){return <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">{nome.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>}
function Etiqueta({children,classe=''}:{children:React.ReactNode;classe?:string}){return <span className={'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold '+classe}>{children}</span>}
function Cartao({p,onAbrir,onArrastar}:{p:Oportunidade;onAbrir:()=>void;onArrastar:()=>void}){
  const s=situacao(p)
  return <button type="button" draggable onDragStart={onArrastar} onClick={onAbrir} className="group w-full cursor-grab rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:cursor-grabbing">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[13px] font-bold text-slate-900">{p.cliente}</p><p className="mt-1 truncate text-[11px] text-slate-500">{p.obra}</p></div><MoreHorizontal size={16} className="shrink-0 text-slate-300 group-hover:text-blue-600"/></div>
    <p className="mt-3 text-[17px] font-black tracking-tight text-slate-900">{brl(p.valor)}</p>
    <div className="mt-3 flex flex-wrap gap-1.5"><Etiqueta classe={pillTemperatura(p.temperatura)}><span className={'h-1.5 w-1.5 rounded-full '+(p.temperatura==='quente'?'bg-rose-500':p.temperatura==='morno'?'bg-amber-500':'bg-sky-500')}/>{p.temperatura}</Etiqueta>{p.etapa==='proposta'&&p.diasProposta!==undefined&&p.diasProposta>=5&&<Etiqueta classe="border-amber-200 bg-amber-50 text-amber-700">Validade: 7 dias</Etiqueta>}</div>
    <p className="mt-3 flex items-center gap-1.5 truncate text-[11px] text-slate-500"><MapPin size={12}/>{p.cidade}</p>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="flex items-center gap-1.5 text-[11px] text-slate-500"><Iniciais nome={p.responsavel}/>{p.responsavel}</span><span className={'flex items-center gap-1 text-[11px] font-bold '+(s==='atrasado'?'text-rose-600':s==='hoje'?'text-amber-600':'text-slate-500')}><Clock3 size={12}/>{s==='atrasado'?'Atrasado':s==='hoje'?'Hoje':dataBR(p.prazo)}</span></div>
  </button>
}
export default function CrmPreviewPage(){
  const [nivel,setNivel]=useState<NivelPermissao>('oculto')
  const [autorizacao,setAutorizacao]=useState<'carregando'|'liberado'|'restrito'>('carregando')
  const [itens,setItens]=useState<Oportunidade[]>(demo)
  const [aba,setAba]=useState<Aba>('painel')
  const [busca,setBusca]=useState('')
  const [dono,setDono]=useState('todos')
  const [origem,setOrigem]=useState('todas')
  const [prioridade,setPrioridade]=useState(false)
  const [selecionado,setSelecionado]=useState<string|null>(null)
  const [arrastando,setArrastando]=useState<string|null>(null)
  const [novo,setNovo]=useState(false)
  const [nomeNovo,setNomeNovo]=useState('')
  const [obraNova,setObraNova]=useState('')
  const [valorNovo,setValorNovo]=useState('')
  const [responsavelNovo,setResponsavelNovo]=useState('Francis')
  const [anotacao,setAnotacao]=useState('')
  const [data,setData]=useState('')
  const [feedback,setFeedback]=useState('')
  useEffect(()=>{
    let ativo=true
    void (async()=>{
      const me=await usuarioAtual().catch(()=>null)
      if(!ativo)return
      if(!me){setAutorizacao('restrito');return}
      const permissoes=me.role==='master'?{}:await listarPermissoesUsuario(me.id).catch(()=>null)
      if(!ativo)return
      if(permissoes===null){setAutorizacao('restrito');return}
      const nv=nivelEfetivo(me,'crm',permissoes)
      setNivel(nv)
      setAutorizacao(nv==='oculto'?'restrito':'liberado')
    })()
    return ()=>{ativo=false}
  },[])
  const podeEditar=nivel==='edicao'
  const filtrados=useMemo(()=>itens.filter(p=>{
    if(dono!=='todos'&&p.responsavel!==dono)return false
    if(origem!=='todas'&&p.origem!==origem)return false
    if(prioridade&&p.temperatura!=='quente'&&situacao(p)!=='atrasado')return false
    const s=busca.trim().toLowerCase()
    return !s||[p.cliente,p.obra,p.cidade,p.origem,p.responsavel].some(v=>v.toLowerCase().includes(s))
  }),[itens,dono,origem,prioridade,busca])
  const abertos=filtrados.filter(p=>!['ganho','perdido'].includes(p.etapa))
  const atrasados=abertos.filter(p=>situacao(p)==='atrasado')
  const hoje=abertos.filter(p=>situacao(p)==='hoje')
  const propostas=abertos.filter(p=>p.etapa==='proposta')
  const ganhos=filtrados.filter(p=>p.etapa==='ganho')
  const perdidos=filtrados.filter(p=>p.etapa==='perdido')
  const volume=abertos.reduce((a,p)=>a+p.valor,0)
  const projeção=abertos.reduce((a,p)=>a+p.valor*({novo:.1,qualificacao:.2,visita:.4,proposta:.6,negociacao:.8} as Record<string,number>)[p.etapa],0)
  const ativos=filtrados.find(p=>p.id===selecionado)
  const ordenar=(a:Oportunidade,b:Oportunidade)=>a.prazo.localeCompare(b.prazo)
  const listaAgenda=[...abertos].sort(ordenar)
  const proximas=listaAgenda.filter(p=>situacao(p)!=='futuro').slice(0,6)
  const responsaveis=Array.from(new Set(itens.map(p=>p.responsavel))).sort()
  function mover(id:string,etapa:Etapa) {
    if(!podeEditar)return
    setItens(prev=>prev.map(p=>p.id===id?{...p,etapa}:p))
    setFeedback('Movimentação demonstrativa realizada. Nenhum registro real foi alterado.')
    setArrastando(null)
  }
  function salvarDetalhe(){
    if(!ativos||!podeEditar)return
    setItens(prev=>prev.map(p=>p.id!==ativos.id?p:{...p,prazo:data||p.prazo,observacao:anotacao||p.observacao}))
    setFeedback('Atualização demonstrativa salva apenas nesta prévia.')
    setSelecionado(null)
  }
  function criar(){
    if(!nomeNovo.trim()||!podeEditar)return
    const item:Oportunidade={id:'demo-'+Date.now(),cliente:nomeNovo.trim(),obra:obraNova.trim()||'Nova oportunidade',cidade:'José Bonifácio',origem:'WhatsApp',responsavel:responsavelNovo,etapa:'novo',valor:Math.max(0,Number(valorNovo)||0),temperatura:'morno',proximaAcao:'Realizar primeiro contato',prazo:isoDias(1),ultimoContato:'Agora',observacao:'Oportunidade criada somente nesta prévia.'}
    setItens(prev=>[item,...prev]);setNovo(false);setNomeNovo('');setObraNova('');setValorNovo('');setAba('funil')
    setFeedback('Lead criado na demonstração. Não foi gravado no Atlas oficial.')
  }
  if(autorizacao==='carregando')return <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-500"><Activity className="mr-2 animate-pulse" size={18}/>Conferindo permissão do CRM...</div>
  if(autorizacao==='restrito')return <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-7"><ShieldCheck size={28} className="text-amber-600"/><h1 className="mt-3 text-xl font-bold">CRM: acesso não autorizado</h1><p className="mt-2 text-sm text-slate-600">Somente Master ou usuários com permissão para o setor CRM podem abrir esta prévia.</p><Link href="/" className="mt-4 inline-block text-sm font-bold text-blue-700">Voltar ao início</Link></div>
  return <div className="min-h-screen bg-[#f5f7fb] pb-16 text-[#1b2941]">
    <div className="bg-[#0f2341] text-white">
      <div className="mx-auto max-w-[1760px] px-4 pb-7 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Link href="/crm" className="rounded-xl border border-white/20 p-2.5 text-slate-200 transition hover:bg-white/10" title="Voltar ao CRM atual"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#79d5cf]">ATLAS ONE  /  COMERCIAL</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Central de Relacionamento</h1></div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[11px] font-bold text-amber-200">PRÉVIA · DADOS FICTÍCIOS</span><Link href="/crm" className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-slate-100 hover:bg-white/10">CRM atual <ArrowUpRight size={14} className="ml-1 inline"/></Link>{podeEditar&&<button onClick={()=>setNovo(true)} className="flex items-center gap-2 rounded-xl bg-[#32c4b2] px-4 py-2.5 text-sm font-black text-[#103044] shadow-lg shadow-black/10 hover:bg-[#4bd9c7]"><Plus size={17}/> Nova oportunidade</button>}</div>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">Uma visão completa do primeiro contato até a venda. Carteira, agenda, orçamento e negociação no mesmo lugar.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {nome:'Pipeline em aberto',numero:brl(volume),detalhe:'Valor das oportunidades',icone:WalletCards,destaque:'text-white'},
            {nome:'Oportunidades',numero:String(abertos.length),detalhe:'Negócios em andamento',icone:Target,destaque:'text-white'},
            {nome:'Retornos pendentes',numero:String(atrasados.length+hoje.length),detalhe:String(atrasados.length)+' atrasados · '+String(hoje.length)+' hoje',icone:CalendarClock,destaque:'text-amber-200'},
            {nome:'Propostas em aberto',numero:String(propostas.length),detalhe:'Validade padrão de 7 dias',icone:MessageCircle,destaque:'text-white'},
            {nome:'Previsão ponderada',numero:brl(projeção),detalhe:'Estimativa · não é venda',icone:TrendingUp,destaque:'text-[#79e5d2]'},
          ].map(k=><div key={k.nome} className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{k.nome}</p><k.icone size={16} className="text-[#79d5cf]"/></div><p className={'mt-3 text-2xl font-black tracking-tight '+k.destaque}>{k.numero}</p><p className="mt-1 text-[11px] text-slate-300">{k.detalhe}</p></div>)}
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-[1760px] space-y-5 px-4 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([{id:'painel',nome:'Visão do gestor',icone:LayoutGrid},{id:'funil',nome:'Funil de vendas',icone:Target},{id:'agenda',nome:'Agenda e tarefas',icone:ListTodo},{id:'analise',nome:'Inteligência comercial',icone:BarChart3}] as const).map(t=><button key={t.id} onClick={()=>setAba(t.id)} className={'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition '+(aba===t.id?'bg-[#142b4d] text-white':'text-slate-600 hover:bg-slate-50')}><t.icone size={15}/>{t.nome}</button>)}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><ShieldCheck size={14} className="text-emerald-600"/> Sem gravação de dados reais</p>
      </div>
      {feedback&&<div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><span><CheckCircle2 size={15} className="mr-2 inline"/>{feedback}</span><button onClick={()=>setFeedback('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[190px] flex-[2]"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input aria-label="Buscar oportunidade" className="w-full rounded-xl bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#5ebfb4]" placeholder="Buscar cliente, obra, cidade..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>
        <span className="ml-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><Filter size={15}/>FILTROS</span>
        <select aria-label="Filtrar por responsável" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold" value={dono} onChange={e=>setDono(e.target.value)}><option value="todos">Toda a equipe</option>{responsaveis.map(r=><option key={r} value={r}>{r}</option>)}</select>
        <select aria-label="Filtrar por origem" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold" value={origem} onChange={e=>setOrigem(e.target.value)}><option value="todas">Todas as origens</option>{ORIGENS.map(o=><option key={o} value={o}>{o}</option>)}</select>
        <button onClick={()=>setPrioridade(p=>!p)} aria-pressed={prioridade} className={'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold '+(prioridade?'border-rose-200 bg-rose-50 text-rose-700':'border-slate-200 text-slate-600 hover:bg-slate-50')}><Flame size={14}/> Prioridades</button>
        <span className="ml-auto text-xs text-slate-500">{filtrados.length} oportunidades</span>
      </div>
      {(aba==='painel'||aba==='funil')&&<div className={aba==='painel'?'grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]':''}>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#128b84]">Pipeline comercial</p><h2 className="mt-1 text-lg font-black">Funil de oportunidades</h2><p className="text-xs text-slate-500">Arraste os cards entre as etapas para simular o fluxo. Nada é salvo no sistema.</p></div><div className="text-right"><p className="text-xs text-slate-500">Em negociação</p><p className="text-lg font-black text-[#0f2341]">{brl(abertos.filter(p=>p.etapa==='negociacao').reduce((s,p)=>s+p.valor,0))}</p></div></div>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {ETAPAS.map(et=>{
              const itensEtapa=abertos.filter(p=>p.etapa===et.id)
              return <div key={et.id} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(arrastando)mover(arrastando,et.id)}} className="min-w-[218px] flex-1 rounded-2xl bg-[#f6f8fb] p-2.5">
                <div className="pb-3"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+et.cor}/><h3 className="text-xs font-extrabold text-slate-800">{et.nome}</h3></div><span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-slate-500">{itensEtapa.length}</span></div><p className="mb-1 text-[10px] text-slate-400">{et.detalhe}</p><p className="text-[15px] font-black text-slate-800">{brl(itensEtapa.reduce((s,p)=>s+p.valor,0))}</p></div>
                <div className="space-y-2.5">{itensEtapa.map(p=><Cartao key={p.id} p={p} onAbrir={()=>{setSelecionado(p.id);setAnotacao(p.observacao);setData(p.prazo)}} onArrastar={()=>setArrastando(p.id)}/>)}</div>
                {!itensEtapa.length&&<div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-[11px] text-slate-400">Arraste uma oportunidade para cá</div>}
              </div>
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500"/> Ganhos: <b className="text-slate-800">{ganhos.length} · {brl(ganhos.reduce((a,p)=>a+p.valor,0))}</b></span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500"/> Perdidos: <b className="text-slate-800">{perdidos.length}</b></span><span className="ml-auto">Cards e valores demonstrativos</span></div>
        </section>
        {aba==='painel'&&<aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-black">Prioridades de hoje</h2><CalendarClock size={18} className="text-amber-500"/></div><p className="mt-1 text-xs text-slate-500">O que precisa de atenção primeiro.</p><div className="mt-4 space-y-2.5">{proximas.length?proximas.map(p=><button key={p.id} onClick={()=>{setSelecionado(p.id);setAnotacao(p.observacao);setData(p.prazo)}} className="flex w-full items-start gap-2 rounded-xl border border-slate-100 p-2.5 text-left hover:bg-slate-50"><span className={'mt-1 h-2 w-2 shrink-0 rounded-full '+(situacao(p)==='atrasado'?'bg-rose-500':'bg-amber-400')}/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{p.cliente}</span><span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{p.proximaAcao}</span></span><ChevronRight size={14} className="text-slate-300"/></button>):<p className="py-4 text-xs text-slate-400">Sem pendências urgentes.</p>}</div><button onClick={()=>setAba('agenda')} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700">Abrir agenda <ArrowRight size={14}/></button></section>
          <section className="rounded-2xl border border-teal-100 bg-[#eafbfa] p-5"><div className="flex items-center gap-2"><Sparkles size={19} className="text-[#078d85]"/><h2 className="text-sm font-black text-[#115c60]">Assistente comercial</h2></div><p className="mt-2 text-[11px] leading-relaxed text-[#3b7779]">Exemplo de recomendações automáticas. Nesta prévia ainda não existe análise de IA ao vivo.</p><div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-[#245a60]"><b>{atrasados.length} contatos atrasados.</b> Priorize retornos antes de buscar novos leads.</div><div className="mt-2 rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-[#245a60]"><b>{propostas.length} propostas abertas.</b> Criar alerta automático no 3º e no 6º dia de validade.</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black">Carteira por vendedor</h2><div className="mt-3 space-y-3">{responsaveis.map(r=><div key={r} className="flex items-center gap-3"><Iniciais nome={r}/><span className="min-w-0 flex-1 text-xs font-bold">{r}<span className="block text-[11px] font-normal text-slate-400">{abertos.filter(p=>p.responsavel===r).length} em andamento</span></span><b className="text-xs">{brl(abertos.filter(p=>p.responsavel===r).reduce((s,p)=>s+p.valor,0))}</b></div>)}</div></section>
        </aside>}
      </div>}
      {aba==='agenda'&&<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Próximas ações</p><h2 className="mt-1 text-xl font-black">Agenda comercial</h2><p className="mt-1 text-xs text-slate-500">Retornos, medição, visitas e negociações que exigem acompanhamento.</p></div><div className="flex gap-2"><Etiqueta classe="border-rose-200 bg-rose-50 text-rose-700">{atrasados.length} atrasados</Etiqueta><Etiqueta classe="border-amber-200 bg-amber-50 text-amber-700">{hoje.length} hoje</Etiqueta></div></div>
        <div className="mt-5 divide-y divide-slate-100">{listaAgenda.map(p=><button key={p.id} onClick={()=>{setSelecionado(p.id);setAnotacao(p.observacao);setData(p.prazo)}} className="flex w-full flex-wrap items-center gap-3 px-2 py-4 text-left hover:bg-slate-50"><div className={'w-20 shrink-0 rounded-xl px-2 py-3 text-center '+(situacao(p)==='atrasado'?'bg-rose-50 text-rose-700':situacao(p)==='hoje'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-600')}><CalendarDays size={15} className="mx-auto mb-1"/><b className="text-xs">{dataBR(p.prazo)}</b></div><div className="min-w-[180px] flex-1"><b className="text-sm">{p.proximaAcao}</b><p className="mt-1 text-xs text-slate-500">{p.cliente} · {p.cidade}</p></div><div className="text-xs text-slate-500">{p.responsavel}<span className="mt-1 block">{ETAPA_NOMES[p.etapa]}</span></div><span className="text-sm font-bold">{brl(p.valor)}</span><ChevronRight size={17} className="text-slate-300"/></button>)}{!listaAgenda.length&&<p className="py-12 text-center text-sm text-slate-400">Nenhuma ação encontrada com esses filtros.</p>}</div>
      </section>}
      {aba==='analise'&&<div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center gap-2"><BarChart3 size={19} className="text-blue-600"/><h2 className="text-base font-black">Origem das oportunidades</h2></div><p className="mt-1 text-xs text-slate-500">Quais canais estão trazendo negócios, com valores demonstrativos.</p><div className="mt-6 space-y-4">{ORIGENS.map(o=>{const d=filtrados.filter(p=>p.origem===o);if(!d.length)return null;const montante=d.reduce((s,p)=>s+p.valor,0);const maximo=Math.max(...ORIGENS.map(x=>filtrados.filter(p=>p.origem===x).reduce((s,p)=>s+p.valor,0)),1);return <div key={o}><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold">{o} <span className="font-normal text-slate-400">({d.length})</span></span><b>{brl(montante)}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#22b8ab]" style={{width:String(Math.round(montante/maximo*100))+'%'}}/></div></div>})}</div></section>
        <section className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Target className="text-blue-600" size={20}/><h2 className="mt-3 text-sm font-black">Saúde do funil</h2><p className="mt-3 text-3xl font-black">{Math.round(ganhos.length/Math.max(1,ganhos.length+perdidos.length)*100)}%</p><p className="mt-1 text-xs text-slate-500">Conversão ilustrativa entre negócios encerrados.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><CircleAlert className="text-amber-600" size={20}/><h2 className="mt-3 text-sm font-black">Alertas recomendados</h2><p className="mt-2 text-xs leading-relaxed text-slate-600">Sem contato por 3 dias; proposta próxima de vencer (7 dias); visita sem confirmação; orçamento sem acompanhamento; negócio ganho sem encaminhar para Vendas.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Users className="text-emerald-700" size={20}/><h2 className="mt-3 text-sm font-black">Metas e comissões</h2><p className="mt-2 text-xs leading-relaxed text-slate-600">Meta por vendedor, cidade e origem, conversão e projeção de fechamento. Comissões só após regras e permissões aprovadas.</p></div></section>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-4 text-xs text-slate-500"><span><ShieldCheck size={15} className="mr-2 inline text-teal-700"/><b>Preview isolado.</b> A base de clientes, CRM atual, Kanban, produção e financeiro permanecem intactos.</span><div className="flex gap-4"><Link href="/prospeccao" className="font-bold text-blue-700 hover:underline">Prospecção existente <ArrowUpRight size={12} className="inline"/></Link><Link href="/crm" className="font-bold text-blue-700 hover:underline">CRM atual <ArrowUpRight size={12} className="inline"/></Link></div></div>
    </main>
    {ativos&&<div className="fixed inset-0 z-[100] flex justify-end bg-[#0b1c35]/50" onClick={()=>setSelecionado(null)}><div className="h-full w-full max-w-[470px] overflow-y-auto bg-white shadow-2xl" onClick={e=>e.stopPropagation()}><div className="bg-[#102747] p-6 text-white"><div className="flex justify-between"><Etiqueta classe="border-white/30 bg-white/10 text-teal-100">Ficha da oportunidade · Demo</Etiqueta><button onClick={()=>setSelecionado(null)} aria-label="Fechar detalhe" className="rounded-lg p-1 hover:bg-white/10"><X size={20}/></button></div><h2 className="mt-5 text-2xl font-black">{ativos.cliente}</h2><p className="mt-1 text-sm text-slate-300">{ativos.obra}</p><p className="mt-5 text-3xl font-black">{brl(ativos.valor)}</p></div><div className="space-y-5 p-6"><div className="flex flex-wrap gap-2"><Etiqueta classe={pillTemperatura(ativos.temperatura)}>{ativos.temperatura}</Etiqueta><Etiqueta classe="border-slate-200 bg-slate-50 text-slate-600">{ativos.origem}</Etiqueta><Etiqueta classe="border-slate-200 bg-slate-50 text-slate-600">{ativos.cidade}</Etiqueta></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs"><div><span className="text-slate-400">Responsável</span><p className="mt-1 font-bold">{ativos.responsavel}</p></div><div><span className="text-slate-400">Último contato</span><p className="mt-1 font-bold">{ativos.ultimoContato}</p></div></div><label className="block text-xs font-bold text-slate-700">Etapa da negociação<select disabled={!podeEditar} value={ativos.etapa} onChange={e=>mover(ativos.id,e.target.value as Etapa)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{[...ETAPAS,{id:'ganho' as Etapa,nome:'Ganho',curto:'Ganho',detalhe:'',cor:''},{id:'perdido' as Etapa,nome:'Perdido',curto:'Perdido',detalhe:'',cor:''}].map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-[10px] font-bold uppercase text-amber-700">Próxima ação</p><p className="mt-2 text-sm font-black text-slate-800">{ativos.proximaAcao}</p><p className="mt-1 text-xs text-amber-800">Prazo: {dataBR(ativos.prazo)} · {situacao(ativos)==='atrasado'?'Atrasada':situacao(ativos)==='hoje'?'Hoje':'Programada'}</p></div><label className="block text-xs font-bold text-slate-700">Reagendar retorno<input disabled={!podeEditar} value={data} type="date" onChange={e=>setData(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="block text-xs font-bold text-slate-700">Histórico e observações<textarea disabled={!podeEditar} rows={5} value={anotacao} onChange={e=>setAnotacao(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label><p className="rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-800"><Sparkles size={14} className="mr-1 inline"/>Na versão final, esta ficha será vinculada ao Cliente 360, WhatsApp, orçamentos e visitas. Nesta prévia, tudo é simulado.</p>{podeEditar&&<button onClick={salvarDetalhe} className="w-full rounded-xl bg-[#112b4b] px-4 py-3.5 text-sm font-bold text-white">Salvar nesta demonstração</button>}</div></div></div>}
    {novo&&<div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0b1c35]/60 p-4" onClick={()=>setNovo(false)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Novo lead · Simulação</p><h2 className="mt-1 text-xl font-black">Nova oportunidade</h2></div><button onClick={()=>setNovo(false)} aria-label="Fechar formulário"><X size={20}/></button></div><p className="mt-2 text-xs text-slate-500">O cadastro abaixo serve somente para testar o CRM. Não cria clientes reais.</p><div className="mt-5 space-y-4">{[{label:'Nome do contato *',valor:nomeNovo,mudar:setNomeNovo,placeholder:'Ex.: Cliente de teste'},{label:'Nome da obra',valor:obraNova,mudar:setObraNova,placeholder:'Ex.: Reforma residencial'},{label:'Valor estimado (R$)',valor:valorNovo,mudar:setValorNovo,placeholder:'Ex.: 12000'}].map(f=><label key={f.label} className="block text-xs font-bold text-slate-700">{f.label}<input value={f.valor} onChange={e=>f.mudar(e.target.value)} placeholder={f.placeholder} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>)}<label className="block text-xs font-bold text-slate-700">Responsável<select value={responsavelNovo} onChange={e=>setResponsavelNovo(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">{responsaveis.map(r=><option key={r}>{r}</option>)}</select></label></div><div className="mt-6 flex gap-2"><button onClick={()=>setNovo(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancelar</button><button disabled={!nomeNovo.trim()} onClick={criar} className="flex-1 rounded-xl bg-[#22b8ab] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Adicionar ao funil</button></div></div></div>}
  </div>
}