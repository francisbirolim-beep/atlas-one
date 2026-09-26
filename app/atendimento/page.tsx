'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { alterarStatusAtendimento, assumirAtendimento, buscarClienteAtendimento, enviarMensagemAtendimento, listarConversasAtendimento, listarMensagensAtendimento, listarUsuariosAtendimento, observarAtendimento, transferirAtendimento, type AtendimentoCliente, type AtendimentoConversa, type AtendimentoMensagem, type AtendimentoUsuario } from '@/lib/atendimento'
import { ArrowLeft, Search, Phone, Mail, MapPin, Send, UserRoundCheck } from 'lucide-react'

const rotuloStatus:Record<string,string>={aguardando:'Aguardando',em_atendimento:'Em atendimento',aguardando_cliente:'Aguardando cliente',transferido:'Transferido',finalizado:'Finalizado'}
const valorStatus:Record<string,any>={'Em atendimento':'em_atendimento','Aguardando cliente':'aguardando_cliente','Transferido':'transferido','Finalizado':'finalizado'}
function hora(v:string|null){if(!v)return '';return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function iniciais(nome:string){return nome.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'WA'}

export default function AtendimentoPage(){
 const [conversas,setConversas]=useState<AtendimentoConversa[]>([])
 const [mensagens,setMensagens]=useState<AtendimentoMensagem[]>([])
 const [clientes,setClientes]=useState<Record<string,AtendimentoCliente|null>>({})
 const [usuarios,setUsuarios]=useState<AtendimentoUsuario[]>([])
 const [ativaId,setAtivaId]=useState<string|null>(null)
 const [texto,setTexto]=useState(''),[nota,setNota]=useState(false),[busca,setBusca]=useState(''),[filtro,setFiltro]=useState('todas'),[salvando,setSalvando]=useState(false)
 const [transferindo,setTransferindo]=useState(false)
 const ativa=conversas.find(c=>c.id===ativaId)||conversas[0]||null
 const cliente=ativa?.cliente_id?clientes[ativa.cliente_id]||null:null

 const carregar=async()=>{try{const dados=await listarConversasAtendimento();setConversas(dados);if(!ativaId&&dados[0])setAtivaId(dados[0].id);const ids=[...new Set(dados.map(x=>x.cliente_id).filter(Boolean))] as string[];const pares=await Promise.all(ids.map(async id=>[id,await buscarClienteAtendimento(id)] as const));setClientes(Object.fromEntries(pares))}catch{}}
 useEffect(()=>{void carregar();void listarUsuariosAtendimento().then(setUsuarios).catch(()=>{});const parar=observarAtendimento(()=>void carregar());return parar},[])
 useEffect(()=>{if(!ativa)return;const ler=()=>listarMensagensAtendimento(ativa.id).then(setMensagens).catch(()=>setMensagens([]));void ler();const parar=observarAtendimento(()=>void ler());return parar},[ativa?.id])

 const filtradas=useMemo(()=>conversas.filter(c=>{
   if(filtro!=='todas'&&c.status!==filtro)return false
   const cl=c.cliente_id?clientes[c.cliente_id]:null
   const q=busca.trim().toLocaleLowerCase('pt-BR')
   return !q||((cl?.nome||'')+' '+c.telefone+' '+(c.responsavel_nome||'')).toLocaleLowerCase('pt-BR').includes(q)
 }),[conversas,clientes,busca,filtro])

 async function enviar(){if(!ativa||!texto.trim())return;setSalvando(true);try{await enviarMensagemAtendimento(ativa.id,texto,nota);setTexto('');setMensagens(await listarMensagensAtendimento(ativa.id))}finally{setSalvando(false)}}
 async function assumir(){if(!ativa)return;setSalvando(true);try{await assumirAtendimento(ativa.id);await carregar()}finally{setSalvando(false)}}
 async function mudarStatus(label:string){if(!ativa)return;await alterarStatusAtendimento(ativa.id,valorStatus[label]);await carregar()}
 async function transferir(id:string){if(!ativa||!id)return;const u=usuarios.find(x=>x.id===id);if(!u)return;setTransferindo(true);try{await transferirAtendimento(ativa.id,u,ativa.setor);await carregar()}finally{setTransferindo(false)}}

 return <main className="min-h-screen bg-slate-100 p-2 md:p-4"><div className="mx-auto max-w-[1600px] overflow-hidden rounded-2xl border bg-white shadow-sm">
  <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
   <div className="flex items-center gap-3"><Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link><div><div className="flex items-center gap-2"><h1 className="text-xl font-bold">Atendimento</h1><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">● WhatsApp</span></div><p className="text-xs text-slate-500">Central de atendimento Atlas · {conversas.length} conversa(s)</p></div></div>
   <span className="text-sm text-emerald-600">● Online</span>
  </header>
  <div className="flex gap-2 overflow-x-auto border-b p-3 text-xs font-bold">
   {[['todas','Todas'],['aguardando','Aguardando'],['em_atendimento','Em atendimento'],['aguardando_cliente','Aguardando cliente'],['finalizado','Finalizadas']].map(([v,l])=><button key={v} onClick={()=>setFiltro(v)} className={'whitespace-nowrap rounded-xl px-3 py-2 '+(filtro===v?'bg-blue-50 text-blue-700 ring-1 ring-blue-300':'bg-slate-100 text-slate-600')}>{l} {v==='todas'?conversas.length:conversas.filter(c=>c.status===v).length}</button>)}
  </div>
  <div className="grid min-h-[680px] lg:grid-cols-[310px_1fr_350px]">
   <aside className="border-r"><div className="p-3"><div className="flex items-center gap-2 rounded-xl border px-3"><Search size={16} className="text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} className="w-full py-3 text-sm outline-none" placeholder="Buscar conversas..."/></div></div>
    {filtradas.length===0&&<p className="p-6 text-center text-sm text-slate-400">Nenhuma conversa neste filtro.</p>}
    {filtradas.map(c=>{const cl=c.cliente_id?clientes[c.cliente_id]:null;const nome=cl?.nome||c.telefone;return <button key={c.id} onClick={()=>setAtivaId(c.id)} className={'flex w-full items-center gap-3 border-t px-3 py-4 text-left '+(ativa?.id===c.id?'bg-blue-50':'hover:bg-slate-50')}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-slate-700">{iniciais(nome)}</span><span className="min-w-0 flex-1"><span className="flex justify-between"><b className="truncate text-sm">{nome}</b><small className="text-slate-400">{hora(c.ultima_mensagem_em)}</small></span><small className="mt-1 block truncate text-slate-500">{rotuloStatus[c.status]}{c.responsavel_nome?' · '+c.responsavel_nome:''}</small></span></button>})}
   </aside>
   <section className="flex min-w-0 flex-col bg-[#f6f3ee]">
    {!ativa?<div className="grid flex-1 place-items-center p-8 text-center text-slate-500"><div><b>Nenhum atendimento recebido ainda.</b><p className="mt-2 text-sm">Quando o canal oficial estiver conectado, as novas conversas aparecerão aqui.</p></div></div>:<>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 font-bold">{iniciais(cliente?.nome||ativa.telefone)}</span><div><h2 className="font-bold">{cliente?.nome||ativa.telefone}</h2><p className="text-xs text-slate-500">{ativa.telefone} · {cliente?<span className="text-emerald-600">Cliente cadastrado</span>:'Não vinculado ao Cliente 360'}</p></div></div><div className="flex flex-wrap gap-2">{ativa.status==='aguardando'&&<button onClick={assumir} disabled={salvando} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Assumir atendimento</button>}<select value={rotuloStatus[ativa.status]||'Em atendimento'} onChange={e=>void mudarStatus(e.target.value)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"><option>Em atendimento</option><option>Aguardando cliente</option><option>Transferido</option><option>Finalizado</option></select></div></div>
    <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-7">{mensagens.length===0&&<p className="text-center text-sm text-slate-400">Sem mensagens ainda.</p>}{mensagens.map(m=><Bubble key={m.id} me={m.direcao==='saida'} interna={m.direcao==='interna'} hora={hora(m.created_at)}>{m.texto||('['+m.tipo+']')}</Bubble>)}</div>
    <div className="border-t bg-white p-3"><div className="mb-2 flex gap-5 text-sm font-bold"><button onClick={()=>setNota(false)} className={!nota?'text-blue-600':''}>Mensagem</button><button onClick={()=>setNota(true)} className={nota?'text-amber-600':''}>Nota interna</button></div><div className={'rounded-xl border p-2 '+(nota?'bg-amber-50':'bg-white')}><textarea value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void enviar()}}} rows={2} className="w-full resize-none bg-transparent p-2 text-sm outline-none" placeholder={nota?'Nota interna — o cliente não verá':'Digite uma mensagem...'}/><div className="flex justify-end"><button onClick={enviar} disabled={!texto.trim()||salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-200">Enviar <Send size={15}/></button></div></div></div></>}
   </section>
   <aside className="hidden border-l bg-white lg:block"><div className="border-b p-4 font-bold text-blue-600">Cliente 360</div><div className="space-y-5 p-4">{ativa?<><div className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-full bg-blue-100 text-lg font-bold">{iniciais(cliente?.nome||ativa.telefone)}</span><div><h3 className="font-bold">{cliente?.nome||'Contato não cadastrado'}</h3><p className="text-xs text-slate-500">{rotuloStatus[ativa.status]}</p></div></div><div className="space-y-2 text-sm text-slate-600"><p><Phone className="mr-2 inline" size={15}/>{cliente?.whatsapp||cliente?.telefone||ativa.telefone}</p>{cliente?.email&&<p><Mail className="mr-2 inline" size={15}/>{cliente.email}</p>}{cliente?.cidade&&<p><MapPin className="mr-2 inline" size={15}/>{cliente.cidade}</p>}</div>{cliente?<Link href={'/clientes/'+cliente.id} className="block w-full rounded-xl bg-blue-600 py-2.5 text-center text-sm font-bold text-white">Ver Cliente 360 →</Link>:<Link href="/clientes/identificar" className="block w-full rounded-xl border border-blue-300 py-2.5 text-center text-sm font-bold text-blue-700">Identificar / cadastrar cliente</Link>}<div className="rounded-xl border bg-slate-50 p-3"><p className="mb-2 text-xs font-bold uppercase text-slate-500">Responsável</p><p className="mb-3 text-sm"><UserRoundCheck className="mr-2 inline" size={16}/>{ativa.responsavel_nome||'Ainda não assumido'}</p><select disabled={transferindo} defaultValue="" onChange={e=>void transferir(e.target.value)} className="w-full rounded-lg border bg-white p-2 text-sm"><option value="" disabled>Transferir para...</option>{usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></div></>:<p className="text-sm text-slate-400">Selecione uma conversa.</p>}</div></aside>
  </div>
 </div></main>
}
function Bubble({children,me=false,interna=false,hora}:{children:React.ReactNode,me?:boolean,interna?:boolean,hora:string}){return <div className={'flex '+(me?'justify-end':'justify-start')}><div className={'max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm '+(interna?'border border-amber-300 bg-amber-50':me?'bg-[#d9fdd3]':'bg-white')}>{interna&&<div className="mb-1 text-[10px] font-bold uppercase text-amber-700">Nota interna</div>}{children}<small className="ml-3 text-[10px] text-slate-400">{hora}</small></div></div>}
