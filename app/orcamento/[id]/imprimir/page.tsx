'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Printer, TriangleAlert } from 'lucide-react'
import FluxoPrecificacaoEtapas from '@/components/orcamento/FluxoPrecificacaoEtapas'
import { carregarPrecificacaoOrcamento, type PrecificacaoOrcamento } from '@/lib/orcamentoPrecificacao'

function money(valor: unknown) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

function itemRef(item: any, index: number) {
  return String(item?.id || `item-${index + 1}`)
}

function nomeItem(item: any, index: number) {
  return item?.tipo_outro_texto || item?.configuracao_nome || item?.tipo_esquadria || item?.tipo || `Item ${index + 1}`
}

function medidaItem(item: any) {
  const largura = Number(item?.largura_mm || 0)
  const altura = Number(item?.altura_mm || 0)
  if (!largura || !altura) return '—'
  return `${Math.round(largura)} × ${Math.round(altura)} mm`
}

function relacao<T = any>(valor: T | T[] | null | undefined): T | null {
  return Array.isArray(valor) ? valor[0] || null : valor || null
}

export default function ImprimirOrcamentoPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<PrecificacaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mostrarMedidas, setMostrarMedidas] = useState(true)
  const [mostrarValorUnitario, setMostrarValorUnitario] = useState(false)
  const [mostrarObservacoes, setMostrarObservacoes] = useState(true)

  useEffect(() => {
    if (!orcamentoId) return
    void carregarPrecificacaoOrcamento(orcamentoId).then(resultado => {
      setDados(resultado)
      setCarregando(false)
    })
  }, [orcamentoId])

  const politicas = useMemo(
    () => new Map((dados?.politicas || []).map(p => [p.item_ref, p])),
    [dados?.politicas],
  )

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin" /></div>
  if (!dados) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  const orcamento = dados.orcamento
  const itens: any[] = Array.isArray(orcamento.itens) ? orcamento.itens : []
  const cliente = relacao(orcamento.clientes)
  const obra = relacao(orcamento.obras)
  const nomeCliente = cliente?.nome || orcamento.cliente_nome || 'Cliente'
  const cidade = obra?.cidade || orcamento.obra_cidade || orcamento.cidade || '—'
  const totalVenda = Number(orcamento.valor_estimado || 0)
  const temPendencias = dados.pendencias.length > 0

  if (temPendencias) return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="inline-flex items-center gap-2 text-sm text-slate-500">
          <ArrowLeft size={16} /> Voltar à conferência de custos
        </Link>
        <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="proposta" bloqueado />
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <h1 className="text-lg font-bold text-amber-900">Proposta bloqueada</h1>
              <p className="mt-1 text-sm text-amber-800">Existem {dados.pendencias.length} componente(s) sem custo válido ou com regra técnica pendente. A proposta não pode ser impressa nem enviada até a conferência de custos terminar.</p>
            </div>
          </div>
          <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Resolver custos</Link>
        </section>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-6 print:bg-white print:p-0">
      <style jsx global>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          body { background: #fff !important; color: #0f172a !important; }
          .nao-imprimir { display: none !important; }
          .folha-orcamento { box-shadow: none !important; border: 0 !important; max-width: none !important; }
          .quebra-evitar { break-inside: avoid; }
        }
      `}</style>

      <div className="nao-imprimir mx-auto mb-4 max-w-5xl"><FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="proposta" bloqueado={false} /></div>
      <div className="nao-imprimir mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-sm">
        <Link href={`/orcamento/${orcamentoId}/precificacao-final`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ArrowLeft size={16} /> Voltar ao cálculo
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={mostrarMedidas} onChange={e => setMostrarMedidas(e.target.checked)} /> Com medida</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={mostrarValorUnitario} onChange={e => setMostrarValorUnitario(e.target.checked)} /> Com valor unitário</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={mostrarObservacoes} onChange={e => setMostrarObservacoes(e.target.checked)} /> Com observações</label>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
            <Printer size={16} /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <article className="folha-orcamento mx-auto max-w-5xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        <header className="flex items-start justify-between gap-5 border-b border-slate-300 pb-5">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-mark.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">ESQUADRIFÁCIO SOLUÇÕES EM ALUMÍNIO</h1>
              <p className="mt-0.5 text-xs text-slate-500">Esquadrias de alumínio sob medida</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Orçamento</p>
            <p className="text-xl font-bold text-slate-900">#{orcamento.numero || '—'}</p>
            <p className="text-xs text-slate-500">{dataBR(orcamento.created_at)}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-3 border-b border-slate-200 pb-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[10px] uppercase text-slate-400">Cliente</p><p className="font-semibold text-slate-800">{nomeCliente}</p></div>
          <div><p className="text-[10px] uppercase text-slate-400">Obra</p><p className="font-semibold text-slate-800">{obra?.nome || '—'}</p></div>
          <div><p className="text-[10px] uppercase text-slate-400">Cidade</p><p className="font-semibold text-slate-800">{cidade}</p></div>
          <div><p className="text-[10px] uppercase text-slate-400">Validade</p><p className="font-semibold text-slate-800">7 dias</p></div>
        </section>

        {temPendencias && (
          <section className="nao-imprimir mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-2"><TriangleAlert size={18} className="mt-0.5 shrink-0" /><div><b>Orçamento com pendências técnicas/custos.</b><p className="mt-1 text-xs">Revise a composição antes de enviar ao cliente.</p></div></div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Itens do orçamento</h2>
          <div className="space-y-3">
            {itens.map((item, index) => {
              const ref = itemRef(item, index)
              const politica: any = politicas.get(ref) || {}
              const quantidade = Math.max(1, Number(item.quantidade || 1))
              const totalItem = Number(politica.preco_venda || 0)
              const unitario = quantidade > 0 ? totalItem / quantidade : totalItem
              const variaveis = item?.variaveis && typeof item.variaveis === 'object' ? item.variaveis : {}
              const linha = item?.linha_nome || item?.linhaNome || ''
              const cor = item?.cor || orcamento.acabamento_outro_texto || orcamento.acabamento || ''
              const obs = [item?.descricao, item?.observacao_producao].filter(Boolean).join(' · ')

              return (
                <div key={ref} className="quebra-evitar overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid gap-4 p-4 sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:items-start">
                    <div className="flex h-20 w-[90px] items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
                      {item?.foto_url ? <img src={item.foto_url} alt="" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[10px] text-slate-400">Projeto {index + 1}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-bold text-slate-900">{quantidade}x {nomeItem(item, index)}</p>
                        {linha && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{linha}</span>}
                      </div>
                      <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
                        {mostrarMedidas && <p><b>Medida:</b> {medidaItem(item)}</p>}
                        {item?.ambiente && <p><b>Ambiente:</b> {item.ambiente}</p>}
                        {cor && <p><b>Cor:</b> {String(cor).replaceAll('_', ' ')}</p>}
                        {item?.folhas && <p><b>Folhas:</b> {item.folhas}</p>}
                        {variaveis.vidro && <p><b>Vidro:</b> {String(variaveis.vidro).replaceAll('_', ' ')}</p>}
                        {item?.contramarco && <p><b>Contramarco:</b> {item.contramarco === 'com' ? 'Sim' : 'Não'}</p>}
                      </div>
                      {mostrarObservacoes && obs && <p className="mt-2 text-xs text-slate-500"><b>Observação:</b> {obs}</p>}
                    </div>
                    <div className="text-right">
                      {mostrarValorUnitario && <p className="text-xs text-slate-500">Unitário {money(unitario)}</p>}
                      <p className="mt-1 text-base font-bold text-slate-900">{money(totalItem)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-6 flex justify-end border-t border-slate-300 pt-5">
          <div className="w-full max-w-sm rounded-xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between text-sm"><span>Valor total</span><strong className="text-xl">{money(totalVenda)}</strong></div>
          </div>
        </section>

        {(orcamento.condicoes || orcamento.observacoes) && (
          <section className="quebra-evitar mt-6 grid gap-3 sm:grid-cols-2">
            {orcamento.condicoes && <div className="rounded-xl border p-4"><p className="text-[10px] uppercase text-slate-400">Condições</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{orcamento.condicoes}</p></div>}
            {orcamento.observacoes && <div className="rounded-xl border p-4"><p className="text-[10px] uppercase text-slate-400">Observações</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{orcamento.observacoes}</p></div>}
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[10px] leading-relaxed text-slate-400">
          Proposta comercial emitida pelo Atlas One · Esquadrifácio Soluções em Alumínio.
        </footer>
      </article>
    </main>
  )
}