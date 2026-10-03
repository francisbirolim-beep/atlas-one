'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, ChevronRight, FileText, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import FluxoPrecificacaoEtapas from '@/components/orcamento/FluxoPrecificacaoEtapas'
import { carregarListaMateriaisOrcamento, type GrupoMaterialOrcamento, type LinhaMaterialOrcamento, type ListaMateriaisOrcamento } from '@/lib/listaMateriaisOrcamento'
import { gerarBasePrecificacao } from '@/lib/orcamentoPrecificacao'

type Grupo = 'perfis' | 'acessorios' | 'vidros' | 'outros'

const GRUPOS: Array<{ id: Grupo; label: string }> = [
  { id: 'perfis', label: 'Perfis' },
  { id: 'acessorios', label: 'Acessórios' },
  { id: 'vidros', label: 'Vidros' },
  { id: 'outros', label: 'Outros' },
]

function relacao(valor: any) { return Array.isArray(valor) ? valor[0] : valor }
function qtd(valor: unknown) { const n = Number(valor); return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) }
function money(valor: unknown) { const n = Number(valor); return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function nomeGrupo(grupo: GrupoMaterialOrcamento) { return grupo === 'perfis' ? 'Perfis' : grupo === 'acessorios' ? 'Acessórios' : grupo === 'vidros' ? 'Vidros' : 'Outros' }

function Linha({ linha }: { linha: LinhaMaterialOrcamento }) {
  return <div className="grid gap-2 border-b border-slate-100 px-3 py-2.5 text-xs last:border-0 md:grid-cols-[86px_130px_minmax(0,1fr)_90px_90px] md:items-center">
    <span className="font-semibold text-slate-500">{nomeGrupo(linha.grupo)}</span>
    <span className="font-mono font-semibold text-slate-800">{linha.codigo || '—'}</span>
    <div><span className="font-medium text-slate-800">{linha.descricao}</span>{linha.justificativa && <p className="mt-0.5 text-[11px] text-slate-400">{linha.justificativa}</p>}</div>
    <span>{qtd(linha.quantidade)} {linha.unidade}</span>
    <span className={linha.status_calculo === 'pendente_formula' ? 'font-bold text-amber-700' : linha.incluido_manual ? 'font-semibold text-blue-700' : 'font-semibold text-emerald-700'}>{linha.status_calculo === 'pendente_formula' ? 'Pendente' : linha.incluido_manual ? 'Manual' : 'Calculado'}</span>
  </div>
}

export default function ComposicaoOrcamentoPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<ListaMateriaisOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recalculando, setRecalculando] = useState(false)
  const [erro, setErro] = useState('')
  const geracaoAutomatica = useRef(false)

  async function carregar() {
    setCarregando(true)
    const atual = await carregarListaMateriaisOrcamento(orcamentoId)
    const importadoWvetro = atual?.orcamento?.wvetro_fluxo?.origem === 'wvetro_api'
    if (atual && importadoWvetro && (!atual.pacote || atual.individual.length === 0) && !geracaoAutomatica.current) {
      geracaoAutomatica.current = true
      setRecalculando(true)
      const gerado = await gerarBasePrecificacao(orcamentoId, { perdaCorteMm: 0, minimoSobraReaproveitavelMm: 300 })
      setRecalculando(false)
      if (!gerado.ok) setErro(gerado.error)
      else setDados(await carregarListaMateriaisOrcamento(orcamentoId))
    } else {
      setDados(atual)
    }
    setCarregando(false)
  }

  useEffect(() => { if (orcamentoId) void carregar() }, [orcamentoId])

  const agrupado = useMemo(() => {
    const mapa = new Map<string, LinhaMaterialOrcamento[]>()
    for (const linha of dados?.individual || []) {
      const ref = linha.origens[0]?.item_ref || 'sem-tipologia'
      const lista = mapa.get(ref) || []
      lista.push(linha)
      mapa.set(ref, lista)
    }
    return mapa
  }, [dados?.individual])

  async function recalcular() {
    setErro(''); setRecalculando(true)
    const r = await gerarBasePrecificacao(orcamentoId, { perdaCorteMm: 0, minimoSobraReaproveitavelMm: 300 })
    setRecalculando(false)
    if (!r.ok) { setErro(r.error); return }
    await carregar()
  }

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin" /></div>
  if (!dados) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  const cliente = relacao(dados.orcamento.clientes)?.nome || dados.orcamento.cliente_nome || 'Cliente'
  const obra = relacao(dados.orcamento.obras)
  const total = dados.individual.length
  const itensOriginais: any[] = Array.isArray(dados.orcamento.itens) ? dados.orcamento.itens : []
  const fluxoWvetro = dados.orcamento.wvetro_fluxo || null
  const importadoWvetro = fluxoWvetro?.origem === 'wvetro_api'
  const contagens = Object.fromEntries(GRUPOS.map(g => [g.id, dados.individual.filter(l => l.grupo === g.id).length])) as Record<Grupo, number>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/orcamento-rapido?modo=sob-medida`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar ao orçamento</Link>
          <div className="flex items-center gap-3"><Boxes className="text-blue-600"/><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">Composição técnica</h1><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">FLUXO W.VETRO</span></div><p className="text-sm text-slate-500">#{dados.orcamento.numero || '—'} · {cliente} · confira o que a receita técnica gerou antes dos custos.</p></div></div>
        </div>
        <div className="flex flex-wrap gap-2"><Link href={`/orcamento/${orcamentoId}/materiais`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><FileText size={15}/> Lista de materiais</Link><button onClick={()=>void recalcular()} disabled={recalculando} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{recalculando?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Recalcular composição</button></div>
      </header>

      {importadoWvetro && <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-blue-500">Orçamento original do W.Vetro</p><h2 className="mt-1 text-lg font-bold text-slate-900">W.Vetro #{fluxoWvetro?.numero || '—'} · {itensOriginais.length} item(ns)</h2><p className="mt-1 text-xs text-slate-500">Os itens abaixo foram copiados diretamente do orçamento sincronizado. A composição técnica usa primeiro esses dados reais.</p></div>
          <div className="text-right"><p className="text-xs text-slate-500">Valor do orçamento</p><p className="text-xl font-bold text-slate-900">{money(dados.orcamento.valor_estimado)}</p></div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{itensOriginais.map((item:any,idx:number)=>{
          const raw=item?.wvetro_item || {}
          const perfis=Array.isArray(item?.wvetro_composicao?.perfis)?item.wvetro_composicao.perfis.length:0
          const acessorios=Array.isArray(item?.wvetro_composicao?.acessorios)?item.wvetro_composicao.acessorios.length:0
          const vidros=Array.isArray(item?.wvetro_composicao?.vidros)?item.wvetro_composicao.vidros.length:0
          return <div key={item?.id||idx} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase text-slate-400">Item {idx+1}</p><h3 className="font-bold text-slate-900">{raw?.Modelo || item?.configuracao_nome || item?.tipo_outro_texto || item?.tipo_esquadria || 'Tipologia'}</h3><p className="mt-1 text-xs text-slate-500">{raw?.Linha || item?.linha_nome || 'Linha não informada'} · {raw?.Ambiente || item?.ambiente || 'Sem ambiente'}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">Qtd. {item?.quantidade || raw?.Qtde || 1}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Medida</span><b className="block">{item?.largura_mm || raw?.Largura || '—'} × {item?.altura_mm || raw?.Altura || '—'} mm</b></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Perfis</span><b className="block">{perfis}</b></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Acessórios</span><b className="block">{acessorios}</b></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Vidros</span><b className="block">{vidros}</b></div></div><div className="mt-3 flex justify-between border-t pt-3 text-xs"><span className="text-slate-500">{raw?.Nome || item?.descricao || ''}</span><b className="whitespace-nowrap">{money(item?.preco_total || raw?.ValorTotalAlterado || raw?.ValorTotal)}</b></div></div>
        })}</div>
      </section>}

      <FluxoPrecificacaoEtapas orcamentoId={orcamentoId} atual="composicao" bloqueado={dados.pendencias > 0}/>

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {!dados.pacote && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 text-amber-700"/><div><h2 className="font-bold text-amber-900">A composição ainda não foi gerada</h2><p className="mt-1 text-sm text-amber-800">Clique em “Recalcular composição” para criar o pacote técnico deste orçamento.</p></div></div></section>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Total de componentes</p><p className="mt-1 text-2xl font-bold">{total}</p></div>
        {GRUPOS.map(g=><div key={g.id} className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">{g.label}</p><p className="mt-1 text-2xl font-bold">{contagens[g.id]}</p></div>)}
      </section>

      {dados.pendencias > 0 && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><TriangleAlert size={18}/><div><b>{dados.pendencias} pendência(s) técnica(s) na composição.</b><p className="mt-1 text-xs">O fluxo pode ser revisado, mas o fechamento e a impressão ficam bloqueados enquanto houver custo ou fórmula pendente.</p></div></div></section>}

      <div className="space-y-5">{Array.from(agrupado.entries()).map(([ref, linhas], indice)=><section key={ref} className="overflow-hidden rounded-2xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4"><div><p className="text-[11px] font-bold uppercase text-slate-400">Tipologia {indice + 1}</p><h2 className="font-bold text-slate-900">{dados.itemLabels[ref] || linhas[0]?.origens[0]?.label || ref}</h2></div><div className="flex flex-wrap gap-1.5">{GRUPOS.map(g=>{const n=linhas.filter(l=>l.grupo===g.id).length;return n?<span key={g.id} className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">{g.label}: {n}</span>:null})}</div></div><div>{linhas.map(linha=><Linha key={linha.chave} linha={linha}/>)}</div></section>)}
        {agrupado.size===0 && dados.pacote && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-400">Nenhum componente foi gerado para este orçamento.</div>}
      </div>

      <section className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><div><p className="text-xs font-bold text-slate-700">Tela 7 de 9 · Composição</p><p className="text-[10px] text-slate-400">Revise a receita técnica; os custos entram na próxima etapa.</p></div><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Continuar para custos <ChevronRight size={16}/></Link></section>
    </div>
  </main>
}