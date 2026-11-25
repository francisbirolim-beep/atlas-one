'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Camera, ChevronDown, MapPin, Save, Loader2, ExternalLink } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { coordenadasDaObra, linkRotaObra } from '@/lib/enderecoObra'
import { LIMITE_FOTO_CONTRAMARCO, TIPOS_FOTO_CONTRAMARCO, type LocalContramarco, type FotoLocalContramarco } from '@/lib/contramarcoLocal'

async function prepararFoto(file:File):Promise<File>{
  if(!TIPOS_FOTO_CONTRAMARCO[file.type])throw new Error('Selecione uma imagem JPG, PNG, WebP ou HEIC.')
  if(file.size<=LIMITE_FOTO_CONTRAMARCO&&file.size>0)return file
  if(file.size>30*1024*1024)throw new Error('Foto muito grande. Selecione uma imagem menor.')
  const url=URL.createObjectURL(file)
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Não foi possível compactar esta imagem. Use JPG de até 3 MB.'));i.src=url
    })
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight))
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale))
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.')
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height)
    for(const qualidade of [.85,.65,.45]){
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',qualidade))
      if(blob&&blob.size<=LIMITE_FOTO_CONTRAMARCO)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})
    }
    throw new Error('Não foi possível reduzir a foto para 3 MB.')
  }finally{URL.revokeObjectURL(url)}
}

