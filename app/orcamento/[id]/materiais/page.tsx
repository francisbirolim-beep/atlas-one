'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, FileText, Loader2, Printer, TriangleAlert } from 'lucide-react'
import {
  carregarListaMateriaisOrcamento,
  type GrupoMaterialOrcamento,
  type LinhaMaterialOrcamento,
  type ListaMateriaisOrcamento,
} from '@/lib/listaMateriaisOrcamento'

type Modo = 'individual' | 'consolidada'
type Filtro = 'todos' | GrupoMaterialOrcamento

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'perfis', label: 'Perfis' },
  { id: 'acessorios', label: 'Acessórios' },
  { id: 'vidros', label: 'Vidros' },
  { id: 'outros', label: 'Outros' },
]

function n(valor: unknown) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

function qtd(valor: unknown) {
  return n(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function mm(valor?: number | null) {
  return valor == null ? '—' : `${Math.round(n(valor)).toLocaleString('pt-BR')} mm`
}

function relacao(valor: any) {
  return Array.isArray(valor) ? valor[0] : valor
}

function nomeGrupo(grupo: GrupoMaterialOrcamento) {
  return grupo === 'perfis' ? 'Perfis' : grupo === 'acessorios' ? 'Acessórios' : grupo === 'vidros' ? 'Vidros' : 'Outros'
}

function TabelaMateriais({ linhas, consolidada }: { linhas: LinhaMaterialOrcamento[]; consolidada: boolean }) {
  if (linhas.length === 0) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-400">Nenhum material neste filtro.</p>

  return <div className="overflow-x-auto rounded-xl border print:overflow-visible print:rounded-none print:border-slate-400">
    <table className="w-full min-w-[820px] border-collapse text-left text-sm print:min-w-0 print:text-[10.5pt]">
      <thead className="bg-slate-100 print:bg-white">
        <tr>
          <th className="border-b px-3 py-2">Grupo</th>
          <th className="border-b px-3 py-2">Código</th>
          <th className="border-b px-3 py-2">Descrição</th>
          <th className="border-b px-3 py-2">Cor</th>
          <th className="border-b px-3 py-2 text-right">Qtd.</th>
          <th className="border-b px-3 py-2">Un.</th>
          <th className="border-b px-3 py-2">Corte</th>
          {consolidada && <th className="border-b px-3 py-2">Origem</th>}
          <th className="border-b px-3 py-2">Situação</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(linha => <tr key={linha.chave} className="align-top print:break-inside-avoid">
          <td className="border-b px-3 py-2">{nomeGrupo(linha.grupo)}</td>
          <td className="border-b px-3 py-2 font-mono text-xs print:text-[9.5pt]">{linha.codigo || '—'}</td>
          <td className="border-b px-3 py-2">
            <div className="font-medium">{linha.descricao}</div>
            {linha.justificativa && <div className="mt-1 text-xs text-slate-500 print:text-[9pt]">{linha.justificativa}</div>}
          </td>
          <td className="border-b px-3 py-2">{linha.cor_ref || '—'}</td>
          <td className="border-b px-3 py-2 text-right font-semibold">{qtd(linha.quantidade)}</td>
          <td className="border-b px-3 py-2">{linha.unidade}</td>
          <td className="border-b px-3 py-2">{mm(linha.comprimento_corte_mm)}</td>
          {consolidada && <td className="border-b px-3 py-2 text-xs print:text-[9pt]">{linha.origens.map(origem => <div key={origem.item_ref}>{origem.label} · {qtd(origem.quantidade)} {linha.unidade}</div>)}</td>}
          <td className="border-b px-3 py-2">
            {linha.status_calculo === 'pendente_formula'
              ? <span className="font-bold text-amber-700">PENDENTE TÉCNICO</span>
              : linha.incluido_manual
                ? <span className="font-semibold text-blue-700">MANUAL</span>
                : <span className="font-semibold text-emerald-700">CALCULADO</span>}
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>
}

export default function ListaMateriaisOrcamentoPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<ListaMateriaisOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modo, setModo] = useState<Modo>('individual')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    if (!orcamentoId) return
    void carregarListaMateriaisOrcamento(orcamentoId).then(resultado => {
      setDados(resultado)
      setCarregando(false)
    })
  }, [orcamentoId])

  const linhas = useMemo(() => {
    const base = modo === 'individual' ? dados?.individual || [] : dados?.consolidada || []
    return filtro === 'todos' ? base : base.filter(linha => linha.grupo === filtro)
  }, [dados, filtro, modo])

  const gruposIndividuais = useMemo(() => {
    const mapa = new Map<string, LinhaMaterialOrcamento[]>()
    if (modo !== 'individual') return mapa
    for (const linha of linhas) {
      const ref = linha.origens[0]?.item_ref || 'sem-tipologia'
      const lista = mapa.get(ref) || []
      lista.push(linha)
      mapa.set(ref, lista)
    }
    return mapa
  }, [linhas, modo])

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin" /></div>
  if (!dados) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  const cliente = relacao(dados.orcamento.clientes)?.nome || dados.orcamento.cliente_nome || 'Cliente'
  const obra = relacao(dados.orcamento.obras)
  const cidade = obra?.cidade || dados.orcamento.obra_cidade || dados.orcamento.cidade || '—'
  const filtroLabel = FILTROS.find(item => item.id === filtro)?.label || 'Todos'

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7 print:bg-white print:p-0">
    <style jsx global>{`
      @page { size: A4 portrait; margin: 12mm; }
      @media print {
        body { background: white !important; color: #0f172a !important; }
        .nao-imprimir { display: none !important; }
        .folha-impressao { max-width: none !important; width: 100% !important; }
        table { page-break-inside: auto; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      }
    `}</style>

    <div className="folha-impressao mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <Link href={`/orcamento/${orcamentoId}/precificacao`} className="nao-imprimir mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} /> Voltar para composição</Link>
          <div className="flex items-center gap-3"><Boxes className="nao-imprimir text-amber-600" /><div><h1 className="text-2xl font-bold text-slate-900">Lista de Materiais — Cotação</h1><p className="text-sm text-slate-500">Sem margem, desconto ou preço de venda.</p></div></div>
        </div>
        <button onClick={() => window.print()} className="nao-imprimir inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Printer size={16} /> Imprimir / Salvar PDF</button>
      </header>

      <section className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5 print:border-slate-400 print:text-[10.5pt]">
        <div><p className="text-xs uppercase text-slate-400">Cliente</p><p className="font-semibold">{cliente}</p></div>
        <div><p className="text-xs uppercase text-slate-400">Obra</p><p className="font-semibold">{obra?.nome || '—'}</p></div>
        <div><p className="text-xs uppercase text-slate-400">Cidade</p><p className="font-semibold">{cidade}</p></div>
        <div><p className="text-xs uppercase text-slate-400">Orçamento</p><p className="font-semibold">#{dados.orcamento.numero || '—'}</p></div>
        <div><p className="text-xs uppercase text-slate-400">Pacote técnico</p><p className="font-semibold">{dados.pacote ? `v${dados.pacote.versao}` : 'Não gerado'}</p></div>
      </section>

      {!dados.pacote ? <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 shrink-0" /><div><h2 className="font-bold">Lista ainda não disponível</h2><p className="mt-1 text-sm">Este orçamento ainda não possui pacote técnico. Gere/recalcule a Composição e Precificação antes de emitir a lista. Nenhum material foi inferido.</p></div></div></section> : <>
        {dados.pendencias > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 print:border-2"><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 shrink-0" size={18} /><div><b>PRÉVIA — existem {dados.pendencias} pendência(s) técnica(s).</b><div>Linhas pendentes permanecem identificadas e não devem ser tratadas como material definitivo.</div></div></div></section>}

        <section className="nao-imprimir flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button onClick={() => setModo('individual')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${modo === 'individual' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Por tipologia</button>
            <button onClick={() => setModo('consolidada')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${modo === 'consolidada' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Consolidada</button>
          </div>
          <div className="flex flex-wrap gap-1">{FILTROS.map(item => <button key={item.id} onClick={() => setFiltro(item.id)} className={`rounded-lg px-3 py-1.5 text-sm ${filtro === item.id ? 'bg-slate-900 font-semibold text-white' : 'border bg-white text-slate-600'}`}>{item.label}</button>)}</div>
        </section>

        <div className="hidden text-sm print:block"><b>Visualização:</b> {modo === 'individual' ? 'por tipologia' : 'consolidada'} · <b>Filtro:</b> {filtroLabel}</div>

        {modo === 'consolidada' ? <section className="space-y-3"><div className="flex items-center gap-2"><FileText size={18} /><h2 className="text-lg font-bold">Materiais consolidados</h2></div><TabelaMateriais linhas={linhas} consolidada /></section> : <div className="space-y-6">{Array.from(gruposIndividuais.entries()).map(([ref, lista], indice) => <section key={ref} className="space-y-3 print:break-before-auto"><div><p className="text-xs font-semibold uppercase text-slate-400">Tipologia {indice + 1}</p><h2 className="text-lg font-bold">{dados.itemLabels[ref] || lista[0]?.origens[0]?.label || ref}</h2></div><TabelaMateriais linhas={lista} consolidada={false} /></section>)}</div>}
      </>}

      <footer className="border-t border-slate-300 pt-3 text-xs text-slate-500 print:text-[9pt]">Documento de cotação derivado do pacote técnico do Atlas. Não contém margem, desconto ou preço de venda. Materiais pendentes não representam liberação técnica.</footer>
    </div>
  </main>
}
