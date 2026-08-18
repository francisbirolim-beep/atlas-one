'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Volume2, VolumeX } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  assinarNovasNotificacoes,
  carregarPreferenciasNotificacao,
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  salvarPreferenciasNotificacao,
} from '@/lib/notificacoes'
import type { Notificacao, NotificacaoPreferencias, Usuario } from '@/lib/tipos'

function tempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function HomeNotificationBell() {
  const [aberto, setAberto] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [preferencias, setPreferencias] = useState<NotificacaoPreferencias | null>(null)
  const preferenciasRef = useRef<NotificacaoPreferencias | null>(null)

  function tocarSom(volume?: number) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(Math.max(0.02, Math.min(0.2, (volume ?? 0.6) * 0.18)), ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.22)
      setTimeout(() => void ctx.close(), 400)
    } catch {
      // Browser pode bloquear áudio até existir interação do usuário.
    }
  }

  useEffect(() => {
    let ativo = true
    let limpar: (() => void) | undefined
    usuarioAtual().then(async u => {
      if (!ativo || !u) return
      setUsuario(u)
      const [lista, prefs] = await Promise.all([
        listarNotificacoes(u.id),
        carregarPreferenciasNotificacao(u.id),
      ])
      if (!ativo) return
      setNotificacoes(lista)
      setPreferencias(prefs)
      preferenciasRef.current = prefs
      limpar = assinarNovasNotificacoes(u.id, nova => {
        setNotificacoes(prev => [nova, ...prev.filter(n => n.id !== nova.id)].slice(0, 30))
        const atual = preferenciasRef.current
        if (!atual?.som_ativo) return
        const categoriaAtiva = nova.categoria === 'tarefas' ? atual.tarefas
          : nova.categoria === 'agenda' ? atual.agenda
          : nova.categoria === 'chat' ? atual.chat
          : atual.operacao
        if (categoriaAtiva) tocarSom(atual.som_volume)
      })
    })
    return () => { ativo = false; limpar?.() }
  }, [])

  const naoLidas = useMemo(() => notificacoes.filter(n => !n.lida_em).length, [notificacoes])

  async function abrirNotificacao(n: Notificacao) {
    if (!n.lida_em) {
      const agora = new Date().toISOString()
      setNotificacoes(prev => prev.map(item => item.id === n.id ? { ...item, lida_em: agora } : item))
      await marcarNotificacaoLida(n.id)
    }
    setAberto(false)
  }

  async function marcarTodas() {
    if (!usuario) return
    const agora = new Date().toISOString()
    setNotificacoes(prev => prev.map(n => n.lida_em ? n : { ...n, lida_em: agora }))
    await marcarTodasNotificacoesLidas(usuario.id)
  }

  async function alternarSom() {
    if (!usuario) return
    const novoValor = !preferencias?.som_ativo
    const base = preferencias || {
      usuario_id: usuario.id, som_ativo: false, som_volume: 0.6,
      tarefas: true, agenda: true, chat: true, operacao: true,
    }
    const otimista = { ...base, som_ativo: novoValor }
    setPreferencias(otimista)
    preferenciasRef.current = otimista
    if (novoValor) tocarSom(otimista.som_volume)
    const salvo = await salvarPreferenciasNotificacao(usuario.id, { som_ativo: novoValor })
    if (salvo) {
      setPreferencias(salvo)
      preferenciasRef.current = salvo
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(v => !v)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50" title="Notificações">
        <Bell size={17}/>
        {naoLidas > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>

      {aberto && <div className="absolute right-0 top-12 z-50 w-[min(94vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div><p className="text-sm font-semibold text-slate-900">Notificações</p><p className="text-[11px] text-slate-400">{naoLidas} não lida{naoLidas === 1 ? '' : 's'}</p></div>
          <div className="flex items-center gap-1">
            <button onClick={() => void alternarSom()} className={`rounded-lg p-2 ${preferencias?.som_ativo ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-50'}`} title={preferencias?.som_ativo ? 'Som ligado' : 'Ativar som'}>
              {preferencias?.som_ativo ? <Volume2 size={15}/> : <VolumeX size={15}/>}
            </button>
            {naoLidas > 0 && <button onClick={() => void marcarTodas()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" title="Marcar todas como lidas"><CheckCheck size={15}/></button>}
          </div>
        </div>

        {notificacoes.length === 0 ? (
          <div className="px-4 py-6 text-center"><Bell size={20} className="mx-auto mb-2 text-slate-300"/><p className="text-sm text-slate-400">Nenhuma notificação persistente ainda.</p><p className="mt-1 text-[11px] text-slate-300">Tarefas atribuídas e convites de agenda aparecerão aqui.</p></div>
        ) : (
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">{notificacoes.map(n => (
            <Link key={n.id} href={n.href || '/'} onClick={() => void abrirNotificacao(n)} className={`block px-4 py-3 transition hover:bg-slate-50 ${!n.lida_em ? 'bg-blue-50/45' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${!n.lida_em ? 'bg-blue-500' : 'bg-slate-200'}`}/>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{n.titulo}</span>{n.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.mensagem}</span>}<span className="mt-1 block text-[10px] uppercase tracking-wide text-slate-300">{n.categoria} · {tempoRelativo(n.created_at)}</span></span>
              </div>
            </Link>
          ))}</div>
        )}

        <div className="border-t border-slate-100 px-4 py-2.5 text-center text-[11px] text-slate-400">Som é opcional e configurado por usuário.</div>
      </div>}
    </div>
  )
}
