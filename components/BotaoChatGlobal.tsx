'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { rotaReciboAutenticado } from '@/lib/reciboImpressaoRota'

export default function BotaoChatGlobal() {
  const pathname = usePathname()
  const [pendentes,setPendentes]=useState(0)

  const oculto = pathname.startsWith('/whatsapp') || rotaReciboAutenticado(pathname)

  useEffect(()=>{
    if(oculto) return
    let ativo=true
    let canal: ReturnType<typeof supabase.channel> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let intervalo: ReturnType<typeof setInterval> | undefined
    let controller: AbortController | undefined
    let emCurso=false
    let pendente=false

    const agendar=()=>{
      if(!ativo || document.hidden)return
      if(timer)clearTimeout(timer)
      timer=setTimeout(()=>{timer=undefined;void atualizar()},750)
    }

    const atualizar=async()=>{
      if(!ativo || document.hidden)return
      if(emCurso){pendente=true;return}
      emCurso=true
      const pedido=new AbortController()
      controller=pedido
      const limite=setTimeout(()=>pedido.abort(),15000)
      try {
        const token=await tokenAtual()
        if(!token||!ativo||pedido.signal.aborted)return
        const resp=await fetch('/api/integracoes/whatsapp/conversas?resumo=pendentes',{
          headers:{Authorization:`Bearer ${token}`},
          cache:'no-store',
          signal:pedido.signal,
        })
        if(!resp.ok||!ativo)return
        const json=await resp.json()
        if(ativo && Number.isInteger(json?.pendentes) && json.pendentes>=0)setPendentes(json.pendentes)
      } catch {} finally {
        clearTimeout(limite)
        emCurso=false
        controller=undefined
        if(ativo&&pendente){pendente=false;agendar()}
      }
    }

    const aoVoltar=()=>{if(!document.hidden)agendar()}
    void usuarioAtual().then(eu=>{
      if(!eu||!ativo)return
      canal=supabase
        .channel('whatsapp-global-'+eu.id)
        .on('postgres_changes',{event:'*',schema:'public',table:'atendimento_conversas'},agendar)
        .subscribe(status=>{if(status==='SUBSCRIBED')agendar()})
      document.addEventListener('visibilitychange',aoVoltar)
      intervalo=setInterval(agendar,60000)
      agendar()
    }).catch(()=>{})

    return()=>{
      ativo=false
      if(timer)clearTimeout(timer)
      if(intervalo)clearInterval(intervalo)
      controller?.abort()
      document.removeEventListener('visibilitychange',aoVoltar)
      if(canal)void supabase.removeChannel(canal)
    }
  },[oculto])

  if(oculto)return null

  return (
    <Link href="/whatsapp" aria-label="Abrir WhatsApp Atlas" title="WhatsApp Atlas"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 sm:bottom-6 sm:right-6">
      <MessageCircle size={26} aria-hidden="true"/>
      {pendentes>0&&(
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {pendentes>99?'99+':pendentes}
        </span>
      )}
      <span className="sr-only">WhatsApp Atlas · {pendentes} conversas pendentes</span>
    </Link>
  )
}