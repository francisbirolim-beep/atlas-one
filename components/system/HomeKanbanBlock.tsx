'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Columns3 } from 'lucide-react'
import { listarColunas } from '@/lib/kanban'
import { supabase } from '@/lib/supabase'
import type { KanbanColuna } from '@/lib/tipos'

type Contagem = Record<string, number>

export default function HomeKanbanBlock() {
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [contagem, setContagem] = useState<Contagem>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([
      listarColunas(),
      supabase.from('orcamentos').select('id,coluna_id,eh_assistencia'),
    ]).then(([cols, resp]) => {
      if (!ativo) return
      const mapa: Contagem = {}
      ;(resp.data || []).forEach((orcamento: any) => {
        if (orcamento.eh_assistencia) return
        const id = orcamento.coluna_id || cols[0]?.id
        if (id) mapa[id] = (mapa[id] || 0) + 1
      })
      setColunas(cols)
      setContagem(mapa)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2"><Columns3 size={17} className="mt-0.5 text-cyan-300" /><div><h2 className="font-semibold">Kanban comercial</h2><p className="text-xs text-slate-500">Resumo rápido do funil de vendas.</p></div></div>
        <Link href="/kanban" className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200">Abrir <ArrowUpRight size={13}/></Link>
      </div>

      {carregando ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Carregando Kanban...</p>
      ) : colunas.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Nenhuma etapa configurada.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {colunas.slice(0, 6).map(coluna => (
            <Link key={coluna.id} href="/kanban" className="rounded-xl border border-white/10 bg-white/[0.025] p-3 transition hover:bg-white/5">
              <div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-medium text-slate-300">{coluna.nome}</p><strong className="text-lg text-cyan-300">{contagem[coluna.id] || 0}</strong></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.min(100, Math.max(8, (contagem[coluna.id] || 0) * 8))}%` }} /></div>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
