'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowLeft, Building2, CalendarDays, FileText, GitBranch, Mail,
  MapPin, MessageCircle, Phone, Plus, Receipt, Save, ShoppingCart, Upload,
  Wallet, Wrench, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/tipos'
import {
  adicionarDocumentoCliente,
  alocarRecebimentoEmObra,
  criarObraCliente,
  listarAlocacoesCliente,
  listarContasReceberCliente,
  listarDocumentosCliente,
  listarObrasCliente,
  listarRecebimentosCliente,
  registrarRecebimentoCliente,
  type AlocacaoRecebimento360,
  type ContaReceberCliente360,
  type DocumentoCliente360,
  type NovaObraCliente360,
  type ObraCliente360,
  type RecebimentoCliente360,
} from '@/lib/cliente360'

interface Props { clienteId: string }
type Aba = 'visao'|'orcamentos'|'obras'|'financeiro'|'medicoes'|'assistencias'|'compras'|'documentos'|'historico'|'observacoes'

type Orcamento = { id:string; numero?:number|null; created_at:string; valor_estimado?:number|null; status?:string|null; obra_id?:string|null; revisao_versao?:number|null; revisao_atual?:boolean|null; revisao_tipo?:string|null; revisao_motivo?:string|null }
type Assistencia = { id:string; numero?:string|null; created_at:string; descricao_problema?:string|null; status?:string|null; obra_id?:string|null }
type Medicao = { id:string; created_at:string; status_operacional?:string|null; obra_id?:string|null; orcamento_id?:string|null }
type Compra = { id:string; created_at:string; descricao?:string|null; categoria?:string|null; quantidade?:number|null; unidade?:string|null; status?:string|null; prioridade?:string|null; obra_id?:string|null; obra_nome?:string|null }
type Interacao = { id:string; created_at:string; tipo:string; descricao?:string|null; usuario_nome?:string|null }

type Evento = { id:string; data:string; titulo:string; detalhe?:string }

function moeda(v?:number|null){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function dataBR(v?:string|null){ if(!v)return '—'; const d=new Date(v.length===10?`${v}T12:00:00`:v); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR') }
function status(v?:string|null){ return v ? v.replace(/_/g,' ').replace(/^./,s=>s.toUpperCase()) : '—' }
function saldo(c:ContaReceberCliente360){ return Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)) }

function Kpi({titulo,valor,detalhe,destaque}:{titulo:string;valor:string;detalhe?:string;destaque?:boolean}){
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p><p className={`mt-1 text-xl font-bold ${destaque?'text-brand-teal':'text-slate-900'}`}>{valor}</p>{detalhe&&<p className="mt-1 text-xs text-slate-500">{detalhe}</p>}</div>
}
function Box({titulo,acao,children}:{titulo:string;acao?:React.ReactNode;children:React.ReactNode}){
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">{titulo}</h2>{acao}</div><div className="p-5">{children}</div></section>
}

