'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, CalendarDays, CalendarPlus, CheckSquare, FilePlus2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(nome?: string | null) {
  return (nome || '').trim().split(/\s+/)[0] || 'equipe'
}

export default function HomeExecutiveHero() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  const hoje = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  }).format(new Date()), [])

  function novaTarefa() {
    window.dispatchEvent(new Event('atlas:nova-tarefa'))
  }

  function novoCompromisso() {
    window.dispatchEvent(new Event('atlas:novo-compromisso'))
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 md:pt-7">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 px-5 py-6 md:grid-cols-[1fr_auto] md:px-7 md:py-7">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Building2 size={12} /> Esquadrifácio
              </span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} /> {hoje}</span>
            </div>
            <p className="text-sm font-medium text-emerald-400">{saudacao()}, {primeiroNome(usuario?.nome)}.</p>
            <h1 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-3xl">Visão central da operação</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Acompanhe prioridades, agenda, tarefas e alertas em um único ambiente de gestão.</p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto md:min-w-[560px] md:self-end">
            <Link href="/orcamento-rapido" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-950/20 transition hover:bg-emerald-500">
              <FilePlus2 size={17} /> Novo orçamento
            </Link>
            <button type="button" onClick={novaTarefa} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
              <CheckSquare size={16} /> Nova tarefa
            </button>
            <button type="button" onClick={novoCompromisso} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
              <CalendarPlus size={16} /> Novo compromisso
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
