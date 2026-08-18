'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Users,
  X,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  concluirTarefa,
  criarTarefa,
  listarColunasTarefas,
  listarTarefas,
  primeiraColunaTarefaId,
} from '@/lib/tarefas'
import {
  criarEvento,
  listarEventosDoUsuario,
  listarUsuariosConvidaveis,
  type EventoComConvite,
} from '@/lib/eventos'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'
import { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'
import { listarNotificacoes } from '@/lib/notificacoes'
import type { Notificacao } from '@/lib/tipos'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dataInput(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function hora(iso?: string | null) {
  if (!iso) return 'Sem horário'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function primeiroNome(nome?: string | null) {
  return (nome || '').trim().split(/\s+/)[0] || 'Usuário'
}

type AlertaHome = {
  id: string
  titulo: string
  detalhe: string
  tipo: 'atraso' | 'agenda' | 'convite' | 'tarefa'
  href: string
}

export default function HomeOperationsWorkspace() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [notificacoesPersistentes, setNotificacoesPersistentes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mes, setMes] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date())
  const [modalTarefa, setModalTarefa] = useState(false)
  const [modalEvento, setModalEvento] = useState(false)
  const [tituloTarefa, setTituloTarefa] = useState('')
  const [dataTarefa, setDataTarefa] = useState(dataInput())
  const [horaTarefa, setHoraTarefa] = useState('')
  const [responsavelTarefaId, setResponsavelTarefaId] = useState('')
  const [prioridadeTarefa, setPrioridadeTarefa] = useState<PrioridadeTarefa>('normal')
  const [usuariosTarefa, setUsuariosTarefa] = useState<{ id: string; nome: string }[]>([])
  const [tituloEvento, setTituloEvento] = useState('')
  const [dataEvento, setDataEvento] = useState(dataInput())
  const [inicioEvento, setInicioEvento] = useState('09:00')
  const [fimEvento, setFimEvento] = useState('10:00')
  const [localEvento, setLocalEvento] = useState('')
  const [usuariosConvidaveis, setUsuariosConvidaveis] = useState<{ id: string; nome: string }[]>([])
  const [convidados, setConvidados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (!u) { setCarregando(false); return }
      const [tfs, cls, evs, notifs] = await Promise.all([
        listarTarefas(u.id),
        listarColunasTarefas(u.id),
        listarEventosDoUsuario(u.id),
        listarNotificacoes(u.id, 6),
      ])
      if (!ativo) return
      setTarefas(tfs)
      setColunas(cls)
      setEventos(evs)
      setNotificacoesPersistentes(notifs)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const novaTarefa = () => void abrirTarefa()
    const novoCompromisso = () => void abrirEvento()
    window.addEventListener('atlas:nova-tarefa', novaTarefa)
    window.addEventListener('atlas:novo-compromisso', novoCompromisso)
    return () => {
      window.removeEventListener('atlas:nova-tarefa', novaTarefa)
      window.removeEventListener('atlas:novo-compromisso', novoCompromisso)
    }
  }, [usuario])

  const agora = new Date()
  const tarefasAbertas = useMemo(() => tarefas
    .filter(t => !t.concluida_em)
    .sort((a, b) => {
      if (a.data_hora && b.data_hora) return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      if (a.data_hora) return -1
      if (b.data_hora) return 1
      return (a.created_at || '').localeCompare(b.created_at || '')
    }), [tarefas])

  const alertas = useMemo<AlertaHome[]>(() => {
    const agoraMs = Date.now()
    const lista: AlertaHome[] = []
    const vencidas = tarefasAbertas.filter(t => t.data_hora && new Date(t.data_hora).getTime() < agoraMs)
    if (vencidas.length) lista.push({
      id: 'tarefas-vencidas', tipo: 'atraso', href: '/tarefas',
      titulo: `${vencidas.length} tarefa${vencidas.length > 1 ? 's' : ''} atrasada${vencidas.length > 1 ? 's' : ''}`,
      detalhe: vencidas[0].titulo,
    })

    const convites = eventos.filter(e => e.meuStatus === 'pendente')
    if (convites.length) lista.push({
      id: 'convites', tipo: 'convite', href: '/',
      titulo: `${convites.length} convite${convites.length > 1 ? 's' : ''} de agenda pendente${convites.length > 1 ? 's' : ''}`,
      detalhe: convites[0].titulo,
    })

    const proximos = eventos
      .filter(e => ['proprio', 'aceito', 'pendente'].includes(e.meuStatus || 'proprio'))
      .map(e => ({ ...e, quando: new Date(e.data_inicio).getTime() }))
      .filter(e => e.quando >= agoraMs && e.quando <= agoraMs + 60 * 60 * 1000)
      .sort((a, b) => a.quando - b.quando)
    if (proximos.length) lista.push({
      id: 'agenda-proxima', tipo: 'agenda', href: '/',
      titulo: `${proximos[0].titulo} em breve`,
      detalhe: `Começa às ${hora(proximos[0].data_inicio)}`,
    })

    const hoje = tarefasAbertas.filter(t => t.data_hora && mesmoDia(new Date(t.data_hora), new Date()) && new Date(t.data_hora).getTime() >= agoraMs)
    if (hoje.length) lista.push({
      id: 'tarefas-hoje', tipo: 'tarefa', href: '/tarefas',
      titulo: `${hoje.length} tarefa${hoje.length > 1 ? 's' : ''} ainda para hoje`,
      detalhe: hoje[0].titulo,
    })
    return lista.slice(0, 4)
  }, [eventos, tarefasAbertas])

  const primeiroDia = mes.getDay()
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celulas: (Date | null)[] = []
  for (let i = 0; i < primeiroDia; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(mes.getFullYear(), mes.getMonth(), d))

  const agendaDoDia = eventos
    .filter(e => mesmoDia(new Date(e.data_inicio), diaSelecionado))
    .filter(e => e.meuStatus !== 'recusado')
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())

  async function concluir(tarefa: TarefaPessoal) {
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida_em: new Date().toISOString() } : t))
    const ok = await concluirTarefa(tarefa.id)
    if (!ok) setTarefas(prev => prev.map(t => t.id === tarefa.id ? tarefa : t))
  }

  async function abrirTarefa() {
    if (!usuario) return
    setResponsavelTarefaId(usuario.id)
    setPrioridadeTarefa('normal')
    setModalTarefa(true)
    if (usuariosTarefa.length === 0) {
      const outros = await listarUsuariosConvidaveis(usuario.id)
      setUsuariosTarefa([{ id: usuario.id, nome: usuario.nome }, ...outros])
    }
  }

  async function salvarTarefa() {
    if (!usuario || !tituloTarefa.trim()) return
    setSalvando(true)
    const responsavelId = responsavelTarefaId || usuario.id
    const dataHora = dataTarefa
      ? new Date(`${dataTarefa}T${horaTarefa || '09:00'}:00`).toISOString()
      : null

    if (responsavelId === usuario.id) {
      const colunaId = colunas[0]?.id || await primeiraColunaTarefaId(usuario.id)
      if (colunaId) {
        const criada = await criarTarefa(usuario.id, colunaId, tituloTarefa.trim(), undefined, dataHora)
        if (criada) setTarefas(prev => [...prev, criada])
      }
    } else {
      const resultado = await atribuirTarefa({
        responsavelId,
        titulo: tituloTarefa.trim(),
        dataHora,
        prioridade: prioridadeTarefa,
      })
      if (!resultado.ok) {
        alert(resultado.error || 'Não foi possível atribuir a tarefa.')
        setSalvando(false)
        return
      }
      const nome = usuariosTarefa.find(u => u.id === responsavelId)?.nome || 'o responsável'
      alert(`Tarefa atribuída para ${nome}.`)
    }

    setTituloTarefa('')
    setHoraTarefa('')
    setModalTarefa(false)
    setSalvando(false)
  }

  async function abrirEvento() {
    setModalEvento(true)
    if (usuario && usuariosConvidaveis.length === 0) {
      setUsuariosConvidaveis(await listarUsuariosConvidaveis(usuario.id))
    }
  }

  async function salvarEvento() {
    if (!usuario || !tituloEvento.trim() || !dataEvento) return
    setSalvando(true)
    const inicio = new Date(`${dataEvento}T${inicioEvento}:00`)
    const fim = new Date(`${dataEvento}T${fimEvento}:00`)
    if (fim.getTime() <= inicio.getTime()) {
      alert('O horário final precisa ser depois do horário inicial.')
      setSalvando(false)
      return
    }
    const criado = await criarEvento(usuario.id, {
      titulo: tituloEvento.trim(),
      local: localEvento.trim() || undefined,
      data_inicio: inicio.toISOString(),
      data_fim: fim.toISOString(),
    }, convidados)
    if (criado) setEventos(await listarEventosDoUsuario(usuario.id))
    setTituloEvento('')
    setLocalEvento('')
    setConvidados([])
    setModalEvento(false)
    setSalvando(false)
  }

  const alertasPainel = useMemo<AlertaHome[]>(() => {
    const persistentes: AlertaHome[] = notificacoesPersistentes.slice(0, 4).map(n => ({
      id: `notif-${n.id}`,
      titulo: n.titulo,
      detalhe: n.mensagem || n.criado_por_nome || 'Nova notificação',
      tipo: n.categoria === 'agenda' ? 'agenda' : n.categoria === 'tarefas' ? 'tarefa' : 'convite',
      href: n.href || '/',
    }))
    return [...persistentes, ...alertas].slice(0, 4)
  }, [notificacoesPersistentes, alertas])

  const tituloDia = mesmoDia(diaSelecionado, agora)
    ? 'Hoje'
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(diaSelecionado)

  const corAlerta = (tipo: AlertaHome['tipo']) => tipo === 'atraso'
    ? 'bg-red-500/15 text-red-300'
    : tipo === 'agenda'
      ? 'bg-blue-500/15 text-blue-300'
      : tipo === 'convite'
        ? 'bg-violet-500/15 text-violet-300'
        : 'bg-emerald-500/15 text-emerald-300'

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-2 pt-4 md:px-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Bell size={17} className="text-emerald-400" /><h2 className="font-semibold">Notificações e alertas</h2></div>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">{alertasPainel.length} agora</span>
          </div>
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
            {carregando ? <p className="p-4 text-sm text-slate-500">Carregando...</p> : alertasPainel.length === 0 ? (
              <div className="p-5 text-sm text-slate-400"><Check size={16} className="mb-2 text-emerald-400" />Nenhum alerta operacional neste momento.</div>
            ) : alertasPainel.map(alerta => (
              <Link key={alerta.id} href={alerta.href} className="flex items-center gap-3 px-3 py-3 transition hover:bg-white/5">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${corAlerta(alerta.tipo)}`}>
                  {alerta.tipo === 'atraso' ? <AlertTriangle size={15}/> : alerta.tipo === 'agenda' ? <Clock3 size={15}/> : alerta.tipo === 'convite' ? <Users size={15}/> : <CheckSquare size={15}/>}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-100">{alerta.titulo}</span><span className="block truncate text-xs text-slate-500">{alerta.detalhe}</span></span>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CheckSquare size={17} className="text-emerald-400" /><h2 className="font-semibold">Minhas tarefas</h2></div>
            <div className="flex items-center gap-2"><button onClick={() => void abrirTarefa()} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Nova tarefa"><Plus size={14}/></button><Link href="/tarefas" className="text-xs font-medium text-blue-300 hover:text-blue-200">Ver todas</Link></div>
          </div>
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
            {carregando ? <p className="p-4 text-sm text-slate-500">Carregando...</p> : tarefasAbertas.length === 0 ? <p className="p-5 text-sm text-slate-400">Nenhuma tarefa pendente.</p> : tarefasAbertas.slice(0, 5).map(t => {
              const vencida = !!t.data_hora && new Date(t.data_hora).getTime() < Date.now()
              return <div key={t.id} className="flex items-center gap-3 px-3 py-3">
                <button onClick={() => void concluir(t)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-slate-500 text-transparent hover:border-emerald-400 hover:text-emerald-400"><Check size={14}/></button>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-100">{t.titulo}</span>{t.solicitante_nome && t.solicitante_id !== usuario?.id && <span className="block truncate text-[10px] text-blue-300">Criada por {t.solicitante_nome}</span>}</span>
                <span className={`flex-shrink-0 text-xs ${vencida ? 'font-semibold text-red-300' : 'text-slate-500'}`}>{vencida ? 'Atrasada' : t.data_hora ? hora(t.data_hora) : 'Sem prazo'}</span>
              </div>
            })}
          </div>
        </article>
      </div>

      <article id="agenda-home" className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><CalendarDays size={18} className="text-blue-300"/><div><h2 className="font-semibold">Agenda / Calendário</h2><p className="text-xs text-slate-500">Compromissos próprios e convites da equipe</p></div></div>
          <button onClick={() => void abrirEvento()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><Plus size={14}/> Novo compromisso</button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className="mb-3 flex items-center justify-between"><button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-1 text-slate-500 hover:text-white"><ChevronLeft size={16}/></button><strong className="text-sm">{MESES[mes.getMonth()]} {mes.getFullYear()}</strong><button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-1 text-slate-500 hover:text-white"><ChevronRight size={16}/></button></div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-600">{DIAS.map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}</div>
            <div className="mt-1 grid grid-cols-7 gap-1">{celulas.map((d, i) => d ? (
              <button key={d.toISOString()} onClick={() => setDiaSelecionado(d)} className={`relative h-9 rounded-lg text-xs transition ${mesmoDia(d, diaSelecionado) ? 'bg-emerald-500 font-bold text-slate-950' : mesmoDia(d, new Date()) ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                {d.getDate()}
                {eventos.some(e => e.meuStatus !== 'recusado' && mesmoDia(new Date(e.data_inicio), d)) && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${mesmoDia(d, diaSelecionado) ? 'bg-slate-950' : 'bg-blue-300'}`}/>} 
              </button>
            ) : <span key={`vazio-${i}`} className="h-9"/> )}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-blue-300">{tituloDia}</p><h3 className="text-sm font-semibold text-white">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(diaSelecionado)}</h3></div></div>
            {agendaDoDia.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhum compromisso neste dia.</p> : <div className="space-y-2">{agendaDoDia.map(e => (
              <div key={`${e.id}-${e.meuStatus}`} className="flex items-start gap-3 rounded-xl border border-white/10 px-3 py-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400"/>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-100">{hora(e.data_inicio)} · {e.titulo}</strong>{e.meuStatus === 'pendente' && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Convite pendente</span>}</div>{e.local && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={11}/>{e.local}</p>}</div>
              </div>
            ))}</div>}
          </div>
        </div>
      </article>

      {modalTarefa && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.currentTarget === e.target) setModalTarefa(false) }}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Tarefa</p><h3 className="text-lg font-bold text-slate-900">Nova tarefa</h3></div><button onClick={() => setModalTarefa(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={18}/></button></div><div className="space-y-3"><input value={tituloTarefa} onChange={e => setTituloTarefa(e.target.value)} placeholder="O que precisa ser feito?" autoFocus className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/><div><label className="mb-1 block text-xs font-medium text-slate-500">Responsável</label><select value={responsavelTarefaId || usuario?.id || ''} onChange={e => setResponsavelTarefaId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{usuariosTarefa.map(u => <option key={u.id} value={u.id}>{u.id === usuario?.id ? `${u.nome} (eu)` : u.nome}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><input type="date" value={dataTarefa} onChange={e => setDataTarefa(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><input type="time" value={horaTarefa} onChange={e => setHoraTarefa(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div>{responsavelTarefaId && responsavelTarefaId !== usuario?.id && <div><label className="mb-1 block text-xs font-medium text-slate-500">Prioridade</label><select value={prioridadeTarefa} onChange={e => setPrioridadeTarefa(e.target.value as PrioridadeTarefa)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>}<button disabled={salvando || !tituloTarefa.trim()} onClick={() => void salvarTarefa()} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">{salvando ? 'Salvando...' : ((responsavelTarefaId && responsavelTarefaId !== usuario?.id) ? 'Atribuir tarefa' : 'Criar tarefa')}</button></div></div></div>}

      {modalEvento && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.currentTarget === e.target) setModalEvento(false) }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Agenda</p><h3 className="text-lg font-bold text-slate-900">Novo compromisso</h3></div><button onClick={() => setModalEvento(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={18}/></button></div><div className="space-y-3"><input value={tituloEvento} onChange={e => setTituloEvento(e.target.value)} placeholder="Título do compromisso" autoFocus className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><input value={localEvento} onChange={e => setLocalEvento(e.target.value)} placeholder="Local (opcional)" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs text-slate-500">Início</label><input type="time" value={inicioEvento} onChange={e => setInicioEvento(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div><div><label className="mb-1 block text-xs text-slate-500">Fim</label><input type="time" value={fimEvento} onChange={e => setFimEvento(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div></div>{usuariosConvidaveis.length > 0 && <div><p className="mb-2 text-xs font-semibold text-slate-600">Convidar usuários</p><div className="flex flex-wrap gap-2">{usuariosConvidaveis.map(u => <button key={u.id} onClick={() => setConvidados(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${convidados.includes(u.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{primeiroNome(u.nome)}</button>)}</div></div>}<button disabled={salvando || !tituloEvento.trim()} onClick={() => void salvarEvento()} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">{salvando ? 'Salvando...' : 'Adicionar à agenda'}</button></div></div></div>}
    </section>
  )
}
