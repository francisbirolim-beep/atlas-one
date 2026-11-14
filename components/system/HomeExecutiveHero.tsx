'use client'

import Link from 'next/link'
import { CalendarPlus, CheckSquare, ClipboardList, FilePlus2, HardHat, ShoppingCart, Truck } from 'lucide-react'
import type { HomeModuloId } from '@/lib/homeUsuario'

const MODULOS_PADRAO:HomeModuloId[]=['orcamentos','clientes','tarefas','calendario']
export default function HomeExecutiveHero({modulos=MODULOS_PADRAO}:{modulos?:HomeModuloId[]}){
  const tem=(id:HomeModuloId)=>modulos.includes(id)
  const botao='group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md'
  const icone='grid h-8 w-8 shrink-0 place-items-center rounded-lg'
  const titulo='truncate text-xs font-bold text-slate-900 sm:text-[13px]'
  return(
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tem('orcamentos')&&<Link href="/orcamento-rapido" className={botao}>
          <span className={icone+' bg-blue-100 text-blue-700'}><FilePlus2 size={19}/></span><span className={titulo}>Novo Orçamento</span>
        </Link>}
        {(tem('orcamentos')||tem('clientes'))&&<Link href="/obras" className={botao}>
          <span className={icone+' bg-amber-100 text-amber-700'}><HardHat size={19}/></span><span className={titulo}>Nova Obra</span>
        </Link>}
        {tem('orcamentos')&&<Link href="/compras" className={botao}>
          <span className={icone+' bg-blue-100 text-blue-700'}><ShoppingCart size={19}/></span><span className={titulo}>Nova Compra</span>
        </Link>}
        {(tem('orcamentos')||tem('clientes'))&&<Link href="/clientes/identificar" className={botao} title="Localizar cliente para criar ou consultar romaneio">
          <span className={icone+' bg-violet-100 text-violet-700'}><Truck size={19}/></span><span className={titulo}>Romaneio</span>
        </Link>}
        {tem('tarefas')&&<button type="button" onClick={()=>window.dispatchEvent(new Event('atlas:tarefa-equipe-nova'))} className={botao}>
          <span className={icone+' bg-emerald-100 text-emerald-700'}><CheckSquare size={19}/></span><span className={titulo}>Nova Tarefa</span>
        </button>}
        {tem('calendario')&&<button type="button" onClick={()=>window.dispatchEvent(new Event('atlas:novo-compromisso'))} className={botao}>
          <span className={icone+' bg-violet-100 text-violet-700'}><CalendarPlus size={19}/></span><span className={titulo}>Novo Compromisso</span>
        </button>}
      </div>
    </section>
  )
}
