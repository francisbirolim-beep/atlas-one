'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

export default function BotaoChatGlobal() {
  const pathname = usePathname()
  const [pendentes,setPendentes]=useState(0)

  useEffect(()=>{
    let ativo=true
    let canal:any

    void usuarioAtual().then(async eu=>{
      if(!eu||!ativo)return

      const atualizar=async()=>{
        try {
          const token=await tokenAtual()
          if(!token||!ativo)return
          const resp=await fetch('/api/integracoes/whatsapp/conversas',{
            headers:{Authorization:`Bearer ${token}`},
            cache:'no-store',
          })
          if(!resp.ok||!ativo)return
          const json=await resp.json()
          const conversas=Array.isArray(json?.conversas)?json.conversas:[]
          setPendentes(conversas.filter((c:any)=>Number(c.nao_lidas||0)>0).length)
        } catch {}
      }

      await atualizar()
      canal=supabase
        .channel('whatsapp-global-'+eu.id)
        .on('postgres_changes',{event:'*',schema:'public',table:'atendimento_conversas'},()=>{void atualizar()})
        .subscribe()
    })

    return()=>{ativo=false;if(canal)void supabase.removeChannel(canal)}
  },[])

  if(pathname.startsWith('/whatsapp'))return null

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