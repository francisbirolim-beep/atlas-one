'use client'

import { useEffect, useState } from 'react'
import { tokenAtual } from '@/lib/auth'

export default function AudioAnexadoLembrete({
 referenciaId, tipo, claro = false,
}: {
 referenciaId:string; tipo:'tarefa'|'agenda'; claro?:boolean
}) {
 const [audio,setAudio]=useState<{url:string;transcricao:string|null}|null>(null)
 useEffect(()=>{
  let ativo=true
  setAudio(null)
  const controller=new AbortController()
  void (async()=>{
   try{
    const token=await tokenAtual()
    if(!token||!ativo)return
    const query=new URLSearchParams({referenciaId,tipo})
    const resp=await fetch('/api/lembretes/audio?'+query.toString(),{
     headers:{Authorization:'Bearer '+token},signal:controller.signal,
    })
    if(!resp.ok)return
    const data=await resp.json()
    if(ativo&&data.audioUrl)setAudio({url:String(data.audioUrl),transcricao:data.transcricao||null})
   }catch{}
  })()
  return()=>{ativo=false;controller.abort()}
 },[referenciaId,tipo])
 if(!audio)return null
 return <div className={'mt-2 rounded-xl border p-2 '+(claro?'border-white/20 bg-white/5':'border-slate-200 bg-slate-50')}>
  <p className={'mb-1 text-xs font-semibold '+(claro?'text-blue-300':'text-slate-700')}>Áudio original</p>
  <audio src={audio.url} controls className="h-8 max-w-full"/>
  {audio.transcricao&&<p className={'mt-2 text-xs '+(claro?'text-slate-300':'text-slate-600')}>
   Transcrição: {audio.transcricao}
  </p>}
 </div>
}
