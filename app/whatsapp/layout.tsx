'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {tokenAtual} from '@/lib/auth'
export default function EntradaCentralLayout({children}:{children:React.ReactNode}){
 const router=useRouter()
 const ativo=process.env.NEXT_PUBLIC_ATLAS_CHAT_SELETOR==='true'
 const [estado,setEstado]=useState<'carregando'|'liberado'|'bloqueado'|'erro'>('carregando')
 const [atalho,setAtalho]=useState<string|null>(null)
 useEffect(()=>{
  if(!ativo)return
  let mounted=true
  const verificar=async()=>{
   try{const t=await tokenAtual();if(!t)throw Error('Sessão indisponível')
    const r=await fetch('/api/atlas-chat/acesso',{cache:'no-store',headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(10000)})
    if(!r.ok)throw Error('Acesso indisponível')
    const j=await r.json()
    if(mounted){const destino=j.habilitado&&typeof j.atalho==='string'?j.atalho:null;setAtalho(destino);setEstado(!j.seletor||j.central===true?'liberado':'bloqueado');if(j.seletor&&j.central===false&&destino)router.replace(destino)}
   }catch{if(mounted){setAtalho(null);setEstado('erro')}}
  }
  void verificar()
  return()=>{mounted=false}
 },[ativo,router])
 if(!ativo||estado==='liberado')return <>{children}</>
 return <main className="min-h-[60dvh] p-6 grid place-items-center"><section className="max-w-sm bg-white rounded-xl border p-5 space-y-3 text-slate-900"><h1 className="font-bold text-lg">Multiatendimento</h1><p>{estado==='carregando'?'Verificando permissões…':estado==='bloqueado'?'Acesso à central não liberado pelo Master.': 'Não foi possível verificar seu acesso. Atualize a página.'}</p>{atalho&&<Link href={atalho} className="block underline">Abrir meu Atlas Chat</Link>}<Link href="/" className="block underline">Voltar ao Atlas</Link></section></main>
}
