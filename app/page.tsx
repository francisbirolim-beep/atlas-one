'use client'

import { useEffect, useState } from 'react'
import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, Wrench, EyeOff, Eye, ListTodo, UserPlus, ChevronLeft, ChevronRight, Clock, AlertTriangle, Plus } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { Usuario, TarefaPessoal, TarefaPessoalColuna } from '@/lib/tipos'
import { listarTarefas, listarColunasTarefas, criarTarefa, concluirTarefa, primeiraColunaTarefaId } from '@/lib/tarefas'

type Guia = {
  href: string
  label: string
  icon: typeof LayoutGrid
  masterOnly?: boolean
}

const GUIAS: Guia[] = [
  { href: '/setores', label: 'Setores', icon: LayoutGrid },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/kanban', label: 'Painel de Orçamentos', icon: Columns3 },
  { href: '/assistencias', label: 'Assistências', icon: Wrench },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true },
  { href: '/cadastro', label: 'Cadastro', icon: UserPlus, masterOnly: true },
]

const CHAVE_OCULTOS = 'atlas_guias_ocultos'
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function mesmodia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function Home() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [carregandoTarefas, setCarregandoTarefas] = useState(true)
  const [mesVisto, setMesVisto] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [novaTarefaTexto, setNovaTarefaTexto] = useState('')
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)

  useEffect(() => {
    usuarioAtual().then((u) => {
      setUsuario(u)
      if (u) carregarTarefas(u.id)
    })
    try {
      const salvo = localStorage.getItem(CHAVE_OCULTOS)
      if (salvo) setOcultos(JSON.parse(salvo))
    } catch {}
  }, [])

  async function carregarTarefas(usuarioId: string) {
    setCarregandoTarefas(true)
    const [tfs, cols] = await Promise.all([listarTarefas(usuarioId), listarColunasTarefas(usuarioId)])
    setTarefas(tfs)
    setColunas(cols)
    setCarregandoTarefas(false)
  }

  function alternarOculto(href: string) {
    const novo = ocultos.includes(href) ? ocultos.filter((h) => h !== href) : [...ocultos, href]
    setOcultos(novo)
    try {
      localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(novo))
    } catch {}
  }

  const visiveis = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter(
    (g) => !ocultos.includes(g.href)
  )
  const escondidos = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter((g) =>
    ocultos.includes(g.href)
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

  // grade do calendario: dias do mes visto, preenchendo espacos vazios do inicio
  const primeiroDiaSemana = mesVisto.getDay()
  const diasNoMes = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 0).getDate()
  const celulas: (Date | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(mesVisto.getFullYear(), mesVisto.getMonth(), d))

  function tarefasDoDia(dia: Date) {
    return tarefas.filter((t) => t.data_hora && !t.concluida_em && mesmodia(new Date(t.data_hora), dia))
  }

  const hoje = new Date()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Atlas One</h1>
            <p className="text-xs text-slate-400">Esquadrifácio</p>
          </div>
          {usuario && <span className="text-sm text-slate-500">Olá, {usuario.nome}</span>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Guias rápidos</h2>
          {escondidos.length > 0 && (
            <button
              onClick={() => setMostrarOcultos((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <Eye size={14} />
              {mostrarOcultos ? 'Ocultar lista' : `${escondidos.length} escondido(s)`}
            </button>
          )}
        </div>

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
                  onClick={() => alternarOculto(g.href)}
                  title="Esconder"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                >
                  <EyeOff size={14} />
                </button>
              </div>
            )
          })}
        </div>

        {mostrarOcultos && escondidos.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-400 mb-3">Escondidos — clique pra trazer de volta</p>
            <div className="flex flex-wrap gap-2">
              {escondidos.map((g) => (
                <button
                  key={g.href}
                  onClick={() => alternarOculto(g.href)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 transition"
                >
                  <g.icon size={12} />
                  {g.label}
                </button>
              ))}
            </div>
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

            {carregandoTarefas ? (
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
                        <p className="text-sm text-slate-700 truncate">{t.titulo}</p>
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
              <h2 className="text-base font-semibold text-slate-700">Calendário</h2>
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
                const qtd = tarefasDoDia(dia).length
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
                    {qtd > 0 && (
                      <span className={`w-1 h-1 rounded-full ${selecionado ? 'bg-white' : 'bg-brand-teal'}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {diaSelecionado && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-400 mb-2">
                  {diaSelecionado.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                </p>
                {tarefasDoDia(diaSelecionado).length === 0 ? (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} /> Nenhuma tarefa com horário nesse dia.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {tarefasDoDia(diaSelecionado).map((t) => (
                      <div key={t.id} className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {t.data_hora && new Date(t.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {t.titulo}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
