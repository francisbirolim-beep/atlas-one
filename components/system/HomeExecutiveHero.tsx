'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ClipboardList, FileText, Pencil, Search, ShoppingCart, SlidersHorizontal, Users, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { HomeModuloId } from '@/lib/homeUsuario'

const MODULOS_PADRAO:HomeModuloId[]=['orcamentos','clientes','tarefas','calendario']
type Id='pedido'|'orcamento'|'consulta'|'venda'|'cliente'
type Atalho={id:Id;titulo:string;visivel:boolean}
const DEFAULT:Atalho[]=[
  {id:'pedido',titulo:'Pedido de Orçamento',visivel:true},
  {id:'orcamento',titulo:'Orçamento',visivel:true},
  {id:'consulta',titulo:'Consulta de Preço',visivel:true},
  {id:'venda',titulo:'Venda',visivel:true},
  {id:'cliente',titulo:'Cliente 360',visivel:true},
]
const LINKS:Record<Id,string>={
  pedido:'/orcamento-rapido',
  orcamento:'/previews/orcamento',
  consulta:'/previews/consulta-preco',
  venda:'/previews/venda',
  cliente:'/clientes/identificar'
}
const ICONES={pedido:ClipboardList,orcamento:FileText,consulta:Search,venda:ShoppingCart,cliente:Users}
const CORES:Record<Id,string>={pedido:'bg-blue-100 text-blue-700',orcamento:'bg-indigo-100 text-indigo-700',consulta:'bg-amber-100 text-amber-700',venda:'bg-emerald-100 text-emerald-700',cliente:'bg-violet-100 text-violet-700'}

// Prévia isolada: o Master testa nomes, visibilidade e sequência em memória.
// Não altera a personalização real da Home nem os atalhos de outros usuários.
export default function HomeExecutiveHero({modulos=MODULOS_PADRAO}:{modulos?:HomeModuloId[]}){
  const podeOrcamento=modulos.includes('orcamentos')
  const podeCliente=modulos.includes('clientes')||podeOrcamento
  const podeVenda=podeCliente
  const permitidos:Id[]=[
    ...(podeOrcamento?['pedido','orcamento'] as Id[]:[]),
    ...(podeVenda?['consulta','venda'] as Id[]:[]),
    ...(podeCliente?['cliente'] as Id[]:[]),
  ]
  const [master,setMaster]=useState(false)
  const [editar,setEditar]=useState(false)
  const [atalhos,setAtalhos]=useState<Atalho[]>(DEFAULT)
  useEffect(()=>{let ativo=true;void usuarioAtual().then(u=>{if(ativo)setMaster(u?.role==='master')}).catch(()=>{});return()=>{ativo=false}},[])
  function alterar(id:Id,valor:Partial<Atalho>){setAtalhos(a=>a.map(x=>x.id===id?{...x,...valor}:x))}
  function mover(id:Id,direcao:number){
    setAtalhos(a=>{const copia=[...a],i=copia.findIndex(x=>x.id===id);const j=i+direcao;if(i<0||j<0||j>=copia.length)return a;[copia[i],copia[j]]=[copia[j],copia[i]];return copia})
  }
  return <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8" aria-label="Acessos rápidos">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-semibold text-slate-500">Acessos rápidos · prévia de novos orçamentos</p>
      {master&&<button type="button" onClick={()=>setEditar(v=>!v)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700">
        {editar?<X size={14}/>:<SlidersHorizontal size={14}/>} {editar?'Fechar personalização':'Personalizar atalhos (Master)'}
      </button>}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {atalhos.filter(x=>permitidos.includes(x.id)&&x.visivel).map(x=>{
        const Icon=ICONES[x.id]
        return <Link key={x.id} href={LINKS[x.id]} className="group flex min-h-14 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-lg '+CORES[x.id]}><Icon size={19}/></span>
          <span className="min-w-0 text-xs font-bold text-slate-900 sm:text-[13px]">{x.titulo||'Atalho'}</span>
        </Link>
      })}
    </div>
    {editar&&master&&<div className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h3 className="flex items-center gap-2 text-sm font-black"><Pencil size={16} className="text-blue-700"/> Personalizar atalhos da Home</h3><p className="mt-1 text-xs text-slate-500">Altere o texto, esconda ou mostre e use as setas para escolher a sequência.</p></div>
        <span className="h-fit rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">Somente nesta prévia</span>
      </div>
      <div className="mt-4 grid gap-2">{atalhos.filter(x=>permitidos.includes(x.id)).map(x=><div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-slate-50 p-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={x.visivel} onChange={e=>alterar(x.id,{visivel:e.target.checked})}/> Mostrar</label>
        <input aria-label={'Nome do atalho '+x.id} className="min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold" maxLength={42} value={x.titulo} onChange={e=>alterar(x.id,{titulo:e.target.value})}/>
        <button type="button" aria-label={'Mover '+x.id+' para cima'} onClick={()=>mover(x.id,-1)} className="rounded-lg border bg-white p-2 hover:bg-blue-50"><ArrowUp size={15}/></button>
        <button type="button" aria-label={'Mover '+x.id+' para baixo'} onClick={()=>mover(x.id,1)} className="rounded-lg border bg-white p-2 hover:bg-blue-50"><ArrowDown size={15}/></button>
      </div>)}</div>
      <div className="mt-3 flex flex-wrap justify-between gap-3">
        <p className="text-[11px] text-amber-800">As alterações não serão gravadas nem afetarão outros usuários até aprovação e integração das permissões.</p>
        <button type="button" onClick={()=>setAtalhos(DEFAULT.map(x=>({...x})))} className="rounded-lg border px-3 py-2 text-xs font-bold">Restaurar padrão</button>
      </div>
    </div>}
  </section>
}
