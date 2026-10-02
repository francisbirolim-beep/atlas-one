'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, Printer, TriangleAlert } from 'lucide-react'
import FluxoPrecificacaoEtapas from '@/components/orcamento/FluxoPrecificacaoEtapas'
import { carregarPrecificacaoOrcamento, type PrecificacaoOrcamento } from '@/lib/orcamentoPrecificacao'

function money(v: unknown) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function itemRef(item: any, index: number) {
  return String(item?.id || `item-${index + 1}`)
}
function itemLabel(item: any, index: number) {
  const nome = item?.tipo_outro_texto || item?.configuracao_nome || item?.tipo_esquadria || item?.tipo || `Item ${index + 1}`
  return item?.ambiente ? `${item.ambiente} · ${nome}` : nome
}

const EXTRAS = new Set(['mao_obra','instalacao','deslocamento','frete','pintura','terceiro','consumivel','outro'])

export default function PrecificacaoFinalPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<PrecificacaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!orcamentoId) return
    void carregarPrecificacaoOrcamento(orcamentoId).then(d => { setDados(d); setCarregando(false) })
  }, [orcamentoId])

  const itens = Array.isArray(dados?.orcamento?.itens) ? dados!.orcamento.itens : []
  const politicas = useMemo(() => new Map((dados?.politicas || []).map(p => [p.item_ref, p])), [dados?.politicas])
  const bloqueado = Boolean(dados?.pendencias?.length)

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin"/></div>
  if (!dados) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  const componentesGlobais = dados.componentes.filter(c => !c.item_ref)
  const custoGlobal = componentesGlobais.reduce((s, c) => s + Number(c.custo_total || 0), 0)
  const totalItens = dados.politicas.reduce((s, p) => s + Number(p.custo_total || 0), 0)
  const totalCusto = totalItens + custoGlobal
  const totalVenda = Number(dados.orcamento.valor_estimado || 0)
  const margemReal = totalVenda > 0 ? (1 - totalCusto / totalVenda) * 100 : 0

  if (bloqueado) return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-6xl space-y-5">
    <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar à conferência de custos</Link>
    <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="final" bloqueado />
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 text-amber-700"/><div><h1 className="text-lg font-bold text-amber-900">Precificação final bloqueada</h1><p className="mt-1 text-sm text-amber-800">Ainda existem {dados.pendencias.length} pendência(s) de custo. A proposta não pode ser finalizada antes da conferência completa.</p></div></div><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Resolver custos</Link></section>
  </div></main>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/orcamento/${orcamentoId}/margem-sobra`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Margem e sobra</Link><h1 className="text-2xl font-bold text-slate-900">Precificação Final</h1><p className="text-sm text-slate-500">Consolidação dos custos validados, margem, sobra e preço de venda por tipologia.</p></div><div className="flex flex-wrap gap-2"><Link href={`/orcamento/${orcamentoId}/materiais`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><FileText size={16}/> Lista de materiais</Link><Link href={`/orcamento/${orcamentoId}/imprimir`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Printer size={16}/> Abrir proposta</Link></div></header>
    <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="final" bloqueado={false}/>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Custo total</p><p className="mt-1 text-xl font-bold">{money(totalCusto)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Sobra cobrada</p><p className="mt-1 text-xl font-bold">{money(dados.orcamento.custo_sobra_cobrada)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Preço total</p><p className="mt-1 text-xl font-bold text-emerald-700">{money(totalVenda)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Margem estimada</p><p className="mt-1 text-xl font-bold">{margemReal.toLocaleString('pt-BR', {maximumFractionDigits:2})}%</p></div>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="border-b px-5 py-4"><h2 className="font-bold text-slate-900">Tipologias do orçamento</h2><p className="text-xs text-slate-500">Custo técnico e decisão comercial permanecem separados no fechamento.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Tipologia</th><th className="px-4 py-3">Custo produtivo</th><th className="px-4 py-3">Acréscimos</th><th className="px-4 py-3">Sobra</th><th className="px-4 py-3">Margem</th><th className="px-4 py-3">Venda</th></tr></thead><tbody className="divide-y">
        {itens.map((item: any, index: number) => {
          const ref = itemRef(item, index)
          const p: any = politicas.get(ref) || {}
          const componentes = dados.componentes.filter(c => c.item_ref === ref)
          const extras = componentes.filter(c => EXTRAS.has(c.categoria)).reduce((s, c) => s + Number(c.custo_total || 0), 0)
          const margem = p.margem_herda_geral === false ? p.margem_pct : dados.orcamento.margem_padrao_pct
          return <tr key={ref}><td className="px-4 py-3"><b className="text-slate-800">{itemLabel(item, index)}</b><p className="text-[11px] text-slate-400">{item?.linha_nome || item?.linhaNome || ''}</p></td><td className="px-4 py-3">{money(p.custo_produtivo)}</td><td className="px-4 py-3">{money(extras || p.custo_extras)}</td><td className="px-4 py-3">{money(p.custo_sobra)}</td><td className="px-4 py-3">{Number(margem || 0).toLocaleString('pt-BR', {maximumFractionDigits:2})}%</td><td className="px-4 py-3 font-bold text-emerald-700">{money(p.preco_venda)}</td></tr>
        })}
        {componentesGlobais.length > 0 && <tr className="bg-slate-50"><td className="px-4 py-3 font-semibold">Custos gerais do orçamento</td><td className="px-4 py-3">{money(custoGlobal)}</td><td className="px-4 py-3">—</td><td className="px-4 py-3">—</td><td className="px-4 py-3">{Number(dados.orcamento.margem_padrao_pct || 0).toLocaleString('pt-BR', {maximumFractionDigits:2})}%</td><td className="px-4 py-3">Incluído no total</td></tr>}
      </tbody></table></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-slate-900">Aproveitamento de barras</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3">Barras novas<b className="block text-xl">{dados.barras.filter(b => b.fonte_tipo === 'barra_nova').length}</b></div><div className="rounded-xl bg-slate-50 p-3">Sobras reutilizadas<b className="block text-xl">{dados.barras.filter(b => b.fonte_tipo === 'sobra_estoque').length}</b></div><div className="rounded-xl bg-slate-50 p-3">Sobra total<b className="block text-xl">{Math.round(dados.barras.reduce((s,b) => s + Number(b.sobra_final_mm || 0), 0))} mm</b></div><div className="rounded-xl bg-slate-50 p-3">Peças de corte<b className="block text-xl">{dados.cortes.length}</b></div></div></div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-slate-900">Fechamento</h2><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>Custo otimizado</span><b>{money(dados.orcamento.custo_otimizado)}</b></div><div className="flex justify-between"><span>Sobra repassada a custo</span><b>{money(dados.orcamento.custo_sobra_cobrada)}</b></div><div className="flex justify-between border-t pt-3 text-lg"><span>Preço final</span><b className="text-emerald-700">{money(totalVenda)}</b></div></div><p className="mt-3 text-xs text-slate-500">A simulação não reserva estoque. A reserva física acontece após a venda e conferência do projeto.</p></div>
    </section>

    <section className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><Link href={`/orcamento/${orcamentoId}/margem-sobra`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Voltar: Margem e sobra</Link><span className="text-xs text-slate-500">Valores consolidados e liberados para proposta.</span><Link href={`/orcamento/${orcamentoId}/imprimir`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Printer size={16}/> Continuar: Proposta</Link></section>
  </div></main>
}

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]