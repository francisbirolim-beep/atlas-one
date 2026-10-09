'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, History, Loader2, PauseCircle, PlayCircle, Search, ChevronRight, FileDown } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { buscarMedicao, listarItensMedicao } from '@/lib/medicaoFinal'
import { carregarChecklistMedicaoV2, statusItemChecklistV2 } from '@/lib/medicaoChecklistV2'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import type { MedicaoItem, Usuario } from '@/lib/tipos'
import {
  carregarEstadoParcialMedicao,
  retomarMedicaoParcial,
  salvarMedicaoParcial,
  type EventoHistoricoMedicao,
} from '@/lib/medicaoParcial'

type PecaResumo = {
  id: string
  descricao: string
  tipologia: string
  ambiente: string
  medido: boolean
  iniciado: boolean
  quantidade: number
  ordem: number
  medidoPor: string
  atualizadoEm: string
  status: 'pendente' | 'em_andamento' | 'concluida'
}

function formatarDuracao(ms: number) {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  return [horas, minutos, segundos].map(valor => String(valor).padStart(2, '0')).join(':')
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function rotuloEvento(evento: EventoHistoricoMedicao) {
  if (evento.tipo === 'inicio') return 'Medição iniciada'
  if (evento.tipo === 'parcial') return 'Medição salva como parcial'
  return 'Medição retomada'
}

function separarDescricao(descricao: string) {
  const partes = descricao.split(/\s+[—–]\s+/)
  if (partes.length < 2) return { tipologia: descricao, ambiente: 'Não informado' }
  return { tipologia: partes.slice(0, -1).join(' — '), ambiente: partes.at(-1) || 'Não informado' }
}

function itemIniciado(item: MedicaoItem) {
  const medidas = [
    item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm,
    item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm,
  ]
  return Boolean(
    item.medido ||
    medidas.some(valor => Number(valor) > 0) ||
    item.foto_larguras_url ||
    item.foto_alturas_url ||
    item.observacoes_medicao ||
    (item.campos_extras && Object.keys(item.campos_extras).length > 0)
  )
}

export default function MedicaoParcialPanel({ medicaoId, onSelecionarPeca, modo = 'completo', embedded = false }: { medicaoId: string; onSelecionarPeca?: (itemId: string) => void; modo?: 'completo' | 'controle' | 'lista'; embedded?: boolean }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pecas, setPecas] = useState<PecaResumo[]>([])
  const [eventos, setEventos] = useState<EventoHistoricoMedicao[]>([])
  const [parcial, setParcial] = useState(false)
  const [tempoBase, setTempoBase] = useState(0)
  const [carregadoEm, setCarregadoEm] = useState(Date.now())
  const [agora, setAgora] = useState(Date.now())
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroAmbiente, setFiltroAmbiente] = useState('todos')
  const [filtroTipologia, setFiltroTipologia] = useState('todas')

  const carregar = useCallback(async () => {
    const [estado, checklist] = await Promise.all([
      carregarEstadoParcialMedicao(medicaoId),
      carregarChecklistMedicaoV2(medicaoId),
    ])
    const itens = checklist.itens

    const instante = Date.now()
    setEventos(estado.eventos)
    setParcial(estado.parcial)
    setTempoBase(estado.tempoAtivoMs)
    setCarregadoEm(instante)
    setAgora(instante)
    setPecas(itens.map(item => {
      const descricao = item.descricao || item.tipo_outro_texto || item.tipo_esquadria || 'Peça'
      const partes = separarDescricao(descricao)
      const status = statusItemChecklistV2(item, checklist.campos, checklist.respostas)
      return {
        id: item.id,
        descricao,
        tipologia: partes.tipologia,
        ambiente: item.ambiente?.trim() || partes.ambiente,
        medido: status === 'concluida',
        iniciado: status !== 'pendente',
        quantidade: Math.max(1, Number(item.quantidade || 1)),
        ordem: Number(item.ordem || 0),
        medidoPor: item.medido_por_nome || '',
        atualizadoEm: item.medido_em || item.updated_at || '',
        status,
      }
    }))
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    void carregar()
  }, [carregar])

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const atualizar = () => void carregar()
    window.addEventListener('atlas-medicao-atualizada', atualizar)
    const timer = window.setInterval(atualizar, 10000)
    return () => { window.clearInterval(timer); window.removeEventListener('atlas-medicao-atualizada', atualizar) }
  }, [carregar])

  const tempoExibido = parcial || !eventos.some(evento => evento.tipo === 'inicio') ? tempoBase : tempoBase + Math.max(0, agora - carregadoEm)
  const feitas = pecas.filter(peca => peca.status === 'concluida').length
  const emAndamento = pecas.filter(peca => peca.status === 'em_andamento').length
  const pendentes = pecas.filter(peca => peca.status === 'pendente').length
  const iniciada = eventos.some(evento => evento.tipo === 'inicio')
  const ambientes = useMemo(() => [...new Set(pecas.map(p => p.ambiente))].sort(), [pecas])
  const tipologias = useMemo(() => [...new Set(pecas.map(p => p.tipologia))].sort(), [pecas])
  const pecasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return pecas.filter(peca =>
      (!termo || `${peca.tipologia} ${peca.ambiente}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
      (filtroAmbiente === 'todos' || peca.ambiente === filtroAmbiente) &&
      (filtroTipologia === 'todas' || peca.tipologia === filtroTipologia)
    )
  }, [pecas, busca, filtroAmbiente, filtroTipologia])

  async function alternarParcial() {
    if (processando) return
    setProcessando(true)
    setMensagem('')
    setErro('')
    const resultado = parcial
      ? await retomarMedicaoParcial(medicaoId, usuario)
      : await salvarMedicaoParcial(medicaoId, usuario)
    setProcessando(false)
    if (!resultado.ok) {
      setErro(resultado.mensagem || 'Não foi possível atualizar a medição.')
      return
    }
    setMensagem(parcial ? 'Medição retomada. As peças já feitas continuam salvas.' : 'Medição parcial salva. As peças feitas ficam marcadas e o restante permanece em aberto.')
    await carregar()
  }

  if (carregando) {
    return <section className={embedded ? "w-full" : "mx-auto w-full max-w-6xl px-3 pt-3 md:px-4"}><div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" /></section>
  }

  if (modo === 'controle' && embedded) {
    return (
      <section className="h-full">
        <div className="flex h-full min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Controle da medição</p>
          <div className="mt-3 flex items-center gap-2">
            <Clock3 size={17} className="text-slate-500" />
            <span className="text-xl font-bold tabular-nums text-slate-900">{formatarDuracao(tempoExibido)}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-50 px-2 py-2 text-center"><p className="text-lg font-bold text-emerald-700">{feitas}</p><p className="text-[10px] font-medium text-emerald-700">Concluídas</p></div>
            <div className="rounded-lg bg-blue-50 px-2 py-2 text-center"><p className="text-lg font-bold text-blue-700">{emAndamento}</p><p className="text-[10px] font-medium text-blue-700">Em andamento</p></div>
            <div className="rounded-lg bg-slate-100 px-2 py-2 text-center"><p className="text-lg font-bold text-slate-700">{pendentes}</p><p className="text-[10px] font-medium text-slate-600">Pendentes</p></div>
          </div>
          <div className="mt-auto pt-4">
            <button type="button" onClick={() => void alternarParcial()} disabled={processando || !iniciada} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${parcial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {processando ? <Loader2 size={14} className="animate-spin" /> : parcial ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              {parcial ? 'Retomar medição' : 'Salvar medição parcial'}
            </button>
            {!iniciada && <p className="mt-1.5 text-[10px] text-slate-500">Inicie a medição antes de salvar como parcial.</p>}
          </div>
          <details className="pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Histórico da medição</summary>
            <div className="mt-2">
              <button type="button" onClick={() => setMostrarHistorico(valor => !valor)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <History size={14} /> {mostrarHistorico ? 'Ocultar histórico' : 'Ver histórico'}
              </button>
            </div>
            {mostrarHistorico && <div className="mt-2 space-y-2">{[...eventos].reverse().map(evento => <p key={evento.id} className="text-xs text-slate-600">{rotuloEvento(evento)} · {formatarData(evento.data)} · {evento.usuario || "—"}</p>)}</div>}
          </details>
          {mensagem && <p role="status" className="mt-2 text-xs text-emerald-700">{mensagem}</p>}
          {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
        </div>
      </section>
    )
  }

  return (
    <>
      {modo !== 'lista' && <section className={embedded ? "w-full" : "mx-auto w-full max-w-6xl px-3 pt-3 md:px-4"}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-3 md:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Controle da medição</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900"><Clock3 size={16} /> {formatarDuracao(tempoExibido)}</span>
                  <span className="text-xs text-emerald-700">✓ {feitas} concluída(s)</span>
                  <span className="text-xs text-blue-700">◐ {emAndamento} em andamento</span>
                  <span className="text-xs text-slate-500">○ {pendentes} pendente(s)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">O tempo considera somente os períodos em que a medição esteve em andamento; ao salvar parcial, ele fica pausado.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMostrarHistorico(valor => !valor)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <History size={14} /> Histórico
                </button>
                <button type="button" onClick={() => void alternarParcial()} disabled={processando || !iniciada} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${parcial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {processando ? <Loader2 size={14} className="animate-spin" /> : parcial ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                  {parcial ? 'Retomar medição' : 'Salvar medição parcial'}
                </button>
              </div>
            </div>
            {parcial && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Medição parcial: o que já foi medido está preservado. Quando o restante for liberado, clique em “Retomar medição”.</div>}
            {mostrarHistorico && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Histórico da medição</p>
                <div className="mt-2 space-y-2">
                  {[...eventos].reverse().map(evento => (
                    <div key={evento.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">{rotuloEvento(evento)}</p><span className="text-[10px] text-slate-400">{formatarData(evento.data)}</span></div>
                      {(evento.pecasMedidas != null || evento.pecasAbertas != null) && <p className="mt-0.5 text-[11px] text-slate-500">{evento.pecasMedidas ?? 0} feita(s) · {evento.pecasAbertas ?? 0} em aberto</p>}
                      {evento.usuario && <p className="text-[10px] text-slate-400">Por {evento.usuario}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mensagem && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{mensagem}</p>}
            {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          </div>
        </div>
      </section>}

      {modo !== 'controle' && <section className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.04em] text-slate-800">Lista de tipologias da obra</p>
                <p className="mt-0.5 text-xs text-slate-500">Visualize e acesse o checklist técnico de cada tipologia</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-500">{pecas.length} tipologia(s) · {feitas} concluída(s) · {emAndamento} em andamento · {pendentes} pendente(s)</span>
                <button type="button" onClick={async () => {
                  const medicao = await buscarMedicao(medicaoId)
                  if (!medicao) {
                    setErro('Não foi possível carregar a Medição Final para gerar o PDF.')
                    return
                  }
                  await gerarPdfMedicaoFinal(medicao, await listarItensMedicao(medicaoId))
                }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <FileDown size={14} /> Exportar PDF da Medição
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search size={15} className="text-slate-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tipologia, ambiente..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              <select value={filtroAmbiente} onChange={e => setFiltroAmbiente(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="todos">Todos os ambientes</option>{ambientes.map(a => <option key={a} value={a}>{a}</option>)}</select>
              <select value={filtroTipologia} onChange={e => setFiltroTipologia(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="todas">Todas as tipologias</option>{tipologias.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <div className="hidden min-w-[860px] grid-cols-[46px_1.7fr_1fr_90px_130px_140px_24px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:grid"><span>#</span><span>Tipologia</span><span>Ambiente</span><span className="text-center">Quantidade</span><span>Status</span><span>Medido por / atualização</span><span /></div>
              {pecasFiltradas.map((peca) => {
                const status = peca.medido ? 'Concluída' : peca.iniciado ? 'Em andamento' : 'Pendente'
                return (
                  <button key={peca.id} type="button" onClick={() => onSelecionarPeca?.(peca.id)} className="grid w-full min-w-0 grid-cols-[38px_1fr_auto] items-center gap-2 border-b border-slate-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-slate-50 md:grid-cols-[46px_1.7fr_1fr_90px_130px_140px_24px]">
                    <span className="text-xs font-bold text-slate-500">{String(pecas.findIndex(p => p.id === peca.id) + 1).padStart(2, '0')}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{peca.tipologia}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{peca.descricao !== peca.tipologia ? peca.descricao : ''}</span><span className="block text-[11px] text-slate-400 md:hidden">{peca.ambiente}</span></span>
                    <span className="hidden text-xs text-slate-600 md:block">{peca.ambiente}</span>
                    <span className="hidden text-center text-xs text-slate-600 md:block">{peca.quantidade}</span>
                    <span className={`hidden w-fit rounded-full px-2 py-1 text-[11px] font-semibold md:inline-flex ${peca.medido ? 'bg-emerald-50 text-emerald-700' : peca.iniciado ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
                    <span className="hidden text-xs text-slate-500 md:block">{peca.medidoPor ? <><span className="font-medium text-slate-700">{peca.medidoPor}</span>{peca.atualizadoEm && <span className="block text-[10px] text-slate-400">{formatarData(peca.atualizadoEm)}</span>}</> : '—'}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold md:hidden ${peca.medido ? 'bg-emerald-50 text-emerald-700' : peca.iniciado ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
                    <ChevronRight size={16} className="hidden text-slate-400 md:block" />
                  </button>
                )
              })}
              {pecasFiltradas.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma tipologia encontrada com estes filtros.</p>}
            </div>
          </div>
        </div>
      </section>}
    </>
  )
}
