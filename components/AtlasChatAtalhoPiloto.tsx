'use client'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle,ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
export default function AtlasChatAtalhoPiloto(){
  const path=usePathname()
  const mostrar=path==='/'||path==='/whatsapp'
  const [acesso,setAcesso]=useState<{habilitado:boolean;master:boolean;atalho?:string|null}|null>(null)
  useEffect(()=>{
    let active=true;setAcesso(null)
    if(!mostrar)return
    void(async()=>{try{const t=await tokenAtual();if(!t)return;const r=await fetch('/api/atlas-chat/acesso',{cache:'no-store',headers:{Authorization:'Bearer '+t}});if(!r.ok)return;const j=await r.json();if(active)setAcesso(j)}catch{}})()
    return()=>{active=false}
  },[mostrar])
  if(!mostrar||!acesso||(!acesso.habilitado&&!acesso.master))return null
  return <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+11rem)] right-4 z-[79] flex flex-col items-end gap-2 sm:bottom-24">
    {process.env.NEXT_PUBLIC_ATLAS_CHAT_SELETOR!=='true'&&acesso.habilitado&&acesso.atalho&&<Link href={acesso.atalho} className="bg-[#182444] text-white rounded-full px-4 py-3 shadow-lg flex gap-2 items-center text-sm font-semibold"><MessageCircle size={20}/>Atlas Chat</Link>}
    {acesso.master&&<Link href="/atlas-chat/admin" className="bg-white text-[#182444] border rounded-full px-4 py-3 shadow-lg flex gap-2 items-center text-xs font-semibold"><ShieldCheck size={18}/>Gerenciar Atlas Chat</Link>}
  </div>
}
