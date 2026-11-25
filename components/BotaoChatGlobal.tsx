'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname,useRouter } from 'next/navigation'
import { MessageCircle,Headset,X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import {destinoEntradaWhatsApp} from '@/lib/atlasChatEntrada'
import { rotaReciboAutenticado } from '@/lib/reciboImpressaoRota'

export default function BotaoChatGlobal() {
  const seletorAtivo=process.env.NEXT_PUBLIC_ATLAS_CHAT_SELETOR==='true'
  const pathname = usePathname()
  const router=useRouter()
  const [menu,setMenu]=useState<{atalho:string;central:boolean}|null>(null)
  const [abrindo,setAbrindo]=useState(false),[erroEntrada,setErroEntrada]=useState('')
  async function abrir(){
    if(abrindo)return
    setAbrindo(true);setErroEntrada('')
    try{
      const t=await tokenAtual();if(!t){router.push('/login');return}
      const r=await fetch('/api/atlas-chat/acesso',{cache:'no-store',headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(10000)})
      if(!r.ok)throw Error('Não foi possível verificar seus acessos.')
      const j=await r.json()
      if(!j.seletor){router.push('/whatsapp');return}
      const destino=destinoEntradaWhatsApp(j.habilitado===true&&typeof j.atalho==='string',j.central===true)
      if(destino==='chat')router.push(j.atalho)
      else if(destino==='central')router.push('/whatsapp')
      else if(destino==='escolher')setMenu({atalho:j.atalho,central:true})
      else setErroEntrada('Nenhum acesso liberado. Solicite autorização ao Master.')
    }catch(e){setErroEntrada(e instanceof Error?e.message:'Falha ao verificar acessos.')}
    finally{setAbrindo(false)}
  }
  useEffect(()=>{setMenu(null);setErroEntrada('')},[pathname])
  const [pendentes,setPendentes]=useState(0)

  const oculto = pathname.startsWith('/atlas-chat') || pathname.startsWith('/whatsapp') || rotaReciboAutenticado(pathname)

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
    void usuarioAtual().then(async eu=>{
      if(!eu||!ativo)return
      if(seletorAtivo){
        const t=await tokenAtual()
        if(!t||!ativo)return
        const r=await fetch('/api/atlas-chat/acesso',{cache:'no-store',headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(10000)})
        if(!r.ok||!ativo)return
        const j=await r.json()
        if(!ativo)return
        if(j.seletor&&j.central!==true){setPendentes(0);return}
      }
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

  return (<>
    <Link href="/whatsapp" onClick={e=>{if(seletorAtivo){e.preventDefault();void abrir()}}} aria-label="Abrir WhatsApp Atlas" title="WhatsApp Atlas"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 sm:bottom-6 sm:right-6">
      <MessageCircle size={26} aria-hidden="true"/>
      {pendentes>0&&(
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {pendentes>99?'99+':pendentes}
        </span>
      )}
      <span className="sr-only">WhatsApp Atlas · {pendentes} conversas pendentes</span>
    </Link>
    {erroEntrada&&<div role="alert" className="fixed bottom-24 right-4 max-w-[calc(100vw-2rem)] z-[100] bg-white border rounded-xl shadow p-4 text-sm flex gap-2">{erroEntrada}<button aria-label="Fechar aviso" onClick={()=>setErroEntrada('')}><X size={18}/></button></div>}
    {menu&&<div className="fixed inset-0 z-[100] bg-black/40 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-label="Conectar WhatsApp Atlas" className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 text-slate-900"><header className="flex justify-between items-center"><h2 className="font-bold">WhatsApp Atlas</h2><button aria-label="Fechar" onClick={()=>setMenu(null)}><X/></button></header><p className="text-sm text-slate-600">Escolha sua caixa. Use a sessão atual do Atlas.</p><Link href="/whatsapp" onClick={()=>setMenu(null)} className="border rounded-xl p-4 flex items-center gap-3"><Headset/><span><b className="block">Conectar Multiatendimento</b><small>Central de clientes externos</small></span></Link><Link href={menu.atalho} onClick={()=>setMenu(null)} className="border rounded-xl p-4 flex items-center gap-3"><MessageCircle/><span><b className="block">Conectar Atlas Chat</b><small>Sua caixa individual e equipe</small></span></Link></section></div>}
  </>)
}