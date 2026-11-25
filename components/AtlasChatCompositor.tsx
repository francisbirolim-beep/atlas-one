'use client'
import {useEffect,useRef,useState} from 'react'
import {Camera,Mic,Paperclip,Send,Smile,Square,X} from 'lucide-react'
import {EMOJIS_REACAO} from '@/lib/chatEmojis'
import {mimeAtlasChat,tamanhoAtlasChat,formatoGravacao} from '@/lib/atlasChatMidia'
type Props={texto:string;setTexto:(s:string)=>void;enviando:boolean;enviar:()=>Promise<void>;enviarArquivo:(f:File,ptt:boolean,legenda:string)=>Promise<boolean>;avisar:(s:string)=>void;resposta?:string;limparResposta:()=>void}
export default function AtlasChatCompositor({texto,setTexto,enviando,enviar,enviarArquivo,avisar,resposta,limparResposta}:Props){
 const [emoji,setEmoji]=useState(false),[gravando,setGravando]=useState(false),[pendente,setPendente]=useState<{file:File;ptt:boolean}|null>(null),[preview,setPreview]=useState('')
 const arquivo=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),rec=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),ativo=useRef(true),cancelado=useRef(false)
 useEffect(()=>{ativo.current=true;return()=>{ativo.current=false;cancelado.current=true;if(rec.current?.state==='recording')rec.current.stop();stream.current?.getTracks().forEach(t=>t.stop())}},[])
 useEffect(()=>{if(!pendente){setPreview('');return}const url=URL.createObjectURL(pendente.file);setPreview(url);return()=>URL.revokeObjectURL(url)},[pendente])
 function selecionar(f?:File,ptt=false){if(!f)return;if(!tamanhoAtlasChat(f.size)||!mimeAtlasChat(f.name,f.type)){avisar('Arquivo não suportado ou acima de 50 MB.');return}setPendente({file:f,ptt})}
 async function gravar(){
  if(gravando){rec.current?.stop();return}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){avisar('Gravação indisponível neste navegador.');return}
  let s:MediaStream|null=null
  try{
   s=await navigator.mediaDevices.getUserMedia({audio:true})
   if(!ativo.current){s.getTracks().forEach(t=>t.stop());return}
   stream.current=s;cancelado.current=false
   const tipo=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t))
   const r=tipo?new MediaRecorder(s,{mimeType:tipo}):new MediaRecorder(s);rec.current=r
   const partes:Blob[]=[]
   r.ondataavailable=e=>{if(e.data.size)partes.push(e.data)}
   r.onstop=()=>{s?.getTracks().forEach(t=>t.stop());if(!ativo.current)return;setGravando(false);if(cancelado.current)return;const f=formatoGravacao(r.mimeType||partes[0]?.type||'');if(!f){avisar('Formato de áudio não suportado.');return}selecionar(new File(partes,'audio-'+Date.now()+'.'+f.extensao,{type:f.tipo}),true)}
   r.start(250);setGravando(true)
  }catch{s?.getTracks().forEach(t=>t.stop());avisar('Autorize o microfone para gravar áudio.')}
 }
 async function confirmar(){if(enviando)return;if(pendente){if(await enviarArquivo(pendente.file,pendente.ptt,texto))setPendente(null)}else await enviar()}
 return <div className="bg-white border-t pb-[max(8px,env(safe-area-inset-bottom))]">
 {resposta&&<div className="bg-slate-100 p-2 px-3 flex items-center gap-2 text-xs"><span className="flex-1 truncate">Respondendo: {resposta}</span><button type="button" aria-label="Cancelar resposta" onClick={limparResposta}><X size={16}/></button></div>}
 {pendente&&<div className="p-3 bg-slate-50 flex gap-3 items-center"><div className="min-w-0 flex-1">{preview&&pendente.file.type.startsWith('image/')&&<img src={preview} alt="Prévia do anexo" className="max-h-28 max-w-full rounded"/>}{preview&&pendente.file.type.startsWith('audio/')&&<audio controls src={preview} className="max-w-full"/>}<p className="text-sm truncate">{pendente.file.name}</p><p className="text-xs text-slate-500">Anexo pronto para confirmar</p></div><button type="button" disabled={enviando} aria-label="Remover anexo" onClick={()=>setPendente(null)}><X size={20}/></button></div>}
 {gravando&&<div className="px-3 py-2 text-sm text-red-700 flex items-center justify-between"><span>Gravando áudio…</span><button type="button" onClick={()=>{cancelado.current=true;rec.current?.stop()}}>Cancelar</button></div>}
 <form className="p-2 flex flex-wrap md:flex-nowrap items-center gap-1" onSubmit={e=>{e.preventDefault();void confirmar()}}>
 <input ref={arquivo} type="file" hidden onChange={e=>{selecionar(e.target.files?.[0]);e.target.value=''}}/>
 <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>{selecionar(e.target.files?.[0]);e.target.value=''}}/>
 <div className="relative flex items-center gap-1"><button type="button" className="p-2" aria-label="Emojis" onClick={()=>setEmoji(!emoji)}><Smile size={20}/></button>{emoji&&<div className="absolute bottom-full left-0 z-10 bg-white border shadow-xl rounded-xl p-2 grid grid-cols-6 w-56">{EMOJIS_REACAO.map(e=><button type="button" key={e} className="p-1" onClick={()=>{setTexto((texto+e).slice(0,4096));setEmoji(false)}}>{e}</button>)}</div>}<button type="button" className="p-2" aria-label="Anexar arquivo" disabled={enviando||gravando} onClick={()=>arquivo.current?.click()}><Paperclip size={20}/></button><button type="button" className="p-2" aria-label="Tirar foto" disabled={enviando||gravando} onClick={()=>camera.current?.click()}><Camera size={20}/></button></div>
 <input value={texto} onChange={e=>setTexto(e.target.value)} maxLength={4096} onPaste={e=>{const f=Array.from(e.clipboardData.files)[0];if(f){e.preventDefault();selecionar(f)}}} className="min-w-[100px] flex-1 border rounded-xl p-2.5" placeholder={pendente?'Legenda opcional':'Mensagem'}/>
 <button type="button" className="p-2" disabled={enviando||Boolean(pendente)} aria-label={gravando?'Parar gravação':'Gravar áudio'} onClick={()=>void gravar()}>{gravando?<Square size={20}/>:<Mic size={20}/>}</button>
 <button type="submit" disabled={enviando||gravando||(!pendente&&!texto.trim())} aria-label="Enviar" className="bg-[#182444] text-white rounded-xl p-3 disabled:opacity-40"><Send size={20}/></button>
 </form></div>
}
