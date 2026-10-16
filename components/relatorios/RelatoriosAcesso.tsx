'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {usePathname} from 'next/navigation'
import {tokenAtual} from '@/lib/auth'
import type {MapaRelatorios,RelatorioId} from '@/lib/relatoriosPermissoes'
const Contexto=createContext<MapaRelatorios|null>(null)
export function useRelatoriosAcesso(){
 const acessos=useContext(Contexto)
 if(!acessos)throw Error('As permissões dos relatórios ainda não foram conferidas.')
 return acessos
}
export async function autorizarExportacaoRelatorio(id:RelatorioId){
 const token=await tokenAtual()
 if(!token)throw Error('Entre novamente no Atlas.')
 const resp=await fetch('/api/relatorios/acessos?relatorio='+id+'&finalidade=exportar',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 const json=await resp.json()
 if(!resp.ok)throw Error(json.error||'Exportação não autorizada.')
}
export function RelatoriosAcesso({children}:{children:ReactNode}){
 const pathname=usePathname()
 const [acessos,setAcessos]=useState<MapaRelatorios|null>(null)
 const [erro,setErro]=useState('')
 useEffect(()=>{
  let ativo=true
  async function carregar(){
   try{
    const token=await tokenAtual()
    if(!token)throw Error('Entre novamente no Atlas.')
    const resp=await fetch('/api/relatorios/acessos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const json=await resp.json()
    if(!resp.ok)throw Error(json.error||'Não foi possível conferir os acessos.')
    if(ativo){setAcessos(json);setErro('')}
   }catch(e){if(ativo){setAcessos(null);setErro(e instanceof Error?e.message:'Falha ao conferir os acessos.')}}
  }
  void carregar()
  const foco=()=>void carregar()
  window.addEventListener('focus',foco)
  return()=>{ativo=false;window.removeEventListener('focus',foco)}
 },[pathname])
 if(erro)return <p role="alert" className="p-6 text-red-700">{erro}</p>
 if(!acessos)return <p className="p-6 text-slate-600">Conferindo permissões dos relatórios…</p>
 const id:RelatorioId|null=pathname.includes('/esquadrifacio')?'esquadrifacio':pathname.includes('/fornecedores')?'fornecedores':null
 if(id?(!acessos[id].consultar||(pathname.endsWith('/book')&&!acessos[id].exportar)):!Object.values(acessos).some(a=>a.consultar))
  return <p role="alert" className="p-6 text-slate-700">Você não possui autorização para este relatório.</p>
 return <Contexto.Provider value={acessos}>{children}</Contexto.Provider>
}
