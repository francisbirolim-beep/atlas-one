'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, CalendarClock, CheckSquare, Users } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarTarefas } from '@/lib/tarefas'
import { listarEventosDoUsuario, type EventoComConvite } from '@/lib/eventos'
import type { TarefaPessoal } from '@/lib/tipos'

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

type Alerta = { id: string; titulo: string; detalhe: string; href: string; tipo: 'atraso' | 'agenda' | 'convite' | 'tarefa' }

export default function HomeNotificationBell() {
  const [aberto, setAberto] = useState(false)
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [eventos, setEventos] = useState<EventoComConvite[]>([])

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!u) return
      const [tfs, evs] = await Promise.all([listarTarefas(u.id), listarEventosDoUsuario(u.id)])
      if (!ativo) return
      setTarefas(tfs)
      setEventos(evs)
    })
    return () => { ativo = false }
  }, [])

  const alertas = useMemo<Alerta[]>(() => {
    const agora = Date.now()
    const lista: Alerta[] = []
    const abertas = tarefas.filter(t => !t.concluida_em)
    const vencidas = abertas.filter(t => t.data_hora && new Date(t.data_hora).getTime() < agora)
    if (vencidas.length) lista.push({ id: 'vencidas', tipo: 'atraso', href: '/tarefas', titulo: `${vencidas.length} tarefa${vencidas.length > 1 ? 's' : ''} atrasada${vencidas.length > 1 ? 's' : ''}`, detalhe: vencidas[0].titulo })

    const convites = eventos.filter(e => e.meuStatus === 'pendente')
    if (convites.length) lista.push({ id: 'convites', tipo: 'convite', href: '/', titulo: `${convites.length} convite${convites.length > 1 ? 's' : ''} de agenda`, detalhe: convites[0].titulo })

    const proximos = eventos
      .filter(e => e.meuStatus !== 'recusado')
      .filter(e => {
        const quando = new Date(e.data_inicio).getTime()
        return quando >= agora && quando <= agora + 60 * 60 * 1000
      })
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    if (proximos.length) lista.push({ id: 'proximo', tipo: 'agenda', href: '/#agenda-home', titulo: 'Compromisso em breve', detalhe: `${hora(proximos[0].data_inicio)} · ${proximos[0].titulo}` })

    const hoje = new Date()
    const paraHoje = abertas.filter(t => t.data_hora && new Date(t.data_hora).toDateString() === hoje.toDateString() && new Date(t.data_hora).getTime() >= agora)
    if (paraHoje.length) lista.push({ id: 'hoje', tipo: 'tarefa', href: '/tarefas', titulo: `${paraHoje.length} tarefa${paraHoje.length > 1 ? 's' : ''} para hoje`, detalhe: paraHoje[0].titulo })
    return lista
  }, [eventos, tarefas])

  const Icone = ({ tipo }: { tipo: Alerta['tipo'] }) => tipo === 'atraso'
    ? <AlertTriangle size={14}/>
    : tipo === 'agenda'
      ? <CalendarClock size={14}/>
      : tipo === 'convite'
        ? <Users size={14}/>
        : <CheckSquare size={14}/>

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(v => !v)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50" title="Alertas operacionais">
        <Bell size={17}/>
        {alertas.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{alertas.length}</span>}
      </button>
      {aberto && <div className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-semibold text-slate-900">Alertas</p><p className="text-[11px] text-slate-400">Gerados a partir da operação atual</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{alertas.length}</span></div>
        {alertas.length === 0 ? <p className="px-4 py-5 text-sm text-slate-400">Nenhum alerta agora.</p> : <div className="divide-y divide-slate-100">{alertas.map(a => <Link key={a.id} href={a.href} onClick={() => setAberto(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"><span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${a.tipo === 'atraso' ? 'bg-red-50 text-red-600' : a.tipo === 'agenda' ? 'bg-blue-50 text-blue-600' : a.tipo === 'convite' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'}`}><Icone tipo={a.tipo}/></span><span className="min-w-0"><span className="block text-sm font-medium text-slate-800">{a.titulo}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{a.detalhe}</span></span></Link>)}</div>}
        <Link href="/" onClick={() => setAberto(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-brand-navy hover:bg-slate-50">Abrir central operacional</Link>
      </div>}
    </div>
  )
}
