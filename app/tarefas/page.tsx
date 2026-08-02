'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Clock, CheckCircle2, AlertTriangle, Calendar, Repeat } from 'lucide-react'
import Link from 'next/link'
import { TarefaPessoalColuna, TarefaPessoal, Usuario } from '@/lib/tipos'
import {
  listarColunasTarefas,
  criarColunaTarefa,
  renomearColunaTarefa,
  excluirColunaTarefa,
  listarTarefas,
  criarTarefa,
  moverTarefa,
  concluirTarefa,
  reabrirTarefa,
  excluirTarefa,
  criarTarefaRecorrente,
} from '@/lib/tarefas'
import { TipoRecorrencia, LABEL_RECORRENCIA } from '@/lib/recorrencia'
import { usuarioAtual } from '@/lib/auth'

function formatarDuracao(ms: number) {
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return `${h}h ${m}min`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export default function Tarefas() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [carregando, setCarregando] = useState(true)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [novaEm, setNovaEm] = useState<string | null>(null)
  const [tituloNovo, setTituloNovo] = useState('')
  const [descNova, setDescNova] = useState('')
  const [dataNova, setDataNova] = useState('')
  const [repetirNova, setRepetirNova] = useState<TipoRecorrencia | ''>('')
  const [repetirValorNova, setRepetirValorNova] = useState(5)
  const [selecionada, setSelecionada] = useState<TarefaPessoal | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const u = await usuarioAtual()
    setUsuario(u)
    if (u) {
      const [cols, tfs] = await Promise.all([listarColunasTarefas(u.id), listarTarefas(u.id)])
      setColunas(cols)
      setTarefas(tfs)
    }
    setCarregando(false)
  }

  function tarefasDaColuna(colunaId: string) {
    return tarefas.filter((t) => t.coluna_id === colunaId)
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, coluna_id: colunaId } : t)))
    await moverTarefa(id, colunaId)
  }

  async function novaColuna() {
    if (!usuario) return
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColunaTarefa(usuario.id, nome.trim())
    if (col) setColunas((prev) => [...prev, col])
  }

  async function editarColuna(col: TarefaPessoalColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColunaTarefa(col.id, novoNome.trim())
    if (ok) setColunas((prev) => prev.map((c) => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: TarefaPessoalColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter((c) => c.id !== col.id)
    const destino = outras[0]
    const qtd = tarefas.filter((t) => t.coluna_id === col.id).length
    const msg = qtd > 0
      ? `Essa coluna tem ${qtd} tarefa(s). Elas vao para a coluna "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a coluna "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColunaTarefa(col.id, destino.id)
    if (ok) {
      setTarefas((prev) => prev.map((t) => (t.coluna_id === col.id ? { ...t, coluna_id: destino.id } : t)))
      setColunas(outras)
    }
  }

  function abrirNovaTarefa(colunaId: string) {
    setNovaEm(colunaId)
    setTituloNovo('')
    setDescNova('')
    setDataNova('')
    setRepetirNova('')
    setRepetirValorNova(5)
  }

  async function salvarNovaTarefa() {
    if (!usuario || !novaEm || !tituloNovo.trim()) return
    if (repetirNova) {
      if (!dataNova) { alert('Defina uma data para a tarefa repetir a partir dela.'); return }
      await criarTarefaRecorrente(usuario.id, novaEm, tituloNovo.trim(), new Date(dataNova).toISOString(), repetirNova, repetirValorNova, descNova.trim() || undefined)
      const tfs = await listarTarefas(usuario.id)
      setTarefas(tfs)
    } else {
      const t = await criarTarefa(usuario.id, novaEm, tituloNovo.trim(), descNova.trim() || undefined, dataNova || null)
      if (t) setTarefas((prev) => [...prev, t])
    }
    setNovaEm(null)
  }

  async function alternarConcluida(t: TarefaPessoal) {
    if (t.concluida_em) {
      const ok = await reabrirTarefa(t.id)
      if (ok) setTarefas((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluida_em: null } : x)))
    } else {
      const ok = await concluirTarefa(t.id)
      if (ok) setTarefas((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluida_em: new Date().toISOString() } : x)))
    }
    setSelecionada(null)
  }

  async function apagarTarefa(t: TarefaPessoal) {
    if (!window.confirm(`Apagar a tarefa "${t.titulo}"?`)) return
    const ok = await excluirTarefa(t.id)
    if (ok) {
      setTarefas((prev) => prev.filter((x) => x.id !== t.id))
      setSelecionada(null)
    }
  }

  function estaAtrasada(t: TarefaPessoal) {
    return !t.concluida_em && !!t.data_hora && new Date(t.data_hora).getTime() < Date.now()
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Minhas Tarefas</h1>
            <p className="text-xs text-slate-400">Kanban pessoal - so voce ve e mexe aqui</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{tarefas.filter((t) => !t.concluida_em).length} tarefa(s) em aberto</p>
          <button onClick={novaColuna} className="flex items-center gap-1.5 text-sm text-brand-navy hover:underline">
            <Plus size={16} /> Nova coluna
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((col) => {
            const cardsColuna = tarefasDaColuna(col.id)
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setColunaArrastando(col.id) }}
                onDragLeave={() => setColunaArrastando(null)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3 transition ${
                  colunaArrastando === col.id ? 'ring-2 ring-brand-navy bg-brand-navyLight' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-700">{col.nome}</span>
                    <span className="text-xs text-slate-400">{cardsColuna.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editarColuna(col)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => apagarColuna(col)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map((t) => {
                    const atrasada = estaAtrasada(t)
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                        onClick={() => setSelecionada(t)}
                        className={`rounded-xl border-2 bg-white p-3 cursor-pointer hover:shadow-md transition ${
                          atrasada ? 'border-red-300' : t.concluida_em ? 'border-emerald-200' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {t.concluida_em ? (
                            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          ) : atrasada ? (
                            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                          ) : (
                            <Clock size={14} className="text-slate-300 flex-shrink-0" />
                          )}
                          <p className="font-medium text-sm truncate flex-1 text-slate-800">{t.titulo}</p>
                        </div>
                        {t.data_hora && (
                          <p className={`text-xs ${atrasada ? 'text-red-500' : 'text-slate-400'}`}>
                            {new Date(t.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {t.concluida_em && t.created_at && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Concluida em {formatarDuracao(new Date(t.concluida_em).getTime() - new Date(t.created_at).getTime())}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => abrirNovaTarefa(col.id)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-brand-navy py-2 rounded-lg hover:bg-white transition"
                >
                  <Plus size={14} /> Adicionar tarefa
                </button>
              </div>
            )
          })}
        </div>
      </main>

      {novaEm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Nova tarefa</h3>
              <button onClick={() => setNovaEm(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <input
              value={tituloNovo}
              onChange={(e) => setTituloNovo(e.target.value)}
              placeholder="Titulo"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
            <textarea
              value={descNova}
              onChange={(e) => setDescNova(e.target.value)}
              placeholder="Descricao (opcional)"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              rows={2}
            />
            <div>
              <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <Calendar size={12} /> Data e hora (opcional - dispara alerta)
              </label>
              <input
                type="datetime-local"
                value={dataNova}
                onChange={(e) => setDataNova(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Repetir</label>
              <select
                value={repetirNova}
                onChange={(e) => setRepetirNova(e.target.value as TipoRecorrencia | '')}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">Nao se repete</option>
                <option value="semanal">{LABEL_RECORRENCIA.semanal} (mesmo dia da semana)</option>
                <option value="dia_util_mes">{LABEL_RECORRENCIA.dia_util_mes}</option>
                <option value="dia_fixo_mes">{LABEL_RECORRENCIA.dia_fixo_mes}</option>
              </select>
              {repetirNova === 'dia_util_mes' && (
                <input
                  type="number"
                  min={1}
                  max={23}
                  value={repetirValorNova}
                  onChange={(e) => setRepetirValorNova(Number(e.target.value))}
                  placeholder="Ex: 5 = 5o dia util"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mt-2"
                />
              )}
              {repetirNova === 'dia_fixo_mes' && (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={repetirValorNova}
                  onChange={(e) => setRepetirValorNova(Number(e.target.value))}
                  placeholder="Ex: 10 = todo dia 10"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
            <button
              onClick={salvarNovaTarefa}
              disabled={!tituloNovo.trim()}
              className="w-full bg-brand-navy text-white rounded-xl py-2 text-sm font-medium disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {selecionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">{selecionada.titulo}</h3>
              <button onClick={() => setSelecionada(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {selecionada.descricao && <p className="text-sm text-slate-500">{selecionada.descricao}</p>}
            {selecionada.data_hora && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar size={12} />
                {new Date(selecionada.data_hora).toLocaleString('pt-BR')}
              </p>
            )}
            {selecionada.concluida_em && selecionada.created_at && (
              <p className="text-xs text-emerald-600">
                Tempo ate concluir: {formatarDuracao(new Date(selecionada.concluida_em).getTime() - new Date(selecionada.created_at).getTime())}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => alternarConcluida(selecionada)}
                className="flex-1 bg-emerald-500 text-white rounded-xl py-2 text-sm font-medium"
              >
                {selecionada.concluida_em ? 'Reabrir' : 'Concluir'}
              </button>
              <button
                onClick={() => apagarTarefa(selecionada)}
                className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
