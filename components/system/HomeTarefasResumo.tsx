'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, Columns3, ListTodo, Users } from 'lucide-react'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunasTarefas, listarTarefas } from '@/lib/tarefas'
import { listarEquipe, type EquipeTarefa } from '@/lib/tarefasEquipeCliente'
import type { TarefaPessoal, TarefaPessoalColuna } from '@/lib/tipos'

function normal(s:string){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function mesDaData(iso?:string|null){
 if(!iso)return ''
 const d=new Date(iso)
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
}
export default function HomeTarefasResumo(){
  const [tarefas,setTarefas]=useState<TarefaPessoal[]>([])
  const [equipe,setEquipe]=useState<EquipeTarefa[]>([])
  const [colunas,setColunas]=useState<TarefaPessoalColuna[]>([])
  const [delegadas,setDelegadas]=useState<TarefaPessoal[]>([])
  const [carregando,setCarregando]=useState(true)
  useEffect(()=>{
    let ativo=true
    let usuarioId:string|null=null
    let intervalo:ReturnType<typeof setInterval>|null=null
    async function atualizar(){
      if(!usuarioId||!navigator.onLine)return
      const token=await tokenAtual()
      const [ts,cs,es,ds]=await Promise.all([
        listarTarefas(usuarioId),listarColunasTarefas(usuarioId),listarEquipe().catch(()=>[]),
        token?fetch('/api/tarefas/delegadas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
          .then(r=>r.ok?r.json():null).then(r=>r?.tarefas||[]).catch(()=>[]):Promise.resolve([]),
      ])
      if(!ativo)return
      setTarefas(ts);setColunas(cs);setEquipe(es);setDelegadas(ds);setCarregando(false)
    }
    void usuarioAtual().then(u=>{
      if(!ativo||!u){setCarregando(false);return}
      usuarioId=u.id
      void atualizar()
      intervalo=setInterval(()=>{if(document.visibilityState==='visible')void atualizar()},45000)
    })
    const ouvir=()=>void atualizar()
    window.addEventListener('atlas:tarefas-atualizadas',ouvir)
    window.addEventListener('atlas:tarefas-equipe-atualizadas',ouvir)
    return()=>{
      ativo=false;if(intervalo)clearInterval(intervalo)
      window.removeEventListener('atlas:tarefas-atualizadas',ouvir)
      window.removeEventListener('atlas:tarefas-equipe-atualizadas',ouvir)
    }
  },[])
  const numeros=useMemo(()=>{
    const colunaPorId=new Map(colunas.map(c=>[c.id,normal(c.nome)]))
    const abertas=tarefas.filter(t=>!t.concluida_em)
    const estagios=(nome:string)=>abertas.filter(t=>(colunaPorId.get(t.coluna_id)||'').includes(nome)).length
    const deLegacy=delegadas.filter(t=>!t.concluida_em)
    const minhasEquipe=equipe.filter(t=>t.responsaveis_ids.some(Boolean))
    const periodo=mesDaData(new Date().toISOString())
    const contador=(status:string)=>equipe.filter(t=>t.status===status && t.responsaveis_ids.length>0).length
    return {
      fazer:estagios('fazer')+contador('a_fazer'),
      andamento:estagios('andamento')+contador('em_andamento'),
      aguardando:estagios('aguard')+contador('aguardando'),
      pedidos:deLegacy.length+equipe.filter(t=>t.status!=='concluido'&&!t.responsaveis_ids.includes(t.criado_por_id)).length,
      concluidas:tarefas.filter(t=>t.concluida_em&&mesDaData(t.concluida_em)===periodo).length+
        equipe.filter(t=>t.status==='concluido'&&mesDaData(t.concluida_em)===periodo).length,
    }
  },[tarefas,colunas,equipe,delegadas])
  const itens=[
    {nome:'A fazer',n:numeros.fazer,Icon:ListTodo,cor:'text-slate-500'},
    {nome:'Em andamento',n:numeros.andamento,Icon:Columns3,cor:'text-blue-600'},
    {nome:'Aguardando',n:numeros.aguardando,Icon:Clock3,cor:'text-amber-500'},
    {nome:'Pedidos de tarefa (que fiz)',n:numeros.pedidos,Icon:Users,cor:'text-violet-600'},
    {nome:'Concluídas (mês atual)',n:numeros.concluidas,Icon:CheckCircle2,cor:'text-emerald-600'},
  ]
  return(
    <article className="h-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-base font-bold text-slate-900">Minhas tarefas</h2>
        <Link href="/tarefas" className="text-xs font-semibold text-blue-600 hover:underline">Ver todas</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {itens.map(({nome,n,Icon,cor})=><div key={nome} className="flex min-h-8 items-center gap-2 py-1">
          <Icon size={18} className={cor}/><span className="flex-1 text-xs font-medium text-slate-700">{nome}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{carregando?'—':n}</span>
        </div>)}
      </div>
    </article>
  )
}
