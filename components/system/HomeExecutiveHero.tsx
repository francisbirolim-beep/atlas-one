'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, CalendarDays, CircleCheck, Plus, Sparkles } from 'lucide-react'
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

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 md:pt-7">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 px-5 py-6 md:grid-cols-[1fr_auto] md:px-7 md:py-7">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Building2 size={12} /> Esquadrifácio
              </span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} /> {hoje}</span>
            </div>
            <p className="text-sm font-medium text-emerald-400">{saudacao()}, {primeiroNome(usuario?.nome)}.</p>
            <h1 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-3xl">Visão central da operação</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Acompanhe comercial, medições, produção e prioridades do dia em um único ambiente de gestão.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/orcamento-rapido" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                <Plus size={16} /> Novo orçamento
              </Link>
              <Link href="/producao/medicao-final" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10">
                <CircleCheck size={16} /> Medições finais
              </Link>
              <Link href="/kanban" className="inline-flex h-10 items-center gap-2 px-2 text-sm font-semibold text-slate-300 transition hover:text-white">
                Abrir operação <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="hidden min-w-[230px] self-stretch rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Sparkles size={13} className="text-emerald-400" /> Atlas One
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-100">Centro operacional inteligente</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">A estrutura visual agora segue um padrão único de ERP para todos os módulos.</p>
            <div className="mt-4 h-px bg-white/10" />
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Sistema operacional
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
