'use client'

import Link from 'next/link'
import { ArrowRight, FilePlus2, Gauge, Search, Workflow } from 'lucide-react'

const ACOES = [
  {
    href: '/orcamento/novo',
    titulo: 'Novo orçamento',
    descricao: 'Monte uma proposta completa com os dados técnicos e comerciais do cliente.',
    detalhe: 'Orçamento detalhado',
    icon: FilePlus2,
    destaque: true,
  },
  {
    href: '/orcamento-rapido',
    titulo: 'Orçamento rápido',
    descricao: 'Registre uma oportunidade em poucos minutos para continuar depois.',
    detalhe: 'Atendimento em campo',
    icon: Gauge,
  },
  {
    href: '/orcamento/pesquisar',
    titulo: 'Pesquisar orçamentos',
    descricao: 'Localize propostas por cliente, cidade, número ou período.',
    detalhe: 'Consulta e histórico',
    icon: Search,
  },
  {
    href: '/kanban',
    titulo: 'Pipeline comercial',
    descricao: 'Acompanhe cada orçamento por etapa, responsável e situação da negociação.',
    detalhe: 'Kanban de vendas',
    icon: Workflow,
  },
]

export default function OrcamentoHub() {
  return (
    <div className="min-h-screen bg-transparent">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Comercial · Orçamentos</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Central de orçamentos</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Crie propostas, consulte o histórico e acompanhe o avanço das negociações em um único fluxo.
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {ACOES.map(acao => {
            const Icon = acao.icon
            return (
              <Link
                key={acao.href}
                href={acao.href}
                className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
                  acao.destaque
                    ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${acao.destaque ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <Icon size={19} />
                  </span>
                  <ArrowRight size={17} className="mt-1 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
                </div>
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{acao.detalhe}</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">{acao.titulo}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{acao.descricao}</p>
                </div>
              </Link>
            )
          })}
        </section>
      </main>
    </div>
  )
}
