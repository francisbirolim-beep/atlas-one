'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,RefreshCcw,ShieldCheck,LockKeyhole,Users} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
type Usuario={id:string;nome:string;role:string}
type Permissao={usuario_id:string;quadro:string;nivel:'oculto'|'consultar'|'gerenciar';updated_at:string}
type Quadro={id:string;nome:string}
type Dados={usuarios:Usuario[];permissoes:Permissao[];quadros:Quadro[];aviso:string}
const niveis=[{id:'oculto',nome:'Oculto — não aparece'},{id:'consultar',nome:'Somente consultar'},{id:'gerenciar',nome:'Consultar e editar colunas'}]
export default function KanbanPermissoes(){
 const [dados,setDados]=useState<Dados|null>(null),[usuario,setUsuario]=useState(''),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[carregando,setCarregando]=useState(true),[editando,setEditando]=useState('')
 const carregar=useCallback(async()=>{
  try{setCarregando(true);setErro('');const token=await tokenAtual();if(!token)throw Error('Entre novamente no Atlas')
   const r=await fetch('/api/kanban/permissoes-colunas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Erro ao carregar permissões')
   setDados(j);setUsuario(v=>v&&j.usuarios.some((x:Usuario)=>x.id===v)?v:j.usuarios[0]?.id||'')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar')}
  finally{setCarregando(false)}
 },[])
 useEffect(()=>{void carregar()},[carregar])
 const nivel=(quadro:string)=>dados?.permissoes.find(p=>p.usuario_id===usuario&&p.quadro===quadro)?.nivel||'oculto'
 async function salvar(quadro:string,valor:'oculto'|'consultar'|'gerenciar'){
  if(!usuario||editando)return
  const quem=dados?.usuarios.find(x=>x.id===usuario)?.nome||'Usuário'
  if(!confirm('Confirmar '+quem+' → '+quadro+' → '+valor+'? A alteração ficará no histórico.'))return
  try{setEditando(quadro);setErro('');setSucesso('');const token=await tokenAtual()
   const r=await fetch('/api/kanban/permissoes-colunas',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({usuarioId:usuario,quadro,nivel:valor})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Falha ao salvar')
   setDados(d=>d?{...d,permissoes:[...d.permissoes.filter(p=>!(p.usuario_id===usuario&&p.quadro===quadro)),{usuario_id:usuario,quadro,nivel:valor,updated_at:new Date().toISOString()}]}:null)
   setSucesso('Permissão de '+quem+' atualizada com registro no histórico.')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar')}finally{setEditando('')}
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-7"><div className="mx-auto max-w-5xl space-y-5">
  <header><Link href="/kanban/configuracao-colunas" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={15}/> Voltar à configuração</Link><h1 className="mt-2 flex items-center gap-2 text-2xl font-black"><ShieldCheck size={24} className="text-blue-700"/> Permissões de colunas por usuário</h1><p className="mt-1 text-sm text-slate-600">O Master decide quem pode ver ou personalizar as colunas de cada Kanban.</p></header>
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><LockKeyhole size={15} className="mr-1 inline"/> Cada quadro começa oculto. A liberação aqui é apenas das <b>configurações de colunas</b>, sem liberar dados financeiros nem mudar o acesso a cards, produção e outros módulos.</div>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
  {sucesso&&<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
  <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-end gap-3"><label className="min-w-[240px] flex-1 text-sm font-semibold"><span className="mb-1 block">Funcionário</span><select className="w-full rounded-lg border p-3" value={usuario} onChange={e=>setUsuario(e.target.value)}><option value="">Selecionar usuário</option>{(dados?.usuarios||[]).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label><button onClick={()=>void carregar()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"><RefreshCcw size={15}/> Atualizar</button></div>
   {carregando&&<p className="text-sm text-slate-500">Carregando funcionários e Kanbans...</p>}
   {!carregando&&!dados?.usuarios.length&&<p className="rounded-lg border border-dashed p-4 text-sm">Nenhum usuário adicional cadastrado. Cadastre um funcionário primeiro.</p>}
   {usuario&&<div className="space-y-2">{(dados?.quadros||[]).map(q=><div key={q.id} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_240px]"><div><b className="text-sm">{q.nome}</b><p className="mt-1 text-xs text-slate-500">{nivel(q.id)==='oculto'?'Sem acesso à configuração':nivel(q.id)==='consultar'?'Pode consultar as colunas':'Pode criar, renomear, mover e remover colunas personalizadas'}</p></div><select aria-label={'Permissão para '+q.nome} className="w-full rounded-lg border p-2.5 text-xs" disabled={!!editando} value={nivel(q.id)} onChange={e=>void salvar(q.id,e.target.value as Permissao['nivel'])}>{niveis.map(n=><option key={n.id} value={n.id}>{n.nome}</option>)}</select></div>)}</div>}
  </section>
 </div></main>
}
