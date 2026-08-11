'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Download, FileText, Ruler, TrendingUp, WalletCards } from 'lucide-react'
import {
  baixarCsv,
  carregarResumoComercial,
  carregarResumoMedicao,
  FiltroPeriodoRelatorio,
  ResumoComercial,
  ResumoMedicao,
} from '@/lib/relatorios'

const vazioComercial: ResumoComercial = {
  totalOrcamentos: 0,
  valorOrcado: 0,
  aprovados: 0,
  recusados: 0,
  vendidos: 0,
  taxaConversao: 0,
  ticketMedio: 0,
}

const vazioMedicao: ResumoMedicao = {
  totalMedicoes: 0,
  medicoesComItens: 0,
  itensTotal: 0,
  itensMedidos: 0,
  percentualItensMedidos: 0,
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RelatoriosPage() {
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [comercial, setComercial] = useState<ResumoComercial>(vazioComercial)
  const [medicao, setMedicao] = useState<ResumoMedicao>(vazioMedicao)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const filtro: FiltroPeriodoRelatorio = { inicio: inicio || undefined, fim: fim || undefined }
    const [c, m] = await Promise.all([
      carregarResumoComercial(filtro),
      carregarResumoMedicao(filtro),
    ])
    setComercial(c)
    setMedicao(m)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportar() {
    baixarCsv('relatorio-atlas-one.csv', [
      ['Modulo', 'Indicador', 'Valor'],
      ['Comercial', 'Total de orcamentos', comercial.totalOrcamentos],
      ['Comercial', 'Valor orcado', comercial.valorOrcado],
      ['Comercial', 'Vendidos', comercial.vendidos],
      ['Comercial', 'Aprovados', comercial.aprovados],
      ['Comercial', 'Recusados', comercial.recusados],
      ['Comercial', 'Taxa de conversao (%)', comercial.taxaConversao],
      ['Comercial', 'Ticket medio vendido', comercial.ticketMedio],
      ['Medicao Final', 'Total de medicoes', medicao.totalMedicoes],
      ['Medicao Final', 'Medicoes com itens', medicao.medicoesComItens],
      ['Medicao Final', 'Itens totais', medicao.itensTotal],
      ['Medicao Final', 'Itens medidos', medicao.itensMedidos],
      ['Medicao Final', 'Percentual medido (%)', medicao.percentualItensMedidos],
    ])
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-500">
              <BarChart3 size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Gestao</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Central de Relatorios</h1>
            <p className="mt-1 text-sm text-slate-500">Indicadores comerciais e operacionais do Atlas em um unico lugar.</p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              <span className="mb-1 block">De</span>
              <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-slate-500">
              <span className="mb-1 block">Ate</span>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
            <button onClick={carregar} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">Aplicar filtro</button>
            <button onClick={exportar} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              <Download size={15} /> CSV
            </button>
          </div>
        </div>

        {carregando ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">Carregando relatorios...</div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-brand-navy" />
                <h2 className="text-base font-semibold text-slate-900">Comercial</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Indicador titulo="Orcamentos" valor={String(comercial.totalOrcamentos)} />
                <Indicador titulo="Valor orcado" valor={moeda(comercial.valorOrcado)} />
                <Indicador titulo="Vendidos" valor={String(comercial.vendidos)} />
                <Indicador titulo="Conversao" valor={`${comercial.taxaConversao}%`} destaque />
                <Indicador titulo="Aprovados" valor={String(comercial.aprovados)} />
                <Indicador titulo="Recusados" valor={String(comercial.recusados)} />
                <Indicador titulo="Ticket medio vendido" valor={moeda(comercial.ticketMedio)} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Ruler size={18} className="text-brand-navy" />
                <h2 className="text-base font-semibold text-slate-900">Medicao Final</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Indicador titulo="Medicoes criadas" valor={String(medicao.totalMedicoes)} />
                <Indicador titulo="Medicoes com itens" valor={String(medicao.medicoesComItens)} />
                <Indicador titulo="Itens para medir" valor={String(medicao.itensTotal)} />
                <Indicador titulo="Itens medidos" valor={String(medicao.itensMedidos)} />
                <Indicador titulo="Conclusao dos itens" valor={`${medicao.percentualItensMedidos}%`} destaque />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ModuloFuturo icon={TrendingUp} titulo="Vendas / Obras" texto="Entrara automaticamente quando a nova entidade Venda/Obra estiver consolidada." />
              <ModuloFuturo icon={WalletCards} titulo="Financeiro" texto="Recebimentos, saldo, inadimplencia, margem e fluxo de caixa serao adicionados nesta central." />
              <ModuloFuturo icon={BarChart3} titulo="Producao e Instalacao" texto="Lead time, atrasos, produtividade, instalacoes e retrabalho farao parte do mesmo painel." />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Indicador({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? 'border-brand-navy/20 bg-brand-navyLight' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${destaque ? 'text-brand-navy' : 'text-slate-900'}`}>{valor}</p>
    </div>
  )
}

function ModuloFuturo({ icon: Icon, titulo, texto }: { icon: any; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-700"><Icon size={17} /><span className="font-semibold">{titulo}</span></div>
      <p className="mt-2 text-sm text-slate-500">{texto}</p>
    </div>
  )
}
