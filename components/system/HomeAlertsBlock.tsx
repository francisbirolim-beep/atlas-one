'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Clock3 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarNotificacoes } from '@/lib/notificacoes'
import type { Notificacao } from '@/lib/tipos'

function quando(iso: string) {
  const data = new Date(iso)
  const agora = Date.now()
  const diffMin = Math.round((agora - data.getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data)
}

export default function HomeAlertsBlock() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async usuario => {
      if (!usuario) { if (ativo) setCarregando(false); return }
      const lista = await listarNotificacoes(usuario.id, 6)
      if (!ativo) return
      setNotificacoes(lista)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Bell size={17} className="text-violet-300" /><h2 className="font-semibold">Notificações e alertas</h2></div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">{notificacoes.length} recentes</span>
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
        {carregando ? <p className="p-4 text-sm text-slate-500">Carregando notificações...</p> : notificacoes.length === 0 ? (
          <div className="p-5 text-sm text-slate-400"><Check size={16} className="mb-2 text-emerald-400" />Nenhuma notificação pendente.</div>
        ) : notificacoes.map(notificacao => (
          <Link key={notificacao.id} href={notificacao.href || '/'} className="flex items-start gap-3 px-3 py-3 transition hover:bg-white/5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"><Bell size={14}/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{notificacao.titulo}</p><p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{notificacao.mensagem || notificacao.criado_por_nome || 'Nova notificação'}</p></div>
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-600"><Clock3 size={10}/>{quando(notificacao.created_at)}</span>
          </Link>
        ))}
      </div>
    </article>
  )
}
