'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {usePathname} from 'next/navigation'
import {tokenAtual} from '@/lib/auth'
import {comLimiteConsulta,fetchConsulta} from '@/lib/limiteConsulta'
import type {MapaRelatorios,RelatorioId} from '@/lib/relatoriosPermissoes'
const Contexto=createContext<MapaRelatorios|null>(null)
export function useRelatoriosAcesso(){
 const acessos=useContext(Contexto)
 if(!acessos)throw Error('As permissões dos relatórios ainda não foram conferidas.')
 return acessos
}
export async function autorizarExportacaoRelatorio(id:RelatorioId){
 const token=await comLimiteConsulta(tokenAtual())
 if(!token)throw Error('Entre novamente no Atlas.')
 const resp=await fetchConsulta('/api/relatorios/acessos?relatorio='+id+'&finalidade=exportar',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 const json=await comLimiteConsulta(resp.json())
 if(!resp.ok)throw Error(json.error||'Exportação não autorizada.')
}
export function RelatoriosAcesso({children}:{children:ReactNode}){
 const pathname=usePathname()
 const [acessos,setAcessos]=useState<MapaRelatorios|null>(null)
 const [erro,setErro]=useState('')
 const [tentativa,setTentativa]=useState(0)
 useEffect(()=>{
  let ativo=true
  let emCurso=false
  const controlador=new AbortController()
  async function carregar(){
   if(!ativo||emCurso)return
   emCurso=true
   try{
    const token=await comLimiteConsulta(tokenAtual())
    if(!token)throw Error('Entre novamente no Atlas.')
    if(!ativo)return
    const resp=await fetchConsulta('/api/relatorios/acessos',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controlador.signal})
    const json=await comLimiteConsulta(resp.json())
    if(!resp.ok)throw Error(json.error||'Não foi possível conferir os acessos.')
    if(ativo){setAcessos(anterior=>anterior&&JSON.stringify(anterior)===JSON.stringify(json)?anterior:json);setErro('')}
   }catch(e){if(ativo){setAcessos(null);setErro(e instanceof Error?e.message:'Falha ao conferir os acessos.')}}
   finally{emCurso=false}
  }
  void carregar()
  const foco=()=>void carregar()
  window.addEventListener('focus',foco)
  return()=>{ativo=false;controlador.abort();window.removeEventListener('focus',foco)}
 },[pathname,tentativa])
 if(erro)return <div role="alert" className="space-y-3 p-6 text-red-700"><p>{erro}</p><button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={()=>{setErro('');setTentativa(t=>t+1)}}>Tentar novamente</button></div>
 if(!acessos)return <p className="p-6 text-slate-600">Conferindo permissões dos relatórios…</p>
 const id:RelatorioId|null=pathname.includes('/esquadrifacio')?'esquadrifacio':pathname.includes('/fornecedores')?'fornecedores':null
 if(id?(!acessos[id].consultar||(pathname.endsWith('/book')&&!acessos[id].exportar)):!Object.values(acessos).some(a=>a.consultar))
  return <p role="alert" className="p-6 text-slate-700">Você não possui autorização para este relatório.</p>
 return <Contexto.Provider value={acessos}>{children}</Contexto.Provider>
}
