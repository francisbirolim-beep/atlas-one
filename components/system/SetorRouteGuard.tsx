'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LockKeyhole, Loader2 } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, listarSetores } from '@/lib/setores'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { podeAcessarRotaCatalogada } from '@/lib/permissoesRota'
import { resolverContextoPermissoes } from '@/lib/permissoesContextuais'

export default function SetorRouteGuard({children}:{children:React.ReactNode}) {
 const pathname=usePathname()
 const contextual=resolverContextoPermissoes(pathname)
 const painel=pathname==='/visao-geral-projetos'?'visaoGeral':pathname==='/relatorios/instalacoes'?'relatorioInstalacoes':null
 const precisaChecar=Boolean(painel)||contextual.moduloIds.length>0||pathname.startsWith('/setor/')
 const [estado,setEstado]=useState<{rota:string;nivel:'carregando'|'permitido'|'negado'}>({
  rota:pathname,nivel:precisaChecar?'carregando':'permitido',
 })
 const atual=estado.rota===pathname?estado.nivel:'carregando'
 useEffect(()=>{
  let ativo=true
  if(!precisaChecar){
   setEstado({rota:pathname,nivel:'permitido'})
   return()=>{ativo=false}
  }
  setEstado({rota:pathname,nivel:'carregando'})
  void(async()=>{
   try{
    const user=await usuarioAtual()
    if(!user)throw Error('Sem sessão')
    if(user.role==='master'){
     if(ativo)setEstado({rota:pathname,nivel:'permitido'})
     return
    }
    if(painel){
     const token=await tokenAtual()
     if(!token)throw Error('Sem sessão')
     const resposta=await fetch('/api/painel-geral-acesso',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
     if(!resposta.ok)throw Error('Permissão não disponível')
     const acl=await resposta.json()
     if(ativo)setEstado({rota:pathname,nivel:acl?.[painel]===true?'permitido':'negado'})
     return
    }
    const [catalogo,setores,config]=await Promise.all([
     listarSetores(),listarPermissoesUsuario(user.id),lerAcessoUsuarioConfig(user),
    ])
    if(!catalogo.length)throw Error('Catálogo de setores indisponível')
    const autorizado=podeAcessarRotaCatalogada(pathname,user.role,setores,config,catalogo)
    if(ativo)setEstado({rota:pathname,nivel:autorizado===false?'negado':'permitido'})
   }catch{
    if(ativo)setEstado({rota:pathname,nivel:'negado'})
   }
  })()
  return()=>{ativo=false}
 },[pathname,precisaChecar,painel])
 if(!precisaChecar)return <>{children}</>
 if(atual==='carregando')return <div className="grid min-h-[55vh] place-items-center text-slate-400">
  <Loader2 className="animate-spin"/>
 </div>
 if(atual==='negado')return <main className="grid min-h-[65vh] place-items-center p-5">
  <section className="max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
   <LockKeyhole size={36} className="mx-auto mb-3 text-slate-400"/>
   <h1 className="font-semibold text-slate-900">Setor ou tela sem permissão</h1>
   <p className="mt-2 text-sm text-slate-600">O Master precisa liberar o setor e o módulo desta tela. Uma ação interna não libera um setor oculto.</p>
   <Link href="/setores" className="mt-4 inline-flex rounded-lg bg-brand-navy px-4 py-2 text-white">Voltar aos setores</Link>
  </section>
 </main>
 return <>{children}</>
}
