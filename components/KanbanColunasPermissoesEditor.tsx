'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {Layers3,RefreshCcw,ShieldCheck} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Quadro={id:string;nome:string}
type Nivel='oculto'|'consultar'|'gerenciar'
type Acesso={usuario_id:string;quadro:string;nivel:Nivel}
type Dados={quadros:Quadro[];permissoes:Acesso[]}
const opcoes:[Nivel,string][]=[['oculto','Oculto'],['consultar','Somente consultar'],['gerenciar','Consultar e editar colunas']]
export default function KanbanColunasPermissoesEditor({usuarioId,usuarioNome,usuarioRole}:{usuarioId:string;usuarioNome:string;usuarioRole:string}){
 const [dados,setDados]=useState<Dados|null>(null),[carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(''),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('')
 const carregar=useCallback(async()=>{
  try{setCarregando(true);setErro('');const token=await tokenAtual();if(!token)throw Error('Entre novamente no Atlas')
   const r=await fetch('/api/kanban/permissoes-colunas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Erro nas permissões do Kanban')
   setDados({quadros:j.quadros||[],permissoes:j.permissoes||[]})
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar autorizações')}
  finally{setCarregando(false)}
 },[])
 useEffect(()=>{setMensagem('');setDados(null);void carregar()},[usuarioId,carregar])
 const nivel=(id:string):Nivel=>usuarioRole==='master'?'gerenciar':dados?.permissoes.find(a=>a.usuario_id===usuarioId&&a.quadro===id)?.nivel||'oculto'
 async function mudar(quadro:string,novo:Nivel){
  if(usuarioRole==='master'||salvando||nivel(quadro)===novo)return
  const quadroNome=dados?.quadros.find(x=>x.id===quadro)?.nome||quadro
  if(!confirm(`Confirmar para ${usuarioNome}: ${quadroNome} → ${opcoes.find(o=>o[0]===novo)?.[1]}? A mudança ficará no histórico.`))return
  try{setSalvando(quadro);setErro('');setMensagem('');const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/kanban/permissoes-colunas',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({usuarioId,quadro,nivel:novo})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Falha ao salvar')
   setDados(d=>d?{...d,permissoes:[...d.permissoes.filter(a=>!(a.usuario_id===usuarioId&&a.quadro===quadro)),{usuario_id:usuarioId,quadro,nivel:novo}]}:null)
   setMensagem(`Permissão de ${usuarioNome} salva com histórico.`)
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar')}finally{setSalvando('')}
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-5">
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div className="flex items-start gap-2"><Layers3 size={18} className="mt-0.5 text-blue-700"/><div><h2 className="font-semibold text-slate-900">Permissões dos Kanbans de {usuarioNome.split(' ')[0]}</h2><p className="mt-1 text-xs text-slate-500">Gerencia somente a apresentação das colunas. Não libera leitura financeira, movimentação de cards ou aprovação de etapas.</p></div></div><button type="button" onClick={()=>void carregar()} title="Atualizar permissões" className="rounded-lg border p-2 text-slate-600"><RefreshCcw size={15}/></button></div>
  <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><ShieldCheck size={15} className="mr-1 inline"/> Por padrão, o funcionário não vê a configuração de nenhum Kanban. O Master sempre gerencia todos. Cada alteração é salva imediatamente e registrada.</div>
  {erro&&<p role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
  {mensagem&&<p className="mb-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{mensagem}</p>}
  {carregando?<p className="py-4 text-sm text-slate-500">Carregando quadros...</p>:<div className="space-y-2">{(dados?.quadros||[]).map(q=><div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="text-xs font-semibold text-slate-800">{q.nome}</p><p className="text-[11px] text-slate-500">{nivel(q.id)==='oculto'?'Configuração oculta':nivel(q.id)==='consultar'?'Consulta liberada':'Gestão de colunas liberada'}</p></div><select value={nivel(q.id)} disabled={usuarioRole==='master'||!!salvando} onChange={e=>void mudar(q.id,e.target.value as Nivel)} aria-label={'Permissão de '+q.nome} className="rounded-lg border border-slate-300 bg-white p-2 text-xs">{opcoes.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></div>)}{!dados?.quadros?.length&&<p className="text-xs text-slate-500">Nenhum quadro disponível nesta empresa.</p>}</div>}
  <Link href="/kanban/permissoes-colunas" className="mt-3 inline-block text-xs font-semibold text-blue-700 underline">Abrir painel completo de liberações de Kanbans</Link>
 </section>
}
