'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, FilePlus2, FileText, Pencil, Search, ShoppingCart, SlidersHorizontal, Users, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { HomeModuloId } from '@/lib/homeUsuario'

const MODULOS_PADRAO: HomeModuloId[] = ['orcamentos','clientes','tarefas','calendario']

// Nunca substituir um atalho operacional por uma tela de simulação.
type IdPrevia='orcamento'|'consulta'|'venda'
type AtalhoPrevia={id:IdPrevia;titulo:string;visivel:boolean}
const PREVIAS:AtalhoPrevia[]=[
  {id:'orcamento',titulo:'Orçamento · Prévia',visivel:true},
  {id:'consulta',titulo:'Consulta de Preço · Prévia',visivel:true},
  {id:'venda',titulo:'Venda · Prévia',visivel:true},
]
const PREVIA_LINKS:Record<IdPrevia,string>={
  orcamento:'/previews/orcamento',
  consulta:'/previews/consulta-preco',
  venda:'/previews/venda',
}
const PREVIA_ICONES={orcamento:FileText,consulta:Search,venda:ShoppingCart}
const PREVIA_CORES={orcamento:'bg-indigo-100 text-indigo-700',consulta:'bg-amber-100 text-amber-700',venda:'bg-emerald-100 text-emerald-700'}

// Apenas atalhos de navegação: remover um botão da Home nunca remove sua tela ou função.
// Respeita a personalização da Home existente para cada usuário.
export default function HomeExecutiveHero({modulos = MODULOS_PADRAO}:{modulos?:HomeModuloId[]}) {
  const podeOrcamento = modulos.includes('orcamentos')
  const podeCliente = modulos.includes('clientes') || podeOrcamento
  const podeVenda = podeCliente
  const [master,setMaster]=useState(false)
  const [editar,setEditar]=useState(false)
  const [atalhos,setAtalhos]=useState<AtalhoPrevia[]>(PREVIAS)
  useEffect(()=>{let ativo=true;void usuarioAtual().then(u=>{if(ativo)setMaster(u?.role==='master')}).catch(()=>{});return()=>{ativo=false}},[])
  const previsualizaveis=atalhos.filter(a=>a.visivel&&
    (a.id==='orcamento'?podeOrcamento:podeVenda))
  function alterar(id:IdPrevia,parte:Partial<AtalhoPrevia>){
    setAtalhos(a=>a.map(x=>x.id===id?{...x,...parte}:x))
  }
  function mover(id:IdPrevia,direcao:number){
    setAtalhos(a=>{const copia=[...a],i=copia.findIndex(x=>x.id===id),j=i+direcao
      if(i<0||j<0||j>=copia.length)return a
      ;[copia[i],copia[j]]=[copia[j],copia[i]]
      return copia
    })
  }
  const botao = 'group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500'
  const icone = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg'
  const titulo = 'truncate text-xs font-bold text-slate-900 sm:text-[13px]'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8" aria-label="Acessos rápidos">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {podeOrcamento && <Link href="/orcamento-rapido" className={botao}>
          <span className={icone+' bg-blue-100 text-blue-700'}><FilePlus2 size={19}/></span>
          <span className={titulo}>Pedido de Orçamento</span>
        </Link>}
        {podeVenda && <Link href="/balcao/consulta-preco" className={botao}>
          <span className={icone+' bg-amber-100 text-amber-700'}><Search size={19}/></span>
          <span className={titulo}>Consulta de Preço</span>
        </Link>}
        {podeVenda && <Link href="/balcao" className={botao}>
          <span className={icone+' bg-emerald-100 text-emerald-700'}><ShoppingCart size={19}/></span>
          <span className={titulo}>Venda</span>
        </Link>}
        {podeCliente && <Link href="/clientes/identificar" className={botao}>
          <span className={icone+' bg-violet-100 text-violet-700'}><Users size={19}/></span>
          <span className={titulo}>Cliente 360</span>
        </Link>}
      </div>
      {master&&<div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-indigo-950">Novas telas comerciais · prévias para o Master</p>
            <p className="mt-1 text-[11px] text-indigo-800">Consulta com dados reais. Sem gravar vendas, recebimentos, orçamentos ou preços. Os atalhos operacionais acima continuam disponíveis.</p>
          </div>
          <button type="button" onClick={()=>setEditar(v=>!v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[11px] font-bold text-indigo-800">
            {editar?<X size={14}/>:<SlidersHorizontal size={14}/>}
            {editar?'Fechar ajustes':'Personalizar prévias'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {previsualizaveis.map(a=>{
            const Icon=PREVIA_ICONES[a.id]
            return <Link key={a.id} href={PREVIA_LINKS[a.id]} className={botao}>
              <span className={icone+' '+PREVIA_CORES[a.id]}><Icon size={19}/></span>
              <span className={titulo}>{a.titulo||'Prévia'}</span>
            </Link>
          })}
        </div>
        {editar&&<div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-sm font-black text-indigo-950"><Pencil size={15}/> Ajustar nomes, exibição e sequência das prévias</h3>
          <p className="mt-1 text-[11px] text-amber-800">Estes ajustes de apresentação são temporários nesta sessão e não afetam os acessos de outros usuários.</p>
          <div className="mt-3 space-y-2">{atalhos.map(a=><div key={a.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2">
            <label className="flex items-center gap-1 text-[11px] font-semibold">
              <input type="checkbox" checked={a.visivel} onChange={e=>alterar(a.id,{visivel:e.target.checked})}/> Mostrar
            </label>
            <input aria-label={'Nome de '+a.id} className="min-w-[150px] flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm"
              value={a.titulo} maxLength={45} onChange={e=>alterar(a.id,{titulo:e.target.value})}/>
            <button type="button" onClick={()=>mover(a.id,-1)} aria-label={'Mover '+a.id+' para cima'} className="rounded-lg border bg-white p-2"><ArrowUp size={15}/></button>
            <button type="button" onClick={()=>mover(a.id,1)} aria-label={'Mover '+a.id+' para baixo'} className="rounded-lg border bg-white p-2"><ArrowDown size={15}/></button>
          </div>)}</div>
          <button type="button" onClick={()=>setAtalhos(PREVIAS.map(x=>({...x})))} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">Restaurar padrão</button>
        </div>}
      </div>}
    </section>
  )
}
