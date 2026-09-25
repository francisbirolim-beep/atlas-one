'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

export default function BotaoChatGlobal() {
  const pathname = usePathname()
  const [naoLidas,setNaoLidas]=useState(0)

  useEffect(()=>{
    let ativo=true
    let canal:any
    void usuarioAtual().then(async eu=>{
      if(!eu||!ativo)return
      const atualizar=async()=>{
        const {data:ps}=await supabase.from('chat_participantes').select('conversa_id,ultima_leitura_em').eq('usuario_id',eu.id)
        let total=0
        for(const p of ps||[]){
          let q=supabase.from('chat_mensagens').select('id',{count:'exact',head:true}).eq('conversa_id',p.conversa_id).neq('usuario_id',eu.id)
          if(p.ultima_leitura_em)q=q.gt('created_at',p.ultima_leitura_em)
          const {count}=await q
          total+=count||0
        }
        if(ativo)setNaoLidas(total)
      }
      await atualizar()
      canal=supabase.channel('chat-global-'+eu.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_mensagens'},async payload=>{
        const m=payload.new as any
        if(m.usuario_id===eu.id)return
        const {data:p}=await supabase.from('chat_participantes').select('id').eq('conversa_id',m.conversa_id).eq('usuario_id',eu.id).maybeSingle()
        if(!p)return
        setNaoLidas(n=>n+1)
        if(typeof document!=='undefined'&&document.visibilityState==='visible'&&'Notification'in window&&Notification.permission==='granted'){
          new Notification(m.usuario_nome||'Atlas One',{body:m.texto||m.anexo_nome||'Nova mensagem no Chat interno',tag:'atlas-chat-'+m.conversa_id})
        }
      }).subscribe()
    })
    return()=>{ativo=false;if(canal)void supabase.removeChannel(canal)}
  },[])

  if (pathname.startsWith('/atendimento')) return null
  return (
    <Link href="/atendimento" aria-label="Abrir Atendimento WhatsApp" title="Atendimento WhatsApp"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 sm:bottom-6 sm:right-6">
      <MessageCircle size={28} aria-hidden="true" />
      {naoLidas>0&&<span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{naoLidas>99?'99+':naoLidas}</span>}
      <span className="sr-only">Atendimento WhatsApp</span>
    </Link>
  )
}
