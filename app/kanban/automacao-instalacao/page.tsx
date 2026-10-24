'use client'

import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,BellRing,Loader2,Save,Users} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Pessoa={id:string;nome:string}
export default function AutomacaoInstalacaoPage(){
 const [pessoas,setPessoas]=useState<Pessoa[]>([])
 const [responsaveis,setResponsaveis]=useState<string[]>([])
 const [ativo,setAtivo]=useState(false)
 const [carregando,setCarregando]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const carregar=useCallback(async()=>{
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual()
   const resp=await fetch('/api/instalacao/automacao-producao',{headers:{Authorization:'Bearer '+(token||'')},cache:'no-store'})
   const data=await resp.json()
   if(!resp.ok)throw new Error(data.error||'Não foi possível carregar.')
   setPessoas(data.usuarios||[])
   setResponsaveis(data.responsaveis||[])
   setAtivo(data.ativo===true)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar automação.')}
  finally{setCarregando(false)}
 },[])
 useEffect(()=>{void carregar()},[carregar])
 async function salvar(){
  if(salvando)return
  setSalvando(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual()
   const resp=await fetch('/api/instalacao/automacao-producao',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')},
    body:JSON.stringify({ativo,responsaveis}),
   })
   const data=await resp.json()
   if(!resp.ok)throw new Error(data.error||'Falha ao salvar configuração.')
   setMensagem('Automação salva. A regra valerá para novas obras liberadas da Produção para a Instalação.')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setSalvando(false)}
 }
 return <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
  <Link href="/kanban?setor=instalacao" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={17}/> Voltar ao Kanban de Instalação</Link>
  <header><h1 className="text-2xl font-black text-slate-900">Automação · Produção para Instalação</h1>
   <p className="mt-2 text-sm text-slate-600">Quando a conclusão técnica da Produção liberar uma obra para Instalação, enviar uma tarefa e um aviso a cada pessoa selecionada para organizar o agendamento e a liberação da instalação.</p></header>
  <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
   <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-800">
    <input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)} disabled={carregando} className="h-5 w-5 accent-blue-700"/>
    <BellRing size={18}/> Ativar envio automático de tarefas e notificações
   </label>
   <div className="border-t pt-4">
    <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold"><Users size={17}/> Responsáveis pela organização da instalação</p>
    {carregando?<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin"/> Carregando equipe...</p>:
     <div className="grid gap-2 sm:grid-cols-2">{pessoas.map(p=><label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
      <input type="checkbox" checked={responsaveis.includes(p.id)} onChange={e=>setResponsaveis(ids=>e.target.checked?[...ids,p.id]:ids.filter(x=>x!==p.id))} className="h-4 w-4 accent-blue-700"/>
      {p.nome}
     </label>)}</div>}
   </div>
   <p className="text-xs text-slate-500">Cada responsável recebe sua própria tarefa. A automação só é disparada quando a obra estiver tecnicamente liberada para Instalação. Reprocessamentos não geram tarefas duplicadas; cards antigos não são movimentados.</p>
   <button type="button" onClick={()=>void salvar()} disabled={carregando||salvando||(ativo&&!responsaveis.length)}
    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
    {salvando?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} Salvar automação
   </button>
   {erro&&<p role="alert" className="text-sm font-semibold text-red-700">{erro}</p>}
   {mensagem&&<p role="status" className="text-sm font-semibold text-emerald-700">{mensagem}</p>}
  </section>
 </main>
}
