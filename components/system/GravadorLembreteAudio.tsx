'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Gravacao = { id: string; transcricao: string | null; transcricaoPendente: boolean }

export async function vincularAudioLembrete(audioId:string,referenciaId:string):Promise<boolean> {
 const token=await tokenAtual()
 if(!token)return false
 const res=await fetch('/api/lembretes/audio',{
  method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({id:audioId,referenciaId}),
 })
 return res.ok
}

export default function GravadorLembreteAudio({
 tipo,onSalvo,onOcupado,gravacaoId,
}:{
 tipo:'tarefa'|'agenda'
 onSalvo:(gravacao:Gravacao)=>void
 onOcupado?:(ocupado:boolean)=>void
 gravacaoId?:string|null
}){
 const [gravando,setGravando]=useState(false)
 const [enviando,setEnviando]=useState(false)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const [audioUrl,setAudioUrl]=useState<string|null>(null)
 const gravador=useRef<MediaRecorder|null>(null)
 const stream=useRef<MediaStream|null>(null)
 const audioUrlRef=useRef<string|null>(null)
 const busy=useRef(false)
 useEffect(()=>()=>{stream.current?.getTracks().forEach(t=>t.stop());if(audioUrlRef.current)URL.revokeObjectURL(audioUrlRef.current)},[])

 async function comecar(){
  setErro('');setMensagem('')
  if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){
   setErro('Este navegador não permite gravar áudio. Use o Chrome ou Safari atualizado.')
   return
  }
  try{
   const captura=await navigator.mediaDevices.getUserMedia({audio:true})
   stream.current=captura
   const preferido=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg']
     .find(v=>MediaRecorder.isTypeSupported(v))
   const recorder=new MediaRecorder(captura,preferido?{mimeType:preferido}:undefined)
   const chunks:Blob[]=[]
   recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)}
   recorder.onstop=()=>{
    captura.getTracks().forEach(t=>t.stop());stream.current=null;setGravando(false)
    if(chunks.length)void enviar(new File(chunks,'gravacao', {type:recorder.mimeType.split(';')[0]||'audio/webm'}))
   }
   recorder.onerror=()=>{setErro('Falha na gravação.');captura.getTracks().forEach(t=>t.stop());setGravando(false)}
   gravador.current=recorder
   recorder.start()
   setGravando(true)
  }catch{setErro('Não foi possível acessar o microfone. Confira a permissão do navegador.')}
 }

 async function enviar(file:File){
  if(busy.current)return
  busy.current=true;setEnviando(true);onOcupado?.(true)
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   if(audioUrlRef.current)URL.revokeObjectURL(audioUrlRef.current)
   const url=URL.createObjectURL(file);audioUrlRef.current=url;setAudioUrl(url)
   const form=new FormData();form.append('audio',file);form.append('tipo',tipo)
   const resp=await fetch('/api/lembretes/audio',{method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const data=await resp.json().catch(()=>({}))
   if(!resp.ok)throw new Error(data.error||'Falha ao salvar áudio.')
   onSalvo({id:String(data.id),transcricao:data.transcricao||null,transcricaoPendente:Boolean(data.transcricaoPendente)})
   setMensagem(data.transcricao?'Áudio salvo e transcrito. Revise o texto antes de criar.':'Áudio salvo. Transcrição indisponível; informe o texto manualmente.')
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao enviar gravação.')}
  finally{busy.current=false;setEnviando(false);onOcupado?.(false)}
 }
 function alternar(){if(gravando)gravador.current?.stop();else void comecar()}
 return <div className="rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex flex-wrap items-center gap-2">
   <button type="button" onClick={alternar} disabled={enviando}
    className={'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold '+(gravando?'bg-red-600 text-white':'bg-blue-50 text-blue-700')}>
    {gravando?<MicOff size={15}/>:<Mic size={15}/>}
    {enviando?'Salvando áudio...':gravando?'Parar e salvar gravação':'Gravar áudio da '+(tipo==='tarefa'?'tarefa':'agenda')}
   </button>
   {audioUrl&&<audio aria-label="Áudio gravado" src={audioUrl} controls className="h-8 max-w-[230px]"/>}
   {gravacaoId&&<span className="text-xs font-semibold text-emerald-700">Áudio registrado</span>}
  </div>
  {mensagem&&<p className="mt-2 text-xs text-emerald-700">{mensagem}</p>}
  {erro&&<p role="alert" className="mt-2 text-xs text-red-600">{erro}</p>}
 </div>
}
