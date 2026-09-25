'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { alterarStatusAtendimento, assumirAtendimento, enviarMensagemAtendimento, listarConversasAtendimento, observarAtendimento, type AtendimentoConversa } from '@/lib/atendimento'
import { ArrowLeft, Search, Phone, Mail, MapPin, Paperclip, Image, Mic, Send, ChevronDown } from 'lucide-react'

const conversas=[
 {nome:'Thiago Almeida',hora:'09:24',texto:'Bom dia! Gostaria de saber sobre...',n:2,cor:'bg-blue-100'},
 {nome:'Mariana Costa',hora:'09:20',texto:'Vocês fazem esquadrias para...',n:1,cor:'bg-amber-100'},
 {nome:'Construtora Silva',hora:'09:15',texto:'Pode me enviar o orçamento atua...',n:0,cor:'bg-slate-200'},
 {nome:'Ricardo Mendes',hora:'09:03',texto:'Foto',n:2,cor:'bg-emerald-100'},
 {nome:'Juliana Ferreira',hora:'08:47',texto:'Perfeito, obrigado!',n:0,cor:'bg-violet-100'},
 {nome:'Carlos Eduardo',hora:'08:32',texto:'Qual o prazo de entrega?',n:0,cor:'bg-orange-100'},
]
export default function AtendimentoPage(){
 const [ativa,setAtiva]=useState(0); const [conversasBanco,setConversasBanco]=useState<AtendimentoConversa[]>([])
 useEffect(()=>{ let vivo=true; const carregar=async()=>{try{const dados=await listarConversasAtendimento(); if(vivo)setConversasBanco(dados)}catch{}}; void carregar(); const parar=observarAtendimento(()=>void carregar()); return()=>{vivo=false;parar()} },[])\n const [texto,setTexto]=useState(''); const [nota,setNota]=useState(false); const [status,setStatus]=useState('Em atendimento'); const [salvando,setSalvando]=useState(false)
 const conversaReal=conversasBanco[ativa]||null
 const enviar=async()=>{if(!conversaReal||!texto.trim())return;setSalvando(true);try{await enviarMensagemAtendimento(conversaReal.id,texto,nota);setTexto('')}finally{setSalvando(false)}}
 const mudarStatus=async(valor:string)=>{setStatus(valor);if(!conversaReal)return;const mapa:Record<string,any>={'Em atendimento':'em_atendimento','Aguardando cliente':'aguardando_cliente','Transferido':'transferido','Finalizado':'finalizado'};await alterarStatusAtendimento(conversaReal.id,mapa[valor])}
 const assumir=async()=>{if(!conversaReal)return;setSalvando(true);try{await assumirAtendimento(conversaReal.id);setStatus('Em atendimento')}finally{setSalvando(false)}}
 return <main className="min-h-screen bg-slate-100 p-2 md:p-4">
  <div className="mx-auto max-w-[1600px] overflow-hidden rounded-2xl border bg-white shadow-sm">
   <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
    <div className="flex items-center gap-3"><Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link><div><div className="flex items-center gap-2"><h1 className="text-xl font-bold">Atendimento</h1><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">● WhatsApp</span></div><p className="text-xs text-slate-500">Central de atendimento Atlas {conversasBanco.length>0?`· ${conversasBanco.length} conversa(s) sincronizada(s)`:``}</p></div></div>
    <div className="flex items-center gap-2 text-sm"><span className="hidden text-emerald-600 sm:inline">● Online</span><button className="rounded-xl border px-3 py-2">Todos os números <ChevronDown className="ml-1 inline" size={14}/></button></div>
   </header>
   <div className="flex gap-2 overflow-x-auto border-b p-3 text-xs font-bold">
    {['Todas 12','Aguardando 4','Em atendimento 5','Aguardando cliente 2','Finalizadas'].map((x,i)=><button key={x} className={'whitespace-nowrap rounded-xl px-3 py-2 '+(i===0?'bg-blue-50 text-blue-700 ring-1 ring-blue-300':'bg-slate-100 text-slate-600')}>{x}</button>)}
   </div>
   <div className="grid min-h-[680px] lg:grid-cols-[310px_1fr_350px]">
    <aside className="border-r">
     <div className="p-3"><div className="flex items-center gap-2 rounded-xl border px-3"><Search size={16} className="text-slate-400"/><input className="w-full py-3 text-sm outline-none" placeholder="Buscar conversas..."/></div></div>
     {conversas.map((c,i)=><button key={c.nome} onClick={()=>setAtiva(i)} className={'flex w-full items-center gap-3 border-t px-3 py-4 text-left '+(ativa===i?'bg-blue-50':'hover:bg-slate-50')}>
      <span className={'grid h-11 w-11 shrink-0 place-items-center rounded-full font-bold text-slate-700 '+c.cor}>{c.nome.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>
      <span className="min-w-0 flex-1"><span className="flex justify-between"><b className="truncate text-sm">{c.nome}</b><small className="text-slate-400">{c.hora}</small></span><span className="mt-1 flex justify-between"><small className="truncate text-slate-500">{c.texto}</small>{c.n>0&&<em className="ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] not-italic text-white">{c.n}</em>}</span></span>
     </button>)}
    </aside>
    <section className="flex min-w-0 flex-col bg-[#f6f3ee]">
     <div className="flex items-center justify-between gap-3 border-b bg-white p-4">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 font-bold">TA</span><div><h2 className="font-bold">Thiago Almeida</h2><p className="text-xs text-slate-500">+55 11 98877-6655 · <span className="text-emerald-600">Cliente cadastrado</span></p></div></div>
      <select value={status} onChange={e=>void mudarStatus(e.target.value)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"><option>Em atendimento</option><option>Aguardando cliente</option><option>Transferido</option><option>Finalizado</option></select>{conversaReal?.status==='aguardando'&&<button onClick={()=>void assumir()} disabled={salvando} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Assumir atendimento</button>}
     </div>
     <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-7">
      <div className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">Hoje</div>
      <Bubble>Bom dia!</Bubble><Bubble>Gostaria de saber sobre as esquadrias de alumínio que vocês trabalham.</Bubble><Bubble>Vocês têm linha para alto padrão?</Bubble>
      <Bubble me>Bom dia, Thiago!</Bubble><Bubble me>Temos sim! Trabalhamos com linhas residenciais e de alto padrão.</Bubble><Bubble me>Vou te enviar algumas opções e já te mostro projetos que realizamos.</Bubble><Bubble>Ótimo, fico no aguardo!</Bubble>
     </div>
     <div className="border-t bg-white p-3">
      <div className="mb-2 flex gap-5 text-sm font-bold"><button onClick={()=>setNota(false)} className={!nota?'text-blue-600':''}>Mensagem</button><button onClick={()=>setNota(true)} className={nota?'text-amber-600':''}>Nota interna</button></div>
      <div className={'rounded-xl border p-2 '+(nota?'bg-amber-50':'bg-white')}><textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={2} className="w-full resize-none bg-transparent p-2 text-sm outline-none" placeholder={nota?'Escreva uma nota interna (o cliente não verá)...':'Digite uma mensagem...'}/><div className="flex items-center justify-between"><div className="flex gap-3 text-slate-500"><Paperclip size={19}/><Image size={19}/><Mic size={19}/></div><button onClick={()=>void enviar()} disabled={!texto.trim()||!conversaReal||salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-200">Enviar <Send size={15}/></button></div></div>
     </div>
    </section>
    <aside className="hidden border-l bg-white lg:block">
     <div className="flex border-b text-sm font-bold"><button className="border-b-2 border-blue-600 p-4 text-blue-600">Cliente 360</button><button className="p-4 text-slate-500">Obras</button><button className="p-4 text-slate-500">Orçamentos</button></div>
     <div className="space-y-5 p-4">
      <div className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-full bg-blue-100 text-lg font-bold">TA</span><div><h3 className="font-bold">Thiago Almeida</h3><p className="text-xs text-slate-500">Cliente ativo</p></div></div>
      <div className="space-y-2 text-sm text-slate-600"><p><Phone className="mr-2 inline" size={15}/>+55 11 98877-6655</p><p><Mail className="mr-2 inline" size={15}/>thiago@email.com</p><p><MapPin className="mr-2 inline" size={15}/>São Paulo - SP</p></div>
      <button className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white">Ver Cliente 360 →</button>
      <Card titulo="Resumo"><div className="grid grid-cols-2 gap-3 text-xs"><p>Tipo<br/><b>Pessoa Física</b></p><p>Status<br/><b className="text-emerald-600">Ativo</b></p><p>Origem<br/><b>WhatsApp</b></p><p>Responsável<br/><b>Keila Souza</b></p></div></Card>
      <Card titulo="Orçamentos (3)"><p className="text-sm"><b>#2837</b> · Esquadrias Residenciais</p><p className="mt-2 text-sm"><b>#2715</b> · Linha Alto Padrão</p></Card>
      <Card titulo="Obras (1)"><p className="text-sm"><b>Residência Alphaville</b><br/><span className="text-blue-600">Em andamento</span></p></Card>
      <Card titulo="Tarefas (2)"><p className="text-sm">☐ Enviar catálogo linha premium</p><p className="mt-2 text-sm">☐ Agendar visita técnica</p></Card>
     </div>
    </aside>
   </div>
  </div>
 </main>
}
function Bubble({children,me=false}:{children:React.ReactNode,me?:boolean}){return <div className={'flex '+(me?'justify-end':'justify-start')}><div className={'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm '+(me?'bg-[#d9fdd3]':'bg-white')}>{children}<small className="ml-3 text-[10px] text-slate-400">09:2{me?'6':'4'}</small></div></div>}
function Card({titulo,children}:{titulo:string,children:React.ReactNode}){return <div><h4 className="mb-2 font-bold">{titulo}</h4><div className="rounded-xl border bg-slate-50 p-3">{children}</div></div>}
