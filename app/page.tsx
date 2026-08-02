'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Plus, Check, X, Download, MapPin, EyeOff, Repeat } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { Usuario, TarefaPessoal, TarefaPessoalColuna, Evento } from '@/lib/tipos'
import { GUIAS, lerOcultos, alternarOculto, EVENTO_OCULTOS_MUDOU } from '@/lib/guias'
import { listarTarefas, listarColunasTarefas, criarTarefa, concluirTarefa, primeiraColunaTarefaId, criarTarefaRecorrente } from '@/lib/tarefas'
import { TipoRecorrencia, LABEL_RECORRENCIA } from '@/lib/recorrencia'
import {
  listarEventosDoUsuario,
  criarEvento,
  criarEventoRecorrente,
  excluirEvento,
  responderConvite,
  gerarIcs,
  listarUsuariosConvidaveis,
  EventoComConvite,
} from '@/lib/eventos'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'MarÃ§o', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function mesmodia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function Home() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [carregandoPainel, setCarregandoPainel] = useState(true)
  const [mesVisto, setMesVisto] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [novaTarefaTexto, setNovaTarefaTexto] = useState('')
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)
  const [mostrarNovoEvento, setMostrarNovoEvento] = useState(false)
  const [tituloEvento, setTituloEvento] = useState('')
  const [localEvento, setLocalEvento] = useState('')
  const [horaInicioEvento, setHoraInicioEvento] = useState('09:00')
  const [horaFimEvento, setHoraFimEvento] = useState('10:00')
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<{ id: string; nome: string }[]>([])
  const [convidadosSelecionados, setConvidadosSelecionados] = useState<string[]>([])
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [repetirEvento, setRepetirEvento] = useState<TipoRecorrencia | ''>('')
  const [repetirValorEvento, setRepetirValorEvento] = useState(5)

  useEffect(() => {
    usuarioAtual().then((u) => {
      setUsuario(u)
      if (u) carregarPainel(u.id)
    })
    setOcultos(lerOcultos())
    function sync() {
      setOcultos(lerOcultos())
    }
    window.addEventListener(EVENTO_OCULTOS_MUDOU, sync)
    return () => window.removeEventListener(EVENTO_OCULTOS_MUDOU, sync)
  }, [])

  async function carregarPainel(usuarioId: string) {
    setCarregandoPainel(true)
    const [tfs, cols, evs] = await Promise.all([
      listarTarefas(usuarioId),
      listarColunasTarefas(usuarioId),
      listarEventosDoUsuario(usuarioId),
    ])
    setTarefas(tfs)
    setColunas(cols)
    setEventos(evs)
    setCarregandoPainel(false)
  }

  function esconder(href: string) {
    setOcultos(alternarOculto(href))
  }

  const visiveis = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter(
    (g) => !ocultos.includes(g.href)
  )

  const tarefasAbertas = tarefas
    .filter((t) => !t.concluida_em)
    .sort((a, b) => {
      if (a.data_hora && b.data_hora) return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      if (a.data_hora) return -1
      if (b.data_hora) return 1
      return 0
    })

  function estaAtrasada(t: TarefaPessoal) {
    return !t.concluida_em && !!t.data_hora && new Date(t.data_hora).getTime() < Date.now()
  }

  async function marcarConcluida(t: TarefaPessoal) {
    setTarefas((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluida_em: new Date().toISOString() } : x)))
    await concluirTarefa(t.id)
  }

  async function adicionarTarefaRapida() {
    if (!usuario || !novaTarefaTexto.trim()) return
    setSalvandoTarefa(true)
    const colunaId = colunas[0]?.id || (await primeiraColunaTarefaId(usuario.id))
    if (colunaId) {
      const dataHora = diaSelecionado ? new Date(diaSelecionado.setHours(9, 0, 0, 0)).toISOString() : null
      const t = await criarTarefa(usuario.id, colunaId, novaTarefaTexto.trim(), undefined, dataHora)
      if (t) setTarefas((prev) => [...prev, t])
    }
    setNovaTarefaTexto('')
    setSalvandoTarefa(false)
  }

  async function abrirNovoEvento() {
    setMostrarNovoEvento(true)
    setTituloEvento('')
    setLocalEvento('')
    setConvidadosSelecionados([])
    setRepetirEvento('')
    setRepetirValorEvento(5)
    if (usuario && usuariosDisponiveis.length === 0) {
      const lista = await listarUsuariosConvidaveis(usuario.id)
      setUsuariosDisponiveis(lista)
    }
  }

  function alternarConvidado(id: string) {
    setConvidadosSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function salvarNovoEvento() {
    if (!usuario || !tituloEvento.trim() || !diaSelecionado) return
    setSalvandoEvento(true)
    const base = new Date(diaSelecionado)
    const [hi, mi] = horaInicioEvento.split(':').map(Number)
    const [hf, mf] = horaFimEvento.split(':').map(Number)
    const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hi, mi)
    const fim = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hf, mf)
    const dadosEvento = { titulo: tituloEvento.trim(), local: localEvento.trim() || undefined, data_inicio: inicio.toISOString(), data_fim: fim.toISOString() }

    const ev = repetirEvento
      ? await criarEventoRecorrente(usuario.id, dadosEvento, repetirEvento, repetirValorEvento, convidadosSelecionados)
      : await criarEvento(usuario.id, dadosEvento, convidadosSelecionados)

    if (ev) {
      const evs = await listarEventosDoUsuario(usuario.id)
      setEventos(evs)
    }
    setMostrarNovoEvento(false)
    setSalvandoEvento(false)
  }

  async function apagarEvento(ev: Evento) {
    if (!window.confirm(`Apagar o evento "${ev.titulo}"?`)) return
    const ok = await excluirEvento(ev.id)
    if (ok) setEventos((prev) => prev.filter((x) => x.id !== ev.id))
  }

  async function responder(ev: EventoComConvite, status: 'aceito' | 'recusado') {
    if (!usuario) return
    setEventos((prev) => prev.map((x) => (x.id === ev.id ? { ...x, meuStatus: status } : x)))
    await responderConvite(ev.id, usuario.id, status)
  }

  function baixarIcs(ev: Evento) {
    const conteudo = gerarIcs(ev)
    const url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(conteudo)
    const a = document.createElement('a')
    a.href = url
    a.download = ev.titulo.replace(/[^a-z0-9]/gi, '_') + '.ics'
    a.click()
  }

  // grade do calendario: dias do mes visto, preenchendo espacos vazios do inicio
  const primeiroDiaSemana = mesVisto.getDay()
  const diasNoMes = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 0).getDate()
  const celulas: (Date | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(mesVisto.getFullYear(), mesVisto.getMonth(), d))

  function tarefasDoDia(dia: Date) {
    return tarefas.filter((t) => t.data_hora && !t.concluida_em && mesmodia(new Date(t.data_hora), dia))
  }

  function eventosDoDia(dia: Date) {
    return eventos.filter((e) => mesmodia(new Date(e.data_inicio), dia))
  }

  const hoje = new Date()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="EsquadrifÃ¡cio" width={140} height={40} className="h-9 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-brand-navy">Atlas One</h1>
              <p className="text-xs text-slate-400">EsquadrifÃ¡cio</p>
            </div>
          </div>
          {usuario && <span className="text-sm text-slate-500">OlÃ¡, {usuario.nome}</span>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Guias rÃ¡pidos</h2>
          <p className="text-xs text-slate-400">Passe o mouse e clique no olho pra tirar daqui</p>
        </div>

        {visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
            <p className="text-sm text-slate-500">Nenhum guia adicionado ainda. Abra a lista <strong>&quot;Mais&quot;</strong> no menu lateral e clique na estrela para adicionar aqui os que voce mais usa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visiveis.map((g) => {
            const Icon = g.icon
            return (
              <div key={g.href} className="relative group">
                <Link
                  href={g.href}
                  className="flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200
                             hover:border-brand-navy hover:shadow-md transition-all p-5 text-center h-full"
                >
                  <div className="w-11 h-11 bg-brand-navyLight rounded-xl flex items-center justify-center">
                    <Icon size={20} className="text-brand-navy" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{g.label}</span>
                </Link>
                <button
                  onClick={() => esconder(g.href)}
                  title="Esconder"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                >
                  <EyeOff size={14} />
                </button>
              </div>
            )
          })}
        </div>
        )}

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-700">Minhas tarefas</h2>
              <Link href="/tarefas" className="text-xs text-brand-navy hover:underline">
                Ver kanban completo
              </Link>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={novaTarefaTexto}
                onChange={(e) => setNovaTarefaTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarTarefaRapida()}
                placeholder="Adicionar tarefa..."
                className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={adicionarTarefaRapida}
                disabled={!novaTarefaTexto.trim() || salvandoTarefa}
                className="bg-brand-navy text-white rounded-xl px-3 disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>

            {carregandoPainel ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : tarefasAbertas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma tarefa em aberto.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tarefasAbertas.slice(0, 10).map((t) => {
                  const atrasada = estaAtrasada(t)
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 ${atrasada ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}
                    >
                      <button
                        onClick={() => marcarConcluida(t)}
                        title="Concluir"
                        className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-slate-700 truncate">{t.titulo}</p>
                          {(t.recorrencia_tipo || t.regra_origem_id) && (
                            <Repeat size={11} className="text-slate-300 flex-shrink-0" />
                          )}
                        </div>
                        {t.data_hora && (
                          <p className={`text-xs ${atrasada ? 'text-red-500' : 'text-slate-400'}`}>
                            {new Date(t.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      {atrasada && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-700">CalendÃ¡rio</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMesVisto((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-slate-600 w-28 text-center">
                  {MESES[mesVisto.getMonth()]} {mesVisto.getFullYear()}
                </span>
                <button
                  onClick={() => setMesVisto((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i} className="text-[10px] text-slate-400 font-medium">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, i) => {
                if (!dia) return <div key={i} />
                const qtdTarefas = tarefasDoDia(dia).length
                const qtdEventos = eventosDoDia(dia).length
                const ehHoje = mesmodia(dia, hoje)
                const selecionado = diaSelecionado && mesmodia(dia, diaSelecionado)
                return (
                  <button
                    key={i}
                    onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition
                      ${selecionado ? 'bg-brand-navy text-white' : ehHoje ? 'bg-brand-navyLight text-brand-navy font-semibold' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    {dia.getDate()}
                    {(qtdTarefas > 0 || qtdEventos > 0) && (
                      <span className="flex gap-0.5">
                        {qtdTarefas > 0 && <span className={`w-1 h-1 rounded-full ${selecionado ? 'bg-white' : 'bg-brand-teal'}`} />}
                        {qtdEventos > 0 && <span className={`w-1 h-1 rounded-full ${selecionado ? 'bg-white' : 'bg-amber-500'}`} />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {diaSelecionado && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">
                    {diaSelecionado.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </p>
                  <button
                    onClick={abrirNovoEvento}
                    className="text-xs text-brand-navy hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Novo evento
                  </button>
                </div>

                {tarefasDoDia(diaSelecionado).length === 0 && eventosDoDia(diaSelecionado).length === 0 ? (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} /> Nada agendado nesse dia.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tarefasDoDia(diaSelecionado).map((t) => (
                      <div key={t.id} className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Clock size={12} className="text-brand-teal flex-shrink-0" />
                        {t.data_hora && new Date(t.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} â {t.titulo}
                        {(t.recorrencia_tipo || t.regra_origem_id) && <Repeat size={10} className="text-slate-300" />}
                      </div>
                    ))}
                    {eventosDoDia(diaSelecionado).map((ev) => (
                      <div key={ev.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate flex items-center gap-1">
                              {ev.titulo}
                              {(ev.recorrencia_tipo || ev.regra_origem_id) && <Repeat size={10} className="text-slate-400" />}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {ev.local && (
                                <span className="inline-flex items-center gap-0.5 ml-1">
                                  <MapPin size={10} /> {ev.local}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => baixarIcs(ev)} title="Baixar .ics" className="p-1 text-slate-400 hover:text-slate-600">
                              <Download size={12} />
                            </button>
                            {ev.meuStatus === 'proprio' && (
                              <button onClick={() => apagarEvento(ev)} title="Apagar" className="p-1 text-slate-400 hover:text-red-500">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {ev.meuStatus === 'pendente' && (
                          <div className="flex gap-2 mt-1.5">
                            <button
                              onClick={() => responder(ev, 'aceito')}
                              className="flex items-center gap-1 text-xs bg-emerald-500 text-white rounded-lg px-2 py-0.5"
                            >
                              <Check size={10} /> Aceitar
                            </button>
                            <button
                              onClick={() => responder(ev, 'recusado')}
                              className="flex items-center gap-1 text-xs bg-slate-200 text-slate-600 rounded-lg px-2 py-0.5"
                            >
                              <X size={10} /> Recusar
                            </button>
                          </div>
                        )}
                        {ev.meuStatus === 'aceito' && <p className="text-xs text-emerald-600 mt-1">Confirmado</p>}
                        {ev.meuStatus === 'recusado' && <p className="text-xs text-slate-400 mt-1">Recusado</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {mostrarNovoEvento && diaSelecionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">
                Novo evento â {diaSelecionado.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </h3>
              <button onClick={() => setMostrarNovoEvento(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <input
              value={tituloEvento}
              onChange={(e) => setTituloEvento(e.target.value)}
              placeholder="TÃ­tulo"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
            <input
              value={localEvento}
              onChange={(e) => setLocalEvento(e.target.value)}
              placeholder="Local (opcional)"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-slate-400">InÃ­cio</label>
                <input
                  type="time"
                  value={horaInicioEvento}
                  onChange={(e) => setHoraInicioEvento(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400">Fim</label>
                <input
                  type="time"
                  value={horaFimEvento}
                  onChange={(e) => setHoraFimEvento(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Repetir</label>
              <select
                value={repetirEvento}
                onChange={(e) => setRepetirEvento(e.target.value as TipoRecorrencia | '')}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">NÃ£o se repete</option>
                <option value="semanal">{LABEL_RECORRENCIA.semanal} (mesmo dia da semana)</option>
                <option value="dia_util_mes">{LABEL_RECORRENCIA.dia_util_mes}</option>
                <option value="dia_fixo_mes">{LABEL_RECORRENCIA.dia_fixo_mes}</option>
              </select>
              {repetirEvento === 'dia_util_mes' && (
                <input
                  type="number"
                  min={1}
                  max={23}
                  value={repetirValorEvento}
                  onChange={(e) => setRepetirValorEvento(Number(e.target.value))}
                  placeholder="Ex: 5 = 5Âº dia Ãºtil"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mt-2"
                />
              )}
              {repetirEvento === 'dia_fixo_mes' && (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={repetirValorEvento}
                  onChange={(e) => setRepetirValorEvento(Number(e.target.value))}
                  placeholder="Ex: 10 = todo dia 10"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mt-2"
                />
              )}
            </div>

            {usuariosDisponiveis.length > 0 && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Convidar</label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2">
                  {usuariosDisponiveis.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={convidadosSelecionados.includes(u.id)}
                        onChange={() => alternarConvidado(u.id)}
                      />
                      {u.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={salvarNovoEvento}
              disabled={!tituloEvento.trim() || salvandoEvento}
              className="w-full bg-brand-navy text-white rounded-xl py-2 text-sm font-medium disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
