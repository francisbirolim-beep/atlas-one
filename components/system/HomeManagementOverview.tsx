'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BriefcaseBusiness, ClipboardCheck, FileText, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/formatacao'

type Indicadores = {
  orcamentos: number
  valorPropostas: number
  clientes: number
  medicoes: number
}

const inicial: Indicadores = { orcamentos: 0, valorPropostas: 0, clientes: 0, medicoes: 0 }

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
    { label: 'Orçamentos', valor: carregando ? '—' : String(dados.orcamentos), detalhe: 'propostas cadastradas', href: '/orcamento/pesquisar', icon: FileText },
    { label: 'Valor em propostas', valor: carregando ? '—' : formatarMoeda(dados.valorPropostas), detalhe: 'volume estimado no Atlas', href: '/kanban', icon: BriefcaseBusiness },
    { label: 'Clientes', valor: carregando ? '—' : String(dados.clientes), detalhe: 'cadastros no sistema', href: '/clientes', icon: Users },
    { label: 'Medições finais', valor: carregando ? '—' : String(dados.medicoes), detalhe: 'processos criados', href: '/producao/medicao-final', icon: ClipboardCheck },
  ]

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 md:px-6 md:pb-10 md:pt-7">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Indicadores centrais</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Resumo da operação</h2>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {cards.map((card, index) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className={`group relative min-h-[142px] p-5 transition hover:bg-slate-50 ${index === 2 ? 'sm:border-t sm:border-slate-200 xl:border-t-0' : ''} ${index === 3 ? 'sm:border-t sm:border-slate-200 xl:border-t-0' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-slate-300 group-hover:bg-white">
                    <Icon size={16} />
                  </div>
                  <ArrowUpRight size={14} className="text-slate-300 transition group-hover:text-slate-600" />
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500">{card.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="truncate text-2xl font-semibold tracking-tight text-slate-950">{card.valor}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{card.detalhe}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
