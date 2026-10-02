'use client'

import Link from 'next/link'
import { Check, LockKeyhole } from 'lucide-react'

type Etapa = 'custos' | 'margem' | 'final' | 'proposta'

const ETAPAS: Array<{ id: Etapa; numero: number; label: string }> = [
  { id: 'custos', numero: 2, label: 'Conferência de custos' },
  { id: 'margem', numero: 3, label: 'Margem e sobra' },
  { id: 'final', numero: 4, label: 'Precificação final' },
  { id: 'proposta', numero: 5, label: 'Proposta' },
]

export default function FluxoPrecificacaoEtapas({
  orcamentoId,
  atual,
  bloqueado,
}: {
  orcamentoId: string
  atual: Etapa
  bloqueado: boolean
}) {
  const atualIndex = ETAPAS.findIndex(etapa => etapa.id === atual)
  const href = (id: Etapa) => {
    if (id === 'custos') return `/orcamento/${orcamentoId}/precificacao?etapa=perfis`
    if (id === 'margem') return `/orcamento/${orcamentoId}/margem-sobra`
    if (id === 'final') return `/orcamento/${orcamentoId}/precificacao-final`
    return `/orcamento/${orcamentoId}/imprimir`
  }

  return (
    <section className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fluxo do orçamento sob medida</p>
          <h2 className="font-bold text-slate-900">1. Dados e tipologias <span className="text-emerald-600">concluído</span></h2>
        </div>
        {bloqueado && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Custos pendentes bloqueiam as próximas telas</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ETAPAS.map((etapa, index) => {
          const ativa = etapa.id === atual
          const concluida = index < atualIndex
          const travada = bloqueado && etapa.id !== 'custos'
          const conteudo = (
            <>
              <span className="flex items-center gap-1 font-bold">
                {travada ? <LockKeyhole size={13}/> : concluida ? <Check size={13}/> : null}
                {etapa.numero}. {etapa.label}
              </span>
              <span className="mt-1 block text-[10px] opacity-70">
                {travada ? 'Resolva os custos para liberar' : ativa ? 'Tela atual' : concluida ? 'Concluída' : 'Próxima etapa'}
              </span>
            </>
          )
          const classes = `rounded-xl border px-3 py-2 text-left text-xs ${ativa
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
            : travada
              ? 'cursor-not-allowed bg-slate-50 text-slate-400'
              : 'bg-white text-slate-600 hover:bg-slate-50'}`
          return travada
            ? <div key={etapa.id} className={classes}>{conteudo}</div>
            : <Link key={etapa.id} href={href(etapa.id)} className={classes}>{conteudo}</Link>
        })}
      </div>
    </section>
  )
}
