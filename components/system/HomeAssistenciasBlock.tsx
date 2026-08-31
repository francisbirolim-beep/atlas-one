'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Plus, User, Wrench } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { EscopoAssistencias } from '@/lib/homeUsuario'
import type { Assistencia } from '@/lib/tipos'

export default function HomeAssistenciasBlock({ escopo }: { escopo: EscopoAssistencias }) {
  const [assistencias, setAssistencias] = useState<Assistencia[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async usuario => {
      if (!usuario) { if (ativo) setCarregando(false); return }

      let query = supabase
        .from('assistencias')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(3)

      if (usuario.role !== 'master' && escopo !== 'todas') query = query.eq('criado_por_id', usuario.id)

      const { data, count } = await query
      if (!ativo) return
      setAssistencias((data as Assistencia[]) || [])
      setTotal(count || 0)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [escopo])

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2"><Wrench size={17} className="mt-0.5 text-amber-300" /><div><h2 className="font-semibold">Assistências</h2><p className="text-xs text-slate-500">{escopo === 'todas' ? 'Todas as assistências liberadas para este usuário.' : 'Somente os chamados abertos por este usuário.'}</p></div></div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">{total} chamado(s)</span>
      </div>

      <div className="space-y-2">
        {carregando ? <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Carregando assistências...</p> : assistencias.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Nenhum chamado encontrado.</p>
        ) : assistencias.map(a => (
          <Link key={a.id} href="/assistencias" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 transition hover:bg-white/5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300"><Wrench size={15}/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{a.cliente_nome}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{a.descricao_problema || 'Sem descrição informada'}{a.cidade ? ` · ${a.cidade}` : ''}</p></div>
            {a.criado_por_nome && <span className="hidden shrink-0 items-center gap-1 text-[10px] text-slate-600 sm:flex"><User size={10}/>{a.criado_por_nome}</span>}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/assistencia" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"><Plus size={13}/> Nova assistência</Link>
        <Link href="/assistencias" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">Abrir Kanban <ArrowUpRight size={13}/></Link>
      </div>
    </article>
  )
}
