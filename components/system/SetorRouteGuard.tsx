'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LockKeyhole, Loader2 } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { comLimiteConsulta, fetchConsulta } from '@/lib/limiteConsulta'
import { listarPermissoesUsuario, listarSetores } from '@/lib/setores'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { podeAcessarRotaCatalogada } from '@/lib/permissoesRota'
import { resolverContextoPermissoes } from '@/lib/permissoesContextuais'

export default function SetorRouteGuard({children}:{children:React.ReactNode}) {
 const pathname=usePathname()
 const contextual=resolverContextoPermissoes(pathname)
 const painel=pathname==='/visao-geral-projetos'?'visaoGeral':pathname==='/relatorios/instalacoes'?'relatorioInstalacoes':null
 const precisaChecar=Boolean(painel)||contextual.moduloIds.length>0||pathname.startsWith('/setor/')
 const [estado,setEstado]=useState<{rota:string;nivel:'carregando'|'permitido'|'negado'|'indisponivel'}>({
  rota:pathname,nivel:precisaChecar?'carregando':'permitido',
 })
 const [tentativa,setTentativa]=useState(0)
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
    const user=await comLimiteConsulta(usuarioAtual())
    if(!user)throw Error('Sem sessão')
    if(user.role==='master'){
     if(ativo)setEstado({rota:pathname,nivel:'permitido'})
     return
    }
    if(painel){
     const token=await comLimiteConsulta(tokenAtual())
     if(!token)throw Error('Sem sessão')
     const resposta=await fetchConsulta('/api/painel-geral-acesso',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
     if(!resposta.ok)throw Error('Permissão não disponível')
     const acl=await comLimiteConsulta(resposta.json())
     if(ativo)setEstado({rota:pathname,nivel:acl?.[painel]===true?'permitido':'negado'})
     return
    }
    const [catalogo,setores,config]=await comLimiteConsulta(Promise.all([
     listarSetores(),listarPermissoesUsuario(user.id),lerAcessoUsuarioConfig(user),
    ]))
    if(!catalogo.length)throw Error('Catálogo de setores indisponível')
    const autorizado=podeAcessarRotaCatalogada(pathname,user.role,setores,config,catalogo)
    if(ativo)setEstado({rota:pathname,nivel:autorizado===false?'negado':'permitido'})
   }catch{
    if(ativo)setEstado({rota:pathname,nivel:'indisponivel'})
   }
  })()
  return()=>{ativo=false}
 },[pathname,precisaChecar,painel,tentativa])
 if(!precisaChecar)return <>{children}</>
 if(atual==='carregando')return <div className="grid min-h-[55vh] place-items-center text-slate-400">
  <Loader2 className="animate-spin"/>
 </div>
 if(atual==='indisponivel')return <main className="grid min-h-[55vh] place-items-center p-5"><section className="max-w-md rounded-2xl border bg-white p-6 text-center"><h1 className="font-semibold">Não foi possível conferir o acesso</h1><p className="mt-2 text-sm text-slate-600">O servidor está demorando para responder. Nenhuma permissão foi alterada.</p><button type="button" onClick={()=>setTentativa(t=>t+1)} className="mt-4 rounded-lg bg-brand-navy px-4 py-2 text-white">Tentar novamente</button></section></main>
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
