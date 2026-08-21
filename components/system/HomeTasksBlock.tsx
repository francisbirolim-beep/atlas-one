'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CheckSquare, Clock3, Plus, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarUsuariosConvidaveis } from '@/lib/eventos'
import { concluirTarefa, criarTarefa, listarColunasTarefas, listarTarefas, primeiraColunaTarefaId } from '@/lib/tarefas'
import { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'

function dataHoje() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function dataHoraLabel(iso?: string | null) {
  if (!iso) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function HomeTasksBlock() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(dataHoje())
  const [hora, setHora] = useState('09:00')
  const [responsavelId, setResponsavelId] = useState('')
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([])
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('normal')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (!u) { setCarregando(false); return }
      const [lista, cls] = await Promise.all([listarTarefas(u.id), listarColunasTarefas(u.id)])
      if (!ativo) return
      setTarefas(lista)
      setColunas(cls)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const abrir = () => void abrirModal()
    window.addEventListener('atlas:nova-tarefa', abrir)
    return () => window.removeEventListener('atlas:nova-tarefa', abrir)
  }, [usuario])

  const abertas = useMemo(() => tarefas
    .filter(t => !t.concluida_em)
    .sort((a, b) => {
      if (a.data_hora && b.data_hora) return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      if (a.data_hora) return -1
      if (b.data_hora) return 1
      return (b.created_at || '').localeCompare(a.created_at || '')
    }), [tarefas])

  async function abrirModal() {
    if (!usuario) return
    setResponsavelId(usuario.id)
    setModal(true)
    if (responsaveis.length === 0) {
      const outros = await listarUsuariosConvidaveis(usuario.id)
      setResponsaveis([{ id: usuario.id, nome: usuario.nome }, ...outros])
    }
  }

  async function concluir(tarefa: TarefaPessoal) {
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida_em: new Date().toISOString() } : t))
    const ok = await concluirTarefa(tarefa.id)
    if (!ok) setTarefas(prev => prev.map(t => t.id === tarefa.id ? tarefa : t))
  }

  async function salvar() {
    if (!usuario || !titulo.trim()) return
    setSalvando(true)
    const destino = responsavelId || usuario.id
    const dataHora = data ? new Date(`${data}T${hora || '09:00'}:00`).toISOString() : null

    if (destino === usuario.id) {
      const colunaId = colunas[0]?.id || await primeiraColunaTarefaId(usuario.id)
      if (colunaId) {
        const criada = await criarTarefa(usuario.id, colunaId, titulo.trim(), undefined, dataHora)
        if (criada) setTarefas(prev => [...prev, criada])
      }
    } else {
      const resultado = await atribuirTarefa({ responsavelId: destino, titulo: titulo.trim(), dataHora, prioridade })
      if (!resultado.ok) {
        alert(resultado.error || 'Não foi possível atribuir a tarefa.')
        setSalvando(false)
        return
      }
    }

    setTitulo('')
    setPrioridade('normal')
    setModal(false)
    setSalvando(false)
  }

  return (
    <>
      <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><CheckSquare size={17} className="text-emerald-400" /><h2 className="font-semibold">Minhas tarefas</h2></div>
          <button type="button" onClick={() => void abrirModal()} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"><Plus size={13}/> Nova</button>
        </div>

        <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
          {carregando ? (
            <p className="p-4 text-sm text-slate-500">Carregando tarefas...</p>
          ) : abertas.length === 0 ? (
            <div className="p-5 text-sm text-slate-400"><Check size={16} className="mb-2 text-emerald-400" />Nenhuma tarefa aberta.</div>
          ) : abertas.slice(0, 5).map(tarefa => {
            const atrasada = !!tarefa.data_hora && new Date(tarefa.data_hora).getTime() < Date.now()
            return (
              <div key={tarefa.id} className="flex items-center gap-3 px-3 py-3">
                <button type="button" onClick={() => void concluir(tarefa)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300" title="Concluir tarefa"><Check size={14}/></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{tarefa.titulo}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${atrasada ? 'text-red-300' : 'text-slate-500'}`}><Clock3 size={11}/>{dataHoraLabel(tarefa.data_hora)}</p>
                </div>
              </div>
            )
          })}
        </div>
        <Link href="/tarefas" className="mt-3 inline-block text-xs font-medium text-emerald-300 hover:text-emerald-200">Ver todas as tarefas →</Link>
      </article>

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Nova tarefa</h3><p className="text-xs text-slate-500">Crie para você ou atribua a outro usuário.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17}/></button></div>
            <div className="space-y-3">
              <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2"><input type="date" value={data} onChange={e => setData(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"/><input type="time" value={hora} onChange={e => setHora(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"/></div>
              <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm">{responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value as PrioridadeTarefa)} className="w-full rounded-xl border border-slate-300 p-3 text-sm"><option value="baixa">Prioridade baixa</option><option value="normal">Prioridade normal</option><option value="alta">Prioridade alta</option><option value="urgente">Urgente</option></select>
              <button type="button" onClick={() => void salvar()} disabled={salvando || !titulo.trim()} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar tarefa'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