export default function Cliente360DashboardV2({clienteId}:Props){
  const [cliente,setCliente]=useState<Cliente|null>(null)
  const [obras,setObras]=useState<ObraCliente360[]>([])
  const [orcamentos,setOrcamentos]=useState<Orcamento[]>([])
  const [assistencias,setAssistencias]=useState<Assistencia[]>([])
  const [medicoes,setMedicoes]=useState<Medicao[]>([])
  const [compras,setCompras]=useState<Compra[]>([])
  const [interacoes,setInteracoes]=useState<Interacao[]>([])
  const [contas,setContas]=useState<ContaReceberCliente360[]>([])
  const [recebimentos,setRecebimentos]=useState<RecebimentoCliente360[]>([])
  const [alocacoes,setAlocacoes]=useState<AlocacaoRecebimento360[]>([])
  const [documentos,setDocumentos]=useState<DocumentoCliente360[]>([])
  const [aba,setAba]=useState<Aba>('visao')
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [menu,setMenu]=useState(false)
  const [modalRecebimento,setModalRecebimento]=useState(false)
  const [modalObra,setModalObra]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [obs,setObs]=useState('')
  const [recebimentoForm,setRecebimentoForm]=useState({valor:'',forma:'pix',data:new Date().toISOString().slice(0,10),obraId:'',referencia:'',observacoes:''})
  const [obraForm,setObraForm]=useState<NovaObraCliente360>({nome:'',status:'planejamento'})
  const [documentoForm,setDocumentoForm]=useState({titulo:'',obraId:'',observacoes:''})
  const [arquivo,setArquivo]=useState<File|null>(null)

  useEffect(()=>{void carregar()},[clienteId])
  async function carregar(){
    setCarregando(true);setErro('')
    const [c,os,orc,ass,med,comp,int,cr,rec,docs]=await Promise.all([
      supabase.from('clientes').select('*').eq('id',clienteId).maybeSingle(),
      listarObrasCliente(clienteId),
      supabase.from('orcamentos').select('id,numero,created_at,valor_estimado,status,obra_id,revisao_versao,revisao_atual,revisao_tipo,revisao_motivo').eq('cliente_id',clienteId).or('modo_entrada.is.null,modo_entrada.neq.balcao').order('created_at',{ascending:false}),
      supabase.from('assistencias').select('id,numero,created_at,descricao_problema,status,obra_id').eq('cliente_id',clienteId).order('created_at',{ascending:false}),
      supabase.from('medicoes_finais').select('id,created_at,status_operacional,obra_id,orcamento_id').eq('cliente_id',clienteId).order('created_at',{ascending:false}),
      supabase.from('compras_necessidades').select('id,created_at,descricao,categoria,quantidade,unidade,status,prioridade,obra_id,obra_nome').eq('cliente_id',clienteId).order('created_at',{ascending:false}),
      supabase.from('crm_interacoes').select('id,created_at,tipo,descricao,usuario_nome').eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(100),
      listarContasReceberCliente(clienteId),listarRecebimentosCliente(clienteId),listarDocumentosCliente(clienteId),
    ])
    if(c.error||!c.data){setErro('Cliente não encontrado.');setCarregando(false);return}
    const r=rec||[]; const alo=await listarAlocacoesCliente(r.map(x=>x.id))
    setCliente(c.data as Cliente);setObs(c.data.observacoes||'');setObras(os);setOrcamentos((orc.data||[]) as Orcamento[]);setAssistencias((ass.data||[]) as Assistencia[]);setMedicoes((med.data||[]) as Medicao[]);setCompras((comp.data||[]) as Compra[]);setInteracoes((int.data||[]) as Interacao[]);setContas(cr);setRecebimentos(r);setAlocacoes(alo);setDocumentos(docs);setCarregando(false)
  }

  const obraPorId=useMemo(()=>Object.fromEntries(obras.map(o=>[o.id,o])),[obras])
  const versoesAtuais=orcamentos.filter(o=>o.revisao_atual!==false)
  const totalVendido=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor||0),0)
  const totalRecebido=recebimentos.filter(r=>r.status!=='cancelado').reduce((s,r)=>s+Number(r.valor||0),0)
  const aReceber=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+saldo(c),0)
  const hoje=new Date().toISOString().slice(0,10)
  const vencido=contas.filter(c=>c.status!=='cancelado'&&c.status!=='pago'&&c.vencimento&&c.vencimento<hoje).reduce((s,c)=>s+saldo(c),0)
  const pct=totalVendido>0?Math.min(100,(totalRecebido/totalVendido)*100):0
  const obrasAtivas=obras.filter(o=>!['concluida','pausada'].includes(o.status)).length
  const assistAbertas=assistencias.filter(a=>!['concluido','concluida','resolvido'].includes(a.status||'')).length
  const eventos=useMemo<Evento[]>(()=>[
    ...orcamentos.map(o=>({id:`o-${o.id}`,data:o.created_at,titulo:`Orçamento #${o.numero||'—'} · V${o.revisao_versao||1}`,detalhe:o.revisao_motivo||status(o.status)})),
    ...obras.map(o=>({id:`ob-${o.id}`,data:o.created_at,titulo:`Obra criada: ${o.nome}`,detalhe:status(o.status)})),
    ...assistencias.map(a=>({id:`a-${a.id}`,data:a.created_at,titulo:`Assistência ${a.numero?`#${a.numero}`:''}`,detalhe:a.descricao_problema||status(a.status)})),
    ...recebimentos.map(r=>({id:`r-${r.id}`,data:r.created_at,titulo:`Recebimento ${moeda(r.valor)}`,detalhe:r.forma||''})),
    ...interacoes.map(i=>({id:`i-${i.id}`,data:i.created_at,titulo:status(i.tipo),detalhe:i.descricao||i.usuario_nome||''})),
  ].sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime()).slice(0,60),[orcamentos,obras,assistencias,recebimentos,interacoes])

  async function salvarObs(){ if(!cliente)return;setSalvando(true);const {error}=await supabase.from('clientes').update({observacoes:obs.trim()||null,updated_at:new Date().toISOString()}).eq('id',cliente.id);setSalvando(false);if(error)setErro(error.message);else await carregar() }
  async function salvarRecebimento(){ if(!cliente)return;const valor=Number(recebimentoForm.valor.replace(',','.'));setSalvando(true);const r=await registrarRecebimentoCliente({clienteId:cliente.id,clienteNome:cliente.nome,valor,dataRecebimento:recebimentoForm.data,forma:recebimentoForm.forma,referencia:recebimentoForm.referencia,observacoes:recebimentoForm.observacoes,obraId:recebimentoForm.obraId||null});setSalvando(false);if(!r.ok){setErro(r.error||'Erro ao registrar recebimento.');return}setModalRecebimento(false);setRecebimentoForm({valor:'',forma:'pix',data:new Date().toISOString().slice(0,10),obraId:'',referencia:'',observacoes:''});await carregar() }
  async function salvarObra(){ if(!cliente)return;setSalvando(true);const r=await criarObraCliente(cliente.id,obraForm);setSalvando(false);if(!r.ok){setErro(r.error||'Erro ao criar obra.');return}setModalObra(false);setObraForm({nome:'',status:'planejamento'});await carregar() }
  async function salvarDocumento(){ if(!cliente||!arquivo)return;setSalvando(true);const r=await adicionarDocumentoCliente({clienteId:cliente.id,obraId:documentoForm.obraId||null,titulo:documentoForm.titulo,arquivo,observacoes:documentoForm.observacoes});setSalvando(false);if(!r.ok){setErro(r.error||'Erro ao anexar documento.');return}setDocumentoForm({titulo:'',obraId:'',observacoes:''});setArquivo(null);await carregar() }

  if(carregando)return <div className="min-h-screen bg-slate-50 p-8 text-slate-400">Carregando Cliente 360...</div>
  if(!cliente)return <div className="min-h-screen bg-slate-50 p-8 text-red-500">{erro||'Cliente não encontrado.'}</div>

  const abas:{id:Aba;label:string}[]=[{id:'visao',label:'Visão geral'},{id:'orcamentos',label:'Orçamentos'},{id:'obras',label:'Obras'},{id:'financeiro',label:'Financeiro'},{id:'medicoes',label:'Medições'},{id:'assistencias',label:'Assistências'},{id:'compras',label:'Compras'},{id:'documentos',label:'Documentos'},{id:'historico',label:'Histórico'},{id:'observacoes',label:'Observações'}]

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3"><Link href="/clientes" className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">{cliente.nome}</h1><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Cliente ativo</span></div><p className="mt-1 text-xs text-slate-400">Cliente desde {dataBR(cliente.created_at)}{cliente.cidade?` · ${cliente.cidade}`:''}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">{(cliente.whatsapp||cliente.telefone)&&<span className="inline-flex items-center gap-1"><Phone size={13}/>{cliente.whatsapp||cliente.telefone}</span>}{cliente.email&&<span className="inline-flex items-center gap-1"><Mail size={13}/>{cliente.email}</span>}{cliente.endereco&&<span className="inline-flex items-center gap-1"><MapPin size={13}/>{cliente.endereco}</span>}</div></div></div>
        <div className="relative flex flex-wrap gap-2"><Link href={`/clientes/${cliente.id}/orcamentos-revisoes`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700"><GitBranch size={15}/> V1/V2/V3</Link><a href={cliente.whatsapp?`https://wa.me/55${cliente.whatsapp.replace(/\D/g,'')}`:'#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-emerald-700"><MessageCircle size={15}/> WhatsApp</a><button onClick={()=>setMenu(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white"><Plus size={15}/> Nova ação</button>{menu&&<div className="absolute right-0 top-12 z-30 w-64 rounded-xl border bg-white p-2 shadow-xl"><button onClick={()=>{setModalObra(true);setMenu(false)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Building2 size={15}/>Nova obra</button><Link href={`/orcamento-rapido?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><FileText size={15}/>Orçamento sob medida</Link><Link href={`/balcao/orcamentos/novo?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Receipt size={15}/>Balcão</Link><Link href={`/assistencia?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Wrench size={15}/>Assistência</Link><button onClick={()=>{setModalRecebimento(true);setMenu(false)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Wallet size={15}/>Registrar recebimento</button></div>}</div>
      </div>
    </div></header>

    <main className="mx-auto max-w-7xl px-4 py-5">{erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><Kpi titulo="Total vendido" valor={moeda(totalVendido)}/><Kpi titulo="Total recebido" valor={moeda(totalRecebido)} detalhe={`${pct.toFixed(0)}% recebido`}/><Kpi titulo="A receber" valor={moeda(aReceber)} destaque/><Kpi titulo="Vencido" valor={moeda(vencido)}/><Kpi titulo="Orçamentos" valor={String(versoesAtuais.length)} detalhe={`${orcamentos.length} versão(ões)`}/><Kpi titulo="Obras" valor={String(obras.length)} detalhe={`${obrasAtivas} em andamento`}/><Kpi titulo="Assistências" valor={String(assistencias.length)} detalhe={`${assistAbertas} aberta(s)`}/></div>

      <div className="mt-5 overflow-x-auto border-b"><div className="flex min-w-max">{abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${aba===a.id?'border-brand-navy text-brand-navy':'border-transparent text-slate-500'}`}>{a.label}</button>)}</div></div>

      <div className="mt-5 space-y-5">
        {aba==='visao'&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Link href={`/orcamento-rapido?cliente=${cliente.id}`} className="rounded-2xl border bg-white p-4 font-bold text-slate-800 shadow-sm"><FileText className="mb-2 text-blue-600"/>Pedido de orçamento</Link><Link href={`/orcamento-rapido?cliente=${cliente.id}`} className="rounded-2xl border bg-white p-4 font-bold text-slate-800 shadow-sm"><Building2 className="mb-2 text-indigo-600"/>Orçamento sob medida</Link><Link href={`/balcao/orcamentos/novo?cliente=${cliente.id}`} className="rounded-2xl border bg-white p-4 font-bold text-slate-800 shadow-sm"><ShoppingCart className="mb-2 text-amber-600"/>Balcão</Link><Link href={`/assistencia?cliente=${cliente.id}`} className="rounded-2xl border bg-white p-4 font-bold text-slate-800 shadow-sm"><Wrench className="mb-2 text-rose-600"/>Assistência</Link><button onClick={()=>setAba('compras')} className="rounded-2xl border bg-white p-4 text-left font-bold text-slate-800 shadow-sm"><Receipt className="mb-2 text-emerald-600"/>Pedido de compra</button></div>
          <div className="grid gap-5 xl:grid-cols-2"><Box titulo="Financeiro do cliente" acao={<button onClick={()=>setModalRecebimento(true)} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white">Registrar recebimento</button>}><div className="mb-3 flex justify-between text-sm"><span>Recebido {moeda(totalRecebido)}</span><span>A receber {moeda(aReceber)}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{width:`${pct}%`}}/></div><button onClick={()=>setAba('financeiro')} className="mt-4 text-sm font-bold text-brand-navy">Ver parcelas</button></Box><Box titulo="Últimos orçamentos"><div className="space-y-2">{versoesAtuais.slice(0,5).map(o=><div key={o.id} className="flex justify-between rounded-xl border p-3"><div><b>#{o.numero||'—'} · V{o.revisao_versao||1}</b><p className="text-xs text-slate-500">{dataBR(o.created_at)} · {status(o.status)}</p></div><b>{moeda(o.valor_estimado)}</b></div>)}{!versoesAtuais.length&&<p className="text-sm text-slate-400">Nenhum orçamento.</p>}</div></Box></div></>}

        {aba==='orcamentos'&&<Box titulo="Orçamentos e versões" acao={<Link href={`/clientes/${cliente.id}/orcamentos-revisoes`} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white">Gerenciar V1/V2/V3</Link>}><div className="space-y-2">{orcamentos.map(o=><div key={o.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${o.revisao_atual===false?'bg-slate-50 opacity-70':'bg-white'}`}><div><p className="font-bold">Orçamento #{o.numero||'—'} · V{o.revisao_versao||1}{o.revisao_atual!==false&&<span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">ATUAL</span>}</p><p className="text-xs text-slate-500">{dataBR(o.created_at)} · {o.revisao_tipo?status(o.revisao_tipo):'Original'}{o.revisao_motivo?` · ${o.revisao_motivo}`:''}</p></div><b>{moeda(o.valor_estimado)}</b></div>)}</div></Box>}

        {aba==='obras'&&<Box titulo="Obras do cliente" acao={<button onClick={()=>setModalObra(true)} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white">Nova obra</button>}><div className="grid gap-3 md:grid-cols-2">{obras.map(o=><div key={o.id} className="rounded-xl border p-4"><div className="flex justify-between"><b>{o.nome}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{status(o.status)}</span></div><p className="mt-2 text-xs text-slate-500">Obra #{o.numero}{o.cidade?` · ${o.cidade}`:''} · previsão {dataBR(o.previsao_entrega)}</p></div>)}</div></Box>}

        {aba==='financeiro'&&<div className="space-y-5"><Box titulo="Contas a receber / parcelas" acao={<button onClick={()=>setModalRecebimento(true)} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white">Registrar recebimento</button>}><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-400"><th className="pb-2">Documento</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{contas.map(c=><tr key={c.id} className="border-b"><td className="py-3">{c.documento||`Parcela ${c.parcela}/${c.total_parcelas}`}</td><td>{dataBR(c.vencimento)}</td><td>{moeda(c.valor)}</td><td>{moeda(c.valor_pago)}</td><td className="font-bold">{moeda(saldo(c))}</td><td>{status(c.status)}</td></tr>)}</tbody></table></div></Box><Box titulo="Recebimentos"><div className="space-y-2">{recebimentos.map(r=><div key={r.id} className="rounded-xl border p-3"><b>{moeda(r.valor)} · {r.forma||'—'}</b><p className="text-xs text-slate-500">{dataBR(r.data_recebimento)}{r.referencia?` · ${r.referencia}`:''}</p></div>)}</div></Box></div>}

        {aba==='medicoes'&&<Box titulo="Medições finais"><div className="space-y-2">{medicoes.map(m=><div key={m.id} className="flex justify-between rounded-xl border p-3"><div><b>Medição {dataBR(m.created_at)}</b><p className="text-xs text-slate-500">{m.obra_id&&obraPorId[m.obra_id]?obraPorId[m.obra_id].nome:'Sem obra vinculada'}</p></div><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs text-cyan-700">{status(m.status_operacional)}</span></div>)}{!medicoes.length&&<p className="text-sm text-slate-400">Nenhuma medição final.</p>}</div></Box>}

        {aba==='assistencias'&&<Box titulo="Assistências" acao={<Link href={`/assistencia?cliente=${cliente.id}`} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white">Nova assistência</Link>}><div className="space-y-2">{assistencias.map(a=><div key={a.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><b>{a.numero?`#${a.numero} · `:''}{a.descricao_problema||'Assistência'}</b><span className="text-xs">{status(a.status)}</span></div><p className="mt-1 text-xs text-slate-500">{dataBR(a.created_at)}</p></div>)}</div></Box>}

        {aba==='compras'&&<Box titulo="Compras do cliente"><div className="space-y-2">{compras.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-3"><div><b>{c.descricao||c.categoria||'Necessidade de compra'}</b><p className="text-xs text-slate-500">{c.obra_nome||'Sem obra'} · {c.quantidade||0} {c.unidade||''} · prioridade {c.prioridade||'normal'}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{status(c.status)}</span></div>)}{!compras.length&&<p className="text-sm text-slate-400">Nenhuma necessidade de compra vinculada a este cliente.</p>}</div></Box>}

        {aba==='documentos'&&<div className="grid gap-5 xl:grid-cols-[340px_1fr]"><Box titulo="Adicionar documento"><div className="space-y-3"><input value={documentoForm.titulo} onChange={e=>setDocumentoForm(f=>({...f,titulo:e.target.value}))} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Título"/><select value={documentoForm.obraId} onChange={e=>setDocumentoForm(f=>({...f,obraId:e.target.value}))} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Cliente geral</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-slate-500"><Upload size={15}/>{arquivo?.name||'Escolher arquivo'}<input type="file" className="hidden" onChange={e=>setArquivo(e.target.files?.[0]||null)}/></label><textarea value={documentoForm.observacoes} onChange={e=>setDocumentoForm(f=>({...f,observacoes:e.target.value}))} className="w-full rounded-lg border p-3 text-sm" rows={3}/><button disabled={!arquivo||!documentoForm.titulo.trim()||salvando} onClick={salvarDocumento} className="w-full rounded-lg bg-brand-navy py-2 text-sm font-bold text-white disabled:opacity-40">Salvar</button></div></Box><Box titulo="Documentos"><div className="space-y-2">{documentos.map(d=><a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block rounded-xl border p-3"><b>{d.titulo}</b><p className="text-xs text-slate-500">{d.nome_arquivo||'Arquivo'} · {dataBR(d.created_at)}</p></a>)}</div></Box></div>}

        {aba==='historico'&&<Box titulo="Últimas movimentações"><div className="space-y-4">{eventos.map((e,i)=><div key={e.id} className="flex gap-3"><div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-brand-navy"/><div><b className="text-sm">{e.titulo}</b><p className="text-xs text-slate-500">{new Date(e.data).toLocaleString('pt-BR')}{e.detalhe?` · ${e.detalhe}`:''}</p></div></div>)}</div></Box>}

        {aba==='observacoes'&&<Box titulo="Observações do cliente"><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={8} className="w-full rounded-xl border p-3 text-sm" placeholder="Preferências, restrições, informações importantes, observações de relacionamento..."/><div className="mt-3 flex justify-end"><button disabled={salvando} onClick={salvarObs} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white"><Save size={15}/>Salvar observações</button></div></Box>}
      </div>
    </main>

    {modalRecebimento&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex justify-between"><div><h2 className="font-bold">Registrar recebimento</h2><p className="text-xs text-slate-500">Pode ser parcial ou total. Se escolher uma obra, o Atlas aplica nas parcelas abertas.</p></div><button onClick={()=>setModalRecebimento(false)}><X size={18}/></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Valor<input value={recebimentoForm.valor} onChange={e=>setRecebimentoForm(f=>({...f,valor:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0,00"/></label><label className="text-sm">Data<input type="date" value={recebimentoForm.data} onChange={e=>setRecebimentoForm(f=>({...f,data:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm">Forma<select value={recebimentoForm.forma} onChange={e=>setRecebimentoForm(f=>({...f,forma:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option></select></label><label className="text-sm">Obra<select value={recebimentoForm.obraId} onChange={e=>setRecebimentoForm(f=>({...f,obraId:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Crédito geral do cliente</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label></div><input value={recebimentoForm.referencia} onChange={e=>setRecebimentoForm(f=>({...f,referencia:e.target.value}))} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Referência / comprovante"/><textarea value={recebimentoForm.observacoes} onChange={e=>setRecebimentoForm(f=>({...f,observacoes:e.target.value}))} className="mt-3 w-full rounded-lg border p-3 text-sm" rows={3} placeholder="Observações"/><div className="mt-4 flex justify-end gap-2"><button onClick={()=>setModalRecebimento(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} onClick={salvarRecebimento} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">Registrar</button></div></div></div>}

    {modalObra&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">Nova obra</h2><button onClick={()=>setModalObra(false)}><X size={18}/></button></div><input value={obraForm.nome} onChange={e=>setObraForm(f=>({...f,nome:e.target.value}))} className="mt-4 w-full rounded-lg border px-3 py-2" placeholder="Nome da obra"/><textarea value={obraForm.observacoes||''} onChange={e=>setObraForm(f=>({...f,observacoes:e.target.value}))} className="mt-3 w-full rounded-lg border p-3 text-sm" rows={3} placeholder="Observações"/><div className="mt-4 flex justify-end gap-2"><button onClick={()=>setModalObra(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} onClick={salvarObra} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">Criar obra</button></div></div></div>}
  </div>
}
