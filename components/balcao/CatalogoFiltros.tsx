'use client'

import Link from 'next/link'
import { Filter, Plus } from 'lucide-react'

type Categoria = { valor: string; label: string }

type Props = {
  categorias: Categoria[]
  grupos: string[]
  categoria: string
  grupo: string
  onCategoria: (valor: string) => void
  onGrupo: (valor: string) => void
  mostrarCriarFiltro?: boolean
}

export default function CatalogoFiltros({ categorias, grupos, categoria, grupo, onCategoria, onGrupo, mostrarCriarFiltro = true }: Props) {
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => { onCategoria(''); onGrupo('') }} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!categoria ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todas</button>
      {categorias.map(cat => <button key={cat.valor} type="button" onClick={() => { onCategoria(cat.valor); onGrupo('') }} className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoria === cat.valor ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat.label}</button>)}
    </div>

    {grupos.length > 0 && <div className="border-t border-slate-100 pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Filter size={13}/>Grupo / linha</div>
        {mostrarCriarFiltro && <Link href="/balcao/configuracoes" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"><Plus size={12}/>Criar filtro</Link>}
      </div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
        <button type="button" onClick={() => onGrupo('')} className={`rounded-full border px-3 py-1 text-xs ${!grupo ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-200 text-slate-600'}`}>Todos os grupos</button>
        {grupos.map(nome => <button key={nome} type="button" onClick={() => onGrupo(nome)} className={`rounded-full border px-3 py-1 text-xs ${grupo === nome ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{nome}</button>)}
      </div>
    </div>}
  </div>
}
