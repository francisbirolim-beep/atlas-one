'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Clock3, History, Loader2, PauseCircle, PlayCircle } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/lib/tipos'
import {
  carregarEstadoParcialMedicao,
  retomarMedicaoParcial,
  salvarMedicaoParcial,
  type EventoHistoricoMedicao,
} from '@/lib/medicaoParcial'

type PecaResumo = {
  id: string
  descricao: string
  medido: boolean
  quantidade: number
  ordem: number
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

export default function MedicaoParcialPanel({ medicaoId }: { medicaoId: string }) {
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

  const carregar = useCallback(async () => {
    const [estado, itensResp] = await Promise.all([
      carregarEstadoParcialMedicao(medicaoId),
      supabase
        .from('medicao_itens')
        .select('id, descricao, tipo_esquadria, medido, quantidade, ordem')
        .eq('medicao_id', medicaoId)
        .order('ordem', { ascending: true }),
    ])

    const instante = Date.now()
    setEventos(estado.eventos)
    setParcial(estado.parcial)
    setTempoBase(estado.tempoAtivoMs)
    setCarregadoEm(instante)
    setAgora(instante)
    setPecas((itensResp.data || []).map((item: any) => ({
      id: item.id,
      descricao: item.descricao || item.tipo_esquadria || 'Peça',
      medido: Boolean(item.medido),
      quantidade: Math.max(1, Number(item.quantidade || 1)),
      ordem: Number(item.ordem || 0),
    })))
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
    const timer = window.setInterval(() => void carregar(), 10000)
    return () => window.clearInterval(timer)
  }, [carregar])

  const tempoExibido = parcial ? tempoBase : tempoBase + Math.max(0, agora - carregadoEm)
  const feitas = pecas.filter(peca => peca.medido).length
  const abertas = pecas.reduce((total, peca) => total + (peca.medido ? Math.max(0, peca.quantidade - 1) : peca.quantidade), 0)
  const iniciada = eventos.some(evento => evento.tipo === 'inicio')

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
    return <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4"><div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" /></section>
  }

  if (!iniciada) return null

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Controle da medição</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900"><Clock3 size={16} /> {formatarDuracao(tempoExibido)}</span>
                <span className="text-xs text-emerald-700">✅ {feitas} feita(s)</span>
                <span className="text-xs text-amber-700">○ {abertas} em aberto</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">O tempo considera somente os períodos em que a medição esteve em andamento; ao salvar parcial, ele fica pausado.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMostrarHistorico(valor => !valor)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
              >
                <History size={14} /> Histórico
              </button>
              <button
                type="button"
                onClick={() => void alternarParcial()}
                disabled={processando}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${parcial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {processando ? <Loader2 size={14} className="animate-spin" /> : parcial ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                {parcial ? 'Retomar medição' : 'Salvar medição parcial'}
              </button>
            </div>
          </div>

          {parcial && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Medição parcial: o que já foi medido está preservado. Quando o restante for liberado, clique em “Retomar medição”.
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pecas.map((peca, indice) => (
              <div key={peca.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${peca.medido ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
                {peca.medido ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={17} className="mt-0.5 shrink-0 text-slate-300" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Peça {indice + 1}</p>
                  <p className="truncate text-[11px] text-slate-500">{peca.descricao}</p>
                  <p className={`mt-0.5 text-[10px] font-semibold ${peca.medido ? 'text-emerald-700' : 'text-amber-700'}`}>{peca.medido ? 'FEITA ✓' : 'EM ABERTO'}</p>
                </div>
              </div>
            ))}
          </div>

          {mostrarHistorico && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Histórico da medição</p>
              <div className="mt-2 space-y-2">
                {[...eventos].reverse().map(evento => (
                  <div key={evento.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{rotuloEvento(evento)}</p>
                      <span className="text-[10px] text-slate-400">{formatarData(evento.data)}</span>
                    </div>
                    {(evento.pecasMedidas != null || evento.pecasAbertas != null) && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{evento.pecasMedidas ?? 0} feita(s) · {evento.pecasAbertas ?? 0} em aberto</p>
                    )}
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
    </section>
  )
}
