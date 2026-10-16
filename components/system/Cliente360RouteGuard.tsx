'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { tokenAtual } from '@/lib/auth'
import { podeCliente360, type ContextoCliente360, type RecursoCliente360 } from '@/lib/cliente360Permissoes'
// Proteção complementar de navegação. A API/RLS continua responsável pelos dados.
export default function Cliente360RouteGuard({children}:{children:React.ReactNode}) {
  const path=usePathname()
  const router=useRouter()
  const match=path.match(/^\/clientes\/([^/]+)\/(central|financeiro|orcamentos-revisoes|vendas)(?:\/|$)/)
  const alvo=match?.[2]
  const [estado,setEstado]=useState<{path:string;permitido:boolean}|null>(null)
  useEffect(()=>{
    let ativo=true
    if(!alvo)return
    void(async()=>{
      try {
        const token=await tokenAtual()
        if(!token)throw new Error('Sessão inválida')
        const resp=await fetch('/api/usuarios/acessos-etapas',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
        if(!resp.ok)throw new Error('Acesso não conferido')
        const ctx=await resp.json() as ContextoCliente360
        if(!ativo)return
        if(alvo==='central'&&ctx.role!=='master'&&ctx.cliente360&&Object.keys(ctx.cliente360).length>0){router.replace(`/clientes/${match![1]}`);return}
        const recurso:RecursoCliente360=alvo==='financeiro'?'financeiro':alvo==='orcamentos-revisoes'?'orcamentos':alvo==='vendas'?'vendas':'visao'
        setEstado({path,permitido:podeCliente360(ctx,recurso)})
      }catch{if(ativo)setEstado({path,permitido:false})}
    })()
    return ()=>{ativo=false}
  },[path,alvo,router])
  if(!alvo)return <>{children}</>
  if(estado?.path!==path)return <div className="p-8 text-sm text-slate-500">Conferindo autorização...</div>
  if(!estado.permitido)return <div className="p-8"><h1 className="font-bold">Acesso não liberado</h1><p className="mt-2 text-sm text-slate-500">Peça ao Master para conferir as permissões deste setor e do Cliente 360.</p><Link href={`/clientes/${match![1]}`} className="mt-4 inline-block text-sm font-bold">Voltar ao cliente</Link></div>
  return <>{children}</>
}
