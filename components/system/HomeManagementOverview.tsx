'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, ClipboardCheck, FileText, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/formatacao'

type Indicadores = {
  orcamentos: number
  valorPropostas: number
  clientes: number
  medicoes: number
}

const inicial: Indicadores = {
  orcamentos: 0,
  valorPropostas: 0,
  clientes: 0,
  medicoes: 0,
}

export default function HomeManagementOverview() {
  const [dados, setDados] = useState<Indicadores>(inicial)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const [orcamentos, clientes, medicoes] = await Promise.all([
        supabase.from('orcamentos').select('valor_estimado'),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('medicoes_finais').select('id', { count: 'exact', head: true }),
      ])

      if (!ativo) return

      const listaOrcamentos = orcamentos.data || []
      const valorPropostas = listaOrcamentos.reduce((total, item) => {
        const valor = Number(item.valor_estimado || 0)
        return total + (Number.isFinite(valor) ? valor : 0)
      }, 0)

      setDados({
        orcamentos: listaOrcamentos.length,
        valorPropostas,
        clientes: clientes.count || 0,
        medicoes: medicoes.count || 0,
      })
      setCarregando(false)
    }

    carregar()
    return () => { ativo = false }
  }, [])

  const cards = [
    {
      label: 'Orçamentos',
      valor: carregando ? '—' : String(dados.orcamentos),
      detalhe: 'propostas cadastradas',
      href: '/orcamento/pesquisar',
      icon: FileText,
    },
    {
      label: 'Valor em propostas',
      valor: carregando ? '—' : formatarMoeda(dados.valorPropostas),
      detalhe: 'volume estimado no Atlas',
      href: '/kanban',
      icon: BriefcaseBusiness,
    },
    {
      label: 'Clientes',
      valor: carregando ? '—' : String(dados.clientes),
      detalhe: 'cadastros ativos no sistema',
      href: '/clientes',
      icon: Users,
    },
    {
      label: 'Medições finais',
      valor: carregando ? '—' : String(dados.medicoes),
      detalhe: 'processos de medição criados',
      href: '/producao/medicao-final',
      icon: ClipboardCheck,
    },
  ]

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 md:pt-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visão executiva</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Resumo da operação</h2>
        </div>
        <Link href="/relatorios" className="hidden text-sm font-medium text-brand-navy hover:underline sm:inline">
          Ver relatórios
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{card.valor}</p>
                  <p className="mt-1 text-xs text-slate-400">{card.detalhe}</p>
                </div>
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-brand-navy transition group-hover:bg-brand-navy group-hover:text-white">
                  <Icon size={18} />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
