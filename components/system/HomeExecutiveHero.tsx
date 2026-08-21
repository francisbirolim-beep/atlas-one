'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  FilePlus2,
  ImageIcon,
  UserPlus,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, type IdentidadeEmpresa } from '@/lib/configGeral'
import type { DadosEmpresa, Usuario } from '@/lib/tipos'

const COR_PADRAO = '#059669'

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(nome?: string | null) {
  return (nome || '').trim().split(/\s+/)[0] || 'equipe'
}

function corSegura(cor?: string | null) {
  return cor && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : COR_PADRAO
}

type DadosEmpresaHome = DadosEmpresa & IdentidadeEmpresa

export default function HomeExecutiveHero() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [empresa, setEmpresa] = useState<DadosEmpresaHome | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([usuarioAtual(), lerDadosEmpresa()]).then(([u, dadosEmpresa]) => {
      if (!ativo) return
      setUsuario(u)
      setEmpresa(dadosEmpresa)
    })
    return () => { ativo = false }
  }, [])

  const hoje = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  }).format(new Date()), [])

  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Esquadrifácio'
  const corPrincipal = corSegura(empresa?.corPrincipal)

  function novaTarefa() {
    window.dispatchEvent(new Event('atlas:nova-tarefa'))
  }

  function novoCompromisso() {
    window.dispatchEvent(new Event('atlas:novo-compromisso'))
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 md:pt-7">
      <div
        className="atlas-home-hero atlas-brand-hero relative overflow-hidden rounded-2xl border border-emerald-900/20 text-white shadow-sm"
        style={{
          backgroundColor: corPrincipal,
          backgroundImage: `radial-gradient(circle at 88% 18%, rgba(255,255,255,.18), transparent 24%), radial-gradient(circle at 62% 112%, rgba(255,255,255,.10), transparent 28%), linear-gradient(135deg, ${corPrincipal} 0%, ${corPrincipal}E6 58%, #047857 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden="true">
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/30" />
          <div className="absolute -right-6 -top-16 h-64 w-64 rounded-full border border-white/20" />
        </div>

        <div className="relative grid gap-6 px-5 py-6 md:px-7 md:py-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="min-w-0">
            <div className="atlas-home-hero-muted mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-50/80">
              <span className="atlas-home-hero-pill inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-white/90">
                <Building2 size={12} /> {nomeEmpresa}
              </span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} /> {hoje}</span>
            </div>
            <p className="text-sm font-medium text-emerald-50">{saudacao()}, {primeiroNome(usuario?.nome)}.</p>
            <h1 className="atlas-home-hero-title mt-1 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-3xl">Bem-vindo ao Atlas One</h1>
            <p className="atlas-home-hero-muted mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">Visão central da operação: acompanhe prioridades, agenda, tarefas, orçamentos e alertas em um único ambiente.</p>
          </div>

          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-white/45 bg-white/10 p-4 backdrop-blur-sm">
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt={`Logo ${nomeEmpresa}`} className="max-h-24 max-w-full object-contain drop-shadow-sm" />
            ) : (
              <div className="text-center text-white/80">
                <ImageIcon size={26} className="mx-auto mb-2" />
                <p className="text-sm font-semibold">Logo da empresa</p>
                <p className="mt-1 text-[11px] text-white/65">Configure em Empresa e Identidade</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/orcamento-rapido" className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FilePlus2 size={19} /></span>
          <span><strong className="block text-sm text-slate-900">Novo orçamento</strong><span className="mt-0.5 block text-xs text-slate-400">Criar orçamento</span></span>
        </Link>
        <Link href="/clientes/novo" className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UserPlus size={19} /></span>
          <span><strong className="block text-sm text-slate-900">Novo cliente</strong><span className="mt-0.5 block text-xs text-slate-400">Cadastrar cliente</span></span>
        </Link>
        <button type="button" onClick={novaTarefa} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckSquare size={19} /></span>
          <span><strong className="block text-sm text-slate-900">Nova tarefa</strong><span className="mt-0.5 block text-xs text-slate-400">Adicionar tarefa</span></span>
        </button>
        <button type="button" onClick={novoCompromisso} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarPlus size={19} /></span>
          <span><strong className="block text-sm text-slate-900">Novo compromisso</strong><span className="mt-0.5 block text-xs text-slate-400">Agendar compromisso</span></span>
        </button>
      </div>
    </section>
  )
}