export default function ContramarcoLocalObra({medicaoId,cliente}:{medicaoId:string;cliente:string}){
  const [local,setLocal]=useState<LocalContramarco|null>(null)
  const [fotos,setFotos]=useState<FotoLocalContramarco[]>([])
  const [aberto,setAberto]=useState(true)
  const [ocupado,setOcupado]=useState(false)
  const [gpsOcupado,setGpsOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [sujo,setSujo]=useState(false)
  const galeria=useRef<HTMLInputElement>(null)
  const camera=useRef<HTMLInputElement>(null)
  const endpoint='/api/medicao-final/'+encodeURIComponent(medicaoId)+'/local-contramarco'
  async function requisicao(method:string,body?:BodyInit){
    const token=await tokenAtual();if(!token)throw new Error('Sessão expirada. Entre novamente.')
    const res=await fetch(endpoint,{method,body,headers:{Authorization:'Bearer '+token,...(typeof body==='string'?{'Content-Type':'application/json'}:{})},cache:'no-store'})
    const dados=await res.json().catch(()=>({}))
    if(!res.ok)throw new Error(dados.error||'Não foi possível concluir a operação.')
    return dados
  }
  async function carregar(){
    setOcupado(true);setErro('')
    try{const d=await requisicao('GET');setLocal(d.local);setFotos(d.fotos||[]);setSujo(false);setAberto(!d.local?.updated_at)}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível carregar a obra.')}
    finally{setOcupado(false)}
  }
  useEffect(()=>{void carregar()},[medicaoId])
  useEffect(()=>{
    if(!sujo)return
    const aviso=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
    window.addEventListener('beforeunload',aviso)
    return()=>window.removeEventListener('beforeunload',aviso)
  },[sujo])
  function editar<K extends keyof LocalContramarco>(key:K,value:LocalContramarco[K]){
    setLocal(prev=>prev?{...prev,[key]:value}:prev);setSujo(true);setMensagem('')
  }
  function gps(){
    if(!navigator.geolocation){setErro('GPS não disponível neste aparelho. Informe o endereço.');return}
    setGpsOcupado(true);setErro('')
    navigator.geolocation.getCurrentPosition(pos=>{
      const v=coordenadasDaObra(pos.coords.latitude,pos.coords.longitude)
      if(v)editar('gps',v);else setErro('Não foi possível validar as coordenadas.')
      setGpsOcupado(false)
    },()=>{setGpsOcupado(false);setErro('GPS indisponível ou permissão negada. Você pode digitar o endereço.')},{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }
  async function salvar(){
    if(!local||ocupado)return
    setOcupado(true);setErro('');setMensagem('')
    try{const d=await requisicao('PATCH',JSON.stringify(local));setLocal(d.local);setSujo(false);setMensagem('Identificação salva.')}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
    finally{setOcupado(false)}
  }
  async function anexar(files:FileList|null){
    if(!files?.length||ocupado)return
    setOcupado(true);setErro('');setMensagem('')
    let enviados=0
    const falhas:string[]=[]
    for(const original of Array.from(files).slice(0,12)){
      try{
        const file=await prepararFoto(original);const body=new FormData();body.append('foto',file)
        const d=await requisicao('POST',body);setFotos(prev=>[...prev,d.foto]);enviados++
      }catch(e){falhas.push(original.name+': '+(e instanceof Error?e.message:'Falha no envio.'))}
    }
    if(enviados)setMensagem(enviados+' foto(s) salva(s).')
    if(falhas.length)setErro(falhas.join(' | '))
    if(files.length>12)setErro(prev=>[prev,'Envie as demais fotos em outro lote de até 12.'].filter(Boolean).join(' '))
    setOcupado(false)
    if(camera.current)camera.current.value=''
    if(galeria.current)galeria.current.value=''
  }
  const rota=local&&linkRotaObra({coordenadas:local.gps,endereco:local.endereco,cidade:local.endereco?local.cidade:null})
  const campo='mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 disabled:opacity-60'
  return <section className="mb-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <button type="button" onClick={()=>setAberto(v=>!v)} aria-expanded={aberto} className="flex min-h-12 w-full items-center gap-3 text-left">
      <Building2 size={22} className="shrink-0 text-emerald-700"/>
      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-500">Identificação da obra</span><b className="block break-words text-sm text-slate-900">{local?.nome_obra||'Identificar esta obra'}</b><span className="block break-words text-xs text-slate-600">{cliente}{local?.cidade?' · '+local.cidade:''}{sujo?' · Alterações não salvas':''}</span></span>
      <ChevronDown size={20} className={aberto?'rotate-180 shrink-0':'shrink-0'}/>
    </button>
    {erro&&<p role="alert" className="mt-2 break-words rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
    {mensagem&&<p role="status" className="mt-2 text-sm text-emerald-700">{mensagem}</p>}
    {!local&&<button type="button" disabled={ocupado} onClick={()=>void carregar()} className="mt-2 min-h-11 rounded-lg border px-3 text-sm">{ocupado?'Carregando...':'Tentar carregar novamente'}</button>}
    {aberto&&local&&<div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">Dados desta visita, sem alterar o cadastro do cliente. A cidade inicial é somente uma referência: confirme o local da obra.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        <label className="block text-xs font-bold text-slate-600">Nome ou número da obra<input className={campo} maxLength={150} value={local.nome_obra} onChange={e=>editar('nome_obra',e.target.value)} placeholder="Ex.: Casa 02 / Condomínio"/></label>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block min-w-0 text-xs font-bold text-slate-600">Endereço da obra<input className={campo} maxLength={300} value={local.endereco} onChange={e=>editar('endereco',e.target.value)} placeholder="Rua, número, bairro"/></label>
          <label className="block min-w-0 text-xs font-bold text-slate-600">Cidade<input className={campo} maxLength={120} value={local.cidade} onChange={e=>editar('cidade',e.target.value)}/></label>
        </div>
        <label className="block text-xs font-bold text-slate-600">Observações da obra<textarea className={campo} rows={3} maxLength={4000} value={local.observacoes} onChange={e=>editar('observacoes',e.target.value)} placeholder="Referências, acesso, responsável ou informações da visita"/></label>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <button type="button" disabled={gpsOcupado} onClick={gps} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-emerald-800 disabled:opacity-50"><MapPin size={18}/>{gpsOcupado?'Localizando...':'Capturar GPS da obra'}</button>
          {local.gps&&<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900"><span className="break-all">{local.gps}</span><button type="button" onClick={()=>editar('gps',null)} className="min-h-11 px-2 underline">Limpar GPS</button></div>}
          {rota&&<a href={rota} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-800"><ExternalLink size={15}/>Abrir rota no Google Maps</a>}
        </div>
        <button type="button" onClick={()=>void salvar()} disabled={ocupado||gpsOcupado||!local.nome_obra.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-50">{ocupado?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Salvar identificação</button>
      </fieldset>
      <div className="border-t pt-3">
        <p className="text-sm font-bold text-slate-800">Fotos da obra</p>
        <p className="mt-1 text-xs text-slate-500">Fotos privadas vinculadas à medição. Até 12 por envio.</p>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>void anexar(e.target.files)}/>
        <input ref={galeria} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={e=>void anexar(e.target.files)}/>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={ocupado} onClick={()=>camera.current?.click()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50"><Camera size={18}/>Tirar foto</button>
          <button type="button" disabled={ocupado} onClick={()=>galeria.current?.click()} className="min-h-12 rounded-xl border px-3 text-sm font-bold disabled:opacity-50">Escolher fotos</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fotos.map(f=>f.url?<a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 overflow-hidden rounded-xl border bg-slate-50"><img src={f.url} alt={f.arquivo_nome} loading="lazy" className="h-24 w-full object-cover"/><span className="block truncate p-1 text-xs">Abrir foto</span></a>:<span key={f.id} className="break-words text-xs text-slate-500">{f.arquivo_nome} · recarregue para visualizar</span>)}
        </div>
      </div>
    </div>}
  </section>
}
