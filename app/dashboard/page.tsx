'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, CheckCircle2, FileText, Gauge, Ruler, TrendingUp, XCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/formatacao'
import MetricCard from '@/components/system/MetricCard'
import SystemCard from '@/components/system/SystemCard'
import SectionHeader from '@/components/system/SectionHeader'
import PageHeader from '@/components/system/PageHeader'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    aprovados: 0,
    recusados: 0,
    valorTotal: 0,
    taxaConversao: 0,
    medicoes: 0,
    medicoesComItens: 0,
  })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const [{ data: orcamentos }, { data: medicoes }] = await Promise.all([
      supabase.from('orcamentos').select('valor_estimado, status'),
      supabase.from('medicoes_finais').select('id, medicao_itens(id)'),
    ])

    const listaOrcamentos = orcamentos || []
    const listaMedicoes = medicoes || []
    const total = listaOrcamentos.length
    const aprovados = listaOrcamentos.filter(o => o.status === 'aprovado' || o.status === 'convertido').length
    const recusados = listaOrcamentos.filter(o => o.status === 'recusado').length
    const valorTotal = listaOrcamentos.reduce((s, o) => s + (o.valor_estimado || 0), 0)
    const taxaConversao = total > 0 ? (aprovados / total) * 100 : 0
    const medicoesComItens = listaMedicoes.filter((m: any) => Array.isArray(m.medicao_itens) && m.medicao_itens.length > 0).length

    setStats({
      total,
      aprovados,
      recusados,
      valorTotal,
      taxaConversao,
      medicoes: listaMedicoes.length,
      medicoesComItens,
    })
    setCarregando(false)
  }

  if (carregando) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Carregando visão executiva...</div>
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard Executivo"
        description="Acompanhe vendas, conversão, medições e os principais indicadores operacionais do Atlas em uma única visão."
        actions={(
          <Link href="/relatorios" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <BarChart3 size={16} /> Abrir relatórios
          </Link>
        )}
      />

      <section>
        <SectionHeader title="Comercial" description="Indicadores consolidados dos orçamentos registrados no Atlas." />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Orçamentos" value={formatarNumero(stats.total)} helper="Total registrado" icon={FileText} />
          <MetricCard label="Aprovados" value={formatarNumero(stats.aprovados)} helper="Aprovados ou convertidos" icon={CheckCircle2} />
          <MetricCard label="Conversão" value={formatarPercentual(stats.taxaConversao, 1)} helper="Sobre o total de orçamentos" icon={TrendingUp} />
          <MetricCard label="Recusados" value={formatarNumero(stats.recusados)} helper="Oportunidades perdidas" icon={XCircle} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SystemCard>
          <SectionHeader title="Resumo comercial" description="Volume financeiro atualmente registrado em propostas." />
          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor em orçamentos</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{formatarMoeda(stats.valorTotal)}</p>
              <p className="mt-1 text-sm text-slate-500">Este valor representa propostas emitidas, não necessariamente faturamento realizado.</p>
            </div>
            <Link href="/kanban" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950">
              Ver painel comercial <ArrowRight size={16} />
            </Link>
          </div>
        </SystemCard>

        <SystemCard>
          <SectionHeader title="Medição Final" description="Situação da preparação técnica das vendas." />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-500"><Ruler size={16} /><span className="text-xs font-medium">Medições</span></div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatarNumero(stats.medicoes)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-500"><Gauge size={16} /><span className="text-xs font-medium">Com itens</span></div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatarNumero(stats.medicoesComItens)}</p>
            </div>
          </div>
          <Link href="/producao/medicao-final" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950">
            Abrir Medição Final <ArrowRight size={16} />
          </Link>
        </SystemCard>
      </section>

      <SystemCard>
        <SectionHeader title="Próxima evolução" description="O Dashboard já está preparado para receber dados da nova entidade Venda/Obra." />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['Obras em andamento', 'Entrará com a estrutura Venda/Obra.'],
            ['Financeiro real', 'Recebido, saldo, inadimplência e previsão.'],
            ['Produção e instalação', 'Prazos, gargalos, atrasos e capacidade.'],
          ].map(([titulo, descricao]) => (
            <div key={titulo} className="rounded-xl border border-dashed border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-700">{titulo}</p>
              <p className="mt-1 text-xs text-slate-500">{descricao}</p>
            </div>
          ))}
        </div>
      </SystemCard>
    </main>
  )
}
