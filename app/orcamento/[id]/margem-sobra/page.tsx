'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, ChevronRight, Loader2, Save, TriangleAlert } from 'lucide-react'
import FluxoPrecificacaoEtapas from '@/components/orcamento/FluxoPrecificacaoEtapas'
import {
  carregarPrecificacaoOrcamento,
  salvarPoliticaGeral,
  salvarPoliticaItem,
  type PrecificacaoOrcamento,
} from '@/lib/orcamentoPrecificacao'

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

export default function MargemSobraPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<PrecificacaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [margemGeral, setMargemGeral] = useState('40')
  const [sobraGeral, setSobraGeral] = useState(false)

  async function carregar() {
    setCarregando(true)
    const d = await carregarPrecificacaoOrcamento(orcamentoId)
    setDados(d)
    if (d) {
      setMargemGeral(String(d.orcamento.margem_padrao_pct ?? 40))
      setSobraGeral(Boolean(d.orcamento.cobrar_sobra_padrao))
    }
    setCarregando(false)
  }

  useEffect(() => { if (orcamentoId) void carregar() }, [orcamentoId])
  const itens = Array.isArray(dados?.orcamento?.itens) ? dados!.orcamento.itens : []
  const politicas = useMemo(() => new Map((dados?.politicas || []).map(p => [p.item_ref, p])), [dados?.politicas])
  const bloqueado = Boolean(dados?.pendencias?.length)

  async function salvarGeral() {
    setOcupado(true); setErro(''); setMensagem('')
    const r = await salvarPoliticaGeral(orcamentoId, Number(margemGeral.replace(',', '.')) || 0, sobraGeral)
    setOcupado(false)
    if (!r.ok) return setErro(r.error)
    setMensagem('Margem geral e regra de sobra atualizadas.')
    await carregar()
  }

  async function salvarItem(ref: string, patch: any) {
    setOcupado(true); setErro(''); setMensagem('')
    const r = await salvarPoliticaItem(orcamentoId, ref, patch)
    setOcupado(false)
    if (!r.ok) return setErro(r.error)
    await carregar()
  }

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin"/></div>
  if (!dados) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  if (bloqueado) return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-6xl space-y-5">
    <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar à conferência de custos</Link>
    <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="margem" bloqueado />
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 text-amber-700"/><div><h1 className="text-lg font-bold text-amber-900">Margem e sobra bloqueadas</h1><p className="mt-1 text-sm text-amber-800">Existem {dados.pendencias.length} componente(s) sem custo válido ou com regra técnica pendente. Resolva todos antes de aplicar decisões comerciais.</p></div></div>
      <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Resolver custos</Link>
    </section>
  </div></main>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Conferência de custos</Link><h1 className="text-2xl font-bold text-slate-900">Margem e Sobra</h1><p className="text-sm text-slate-500">Todos os custos técnicos foram validados. Agora entram somente as decisões comerciais.</p></div>
      <button disabled={ocupado} onClick={() => void salvarGeral()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/> Salvar política geral</button>
    </header>
    <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="margem" bloqueado={false}/>
    {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>}

    <section className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Margem geral (%)<input value={margemGeral} onChange={e => setMargemGeral(e.target.value)} inputMode="decimal" className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/></label>
      <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={sobraGeral} onChange={e => setSobraGeral(e.target.checked)}/> Cobrar sobra por padrão no projeto</label>
    </section>

    <section className="space-y-3">
      <div><h2 className="font-bold text-slate-900">Decisão por tipologia</h2><p className="text-xs text-slate-500">Cada item herda a regra geral, mas pode ter margem e sobra próprias.</p></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {itens.map((item: any, index: number) => {
          const ref = itemRef(item, index)
          const p: any = politicas.get(ref) || {}
          const margemEfetiva = p.margem_herda_geral === false ? p.margem_pct : dados.orcamento.margem_padrao_pct
          const sobraEfetiva = p.sobra_herda_geral === false ? Boolean(p.cobrar_sobra) : Boolean(dados.orcamento.cobrar_sobra_padrao)
          return <article key={ref} className="rounded-2xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{itemLabel(item, index)}</h3><p className="mt-1 text-xs text-slate-500">Custo validado: {money(p.custo_total)}</p></div><div className="text-right"><p className="text-[10px] uppercase text-slate-400">Venda atual</p><b className="text-emerald-700">{money(p.preco_venda)}</b></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={p.margem_herda_geral !== false} onChange={e => void salvarItem(ref, { margem_herda_geral: e.target.checked })}/> Usar margem geral</label>{p.margem_herda_geral === false && <input defaultValue={p.margem_pct ?? dados.orcamento.margem_padrao_pct} onBlur={e => void salvarItem(ref, { margem_pct: Number(e.target.value.replace(',', '.')) || 0 })} className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"/>}<p className="mt-2 text-[11px] text-slate-500">Aplicada: {Number(margemEfetiva || 0).toLocaleString('pt-BR', {maximumFractionDigits:2})}%</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={p.sobra_herda_geral !== false} onChange={e => void salvarItem(ref, { sobra_herda_geral: e.target.checked })}/> Usar regra geral de sobra</label>{p.sobra_herda_geral === false && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(p.cobrar_sobra)} onChange={e => void salvarItem(ref, { cobrar_sobra: e.target.checked })}/> Cobrar sobra deste item</label>}<p className="mt-2 text-[11px] text-slate-500">Sobra: {sobraEfetiva ? 'cobrada' : 'não cobrada'} · {money(p.custo_sobra)}</p></div>
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Voltar aos custos</Link><span className="text-xs text-slate-500">Custos técnicos separados das decisões comerciais.</span><Link href={`/orcamento/${orcamentoId}/precificacao-final`} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Continuar: Precificação final <ChevronRight size={16}/></Link></section>
  </div></main>
}
