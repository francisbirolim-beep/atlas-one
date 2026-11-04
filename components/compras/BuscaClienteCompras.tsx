'use client'
import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {tokenAtual} from '@/lib/auth'

export type ClienteEncontrado={
 id:string;nome:string;apelido?:string|null;telefoneFinal?:string|null;documentoFinal?:string|null
}
type Props={
 value:string;selecionado?:{id:string;nome:string}|null;onChange:(cliente:ClienteEncontrado|null)=>void;
 label?:string;placeholder?:string;disabled?:boolean
}
/** Busca no servidor: nenhum cliente precisa estar previamente carregado na página. */
export default function BuscaClienteCompras({
 value,selecionado,onChange,label='Cliente *',placeholder='Digite nome, apelido, telefone ou CPF',disabled=false
}:Props){
 const id=useId()
 const [termo,setTermo]=useState(''),[opcoes,setOpcoes]=useState<ClienteEncontrado[]>([])
 const [aberto,setAberto]=useState(false),[buscando,setBuscando]=useState(false),[erro,setErro]=useState('')
 const [ativo,setAtivo]=useState(-1)
 const ref=useRef<HTMLDivElement>(null)
 const texto=termo.trim()
 const numeros=texto.replace(/\D/g,'')
 const precisaBuscar=texto.length>=2&&(numeros.length>=3||/[^\d\s.+()-]/.test(texto))
 useEffect(()=>{
  if(value||!precisaBuscar){setOpcoes([]);setBuscando(false);return}
  const abort=new AbortController()
  const atraso=setTimeout(async()=>{
   try{
    setBuscando(true);setErro('')
    const token=await tokenAtual()
    if(!token)throw Error('Sessão expirada. Entre novamente.')
    const res=await fetch('/api/compras/clientes-busca?busca='+encodeURIComponent(termo.trim()),{
     headers:{Authorization:'Bearer '+token},signal:abort.signal,cache:'no-store'
    })
    const j=await res.json()
    if(!res.ok)throw Error(j.error||'Falha na pesquisa de clientes.')
    if(!abort.signal.aborted){setOpcoes(j.clientes||[]);setAtivo(-1)}
   }catch(e){
    if(!abort.signal.aborted){setOpcoes([]);setErro(e instanceof Error?e.message:'Falha na pesquisa')}
   }finally{if(!abort.signal.aborted)setBuscando(false)}
  },300)
  return ()=>{clearTimeout(atraso);abort.abort()}
 },[termo,value,precisaBuscar])
 useEffect(()=>{
  const fechar=(event:PointerEvent)=>{
   if(!ref.current?.contains(event.target as Node))setAberto(false)
  }
  document.addEventListener('pointerdown',fechar)
  return ()=>document.removeEventListener('pointerdown',fechar)
 },[])
 const escolher=useCallback((cliente:ClienteEncontrado)=>{
  onChange(cliente);setTermo('');setOpcoes([]);setAberto(false);setErro('');setAtivo(-1)
 },[onChange])
 return <div ref={ref} className="relative w-full min-w-0 text-xs">
  <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
  {value?<div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2">
   <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{selecionado?.nome||'Cliente selecionado'}</span>
   <button type="button" disabled={disabled} onClick={()=>onChange(null)} className="shrink-0 font-semibold text-blue-700 underline disabled:opacity-40">Trocar</button>
  </div>:<>
   <input id={id} value={termo} type="search" autoComplete="off" disabled={disabled}
    placeholder={placeholder} role="combobox" aria-autocomplete="list" aria-haspopup="listbox"
    aria-expanded={aberto&&precisaBuscar} aria-controls={id+'-resultados'}
    aria-activedescendant={ativo>=0?id+'-opcao-'+ativo:undefined}
    onFocus={()=>setAberto(true)}
    onChange={e=>{setTermo(e.target.value);setOpcoes([]);setErro('');setAberto(true);setAtivo(-1);
     setBuscando(e.target.value.trim().length>=2)}}
    onKeyDown={e=>{
     if(e.key==='Escape'){setAberto(false);setAtivo(-1)}
     if(!aberto||!opcoes.length)return
     if(e.key==='ArrowDown'){e.preventDefault();setAtivo(x=>Math.min(x+1,opcoes.length-1))}
     if(e.key==='ArrowUp'){e.preventDefault();setAtivo(x=>Math.max(x-1,0))}
     if(e.key==='Enter'&&ativo>=0){e.preventDefault();escolher(opcoes[ativo])}
    }}
    className="w-full rounded-lg border bg-white p-2.5 text-sm outline-blue-600"/>
   {aberto&&precisaBuscar&&<div className="absolute z-50 mt-1 w-full min-w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
    <div role="listbox" id={id+'-resultados'} aria-label="Clientes encontrados" className="max-h-64 overflow-y-auto">
     {opcoes.map((cliente,index)=><button key={cliente.id} type="button"
      id={id+'-opcao-'+index} role="option" aria-selected={index===ativo}
      onMouseDown={e=>e.preventDefault()} onClick={()=>escolher(cliente)}
      className={'block w-full border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-blue-50 '+(index===ativo?'bg-blue-50':'')}>
      <strong className="block text-sm">{cliente.nome}</strong>
      <span className="text-[11px] text-slate-600">{[
       cliente.apelido&&'Apelido: '+cliente.apelido,
       cliente.telefoneFinal&&'Telefone: '+cliente.telefoneFinal,
       cliente.documentoFinal&&'Documento: '+cliente.documentoFinal
      ].filter(Boolean).join(' · ')}</span>
     </button>)}
     {buscando&&<p role="status" className="p-3 text-slate-500">Buscando clientes...</p>}
     {!buscando&&!opcoes.length&&!erro&&<p className="p-3 text-slate-500">Nenhum cliente encontrado. Digite outro termo.</p>}
     {erro&&<p role="alert" className="p-3 text-red-700">{erro}</p>}
    </div>
   </div>}
   {!precisaBuscar&&termo&&<p className="mt-1 text-slate-500">Digite 2 letras ou 3 números para pesquisar.</p>}
  </>}
 </div>
}
