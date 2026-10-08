'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  PREFERENCIAS_PADRAO,
  assinarNovasNotificacoes,
  carregarPreferenciasNotificacao,
  marcarNotificacaoLida,
} from '@/lib/notificacoes'
import type { Notificacao, NotificacaoPreferencias } from '@/lib/tipos'

function categoriaAtiva(n: Notificacao, prefs: NotificacaoPreferencias | null) {
  const atual = prefs || PREFERENCIAS_PADRAO
  return n.categoria === 'tarefas' ? atual.tarefas
    : n.categoria === 'agenda' ? atual.agenda
    : n.categoria === 'chat' ? atual.chat
    : atual.operacao
}

function origemToast(n: Notificacao) {
  const href = n.href || ''
  if (href.startsWith('/chat')) return 'Conversa interna'
  if (href.startsWith('/whatsapp')) return 'WhatsApp'
  return 'Mensagem'
}

export default function ChatNotificationToast() {
  const router = useRouter()
  const [toast, setToast] = useState<Notificacao | null>(null)
  const preferenciasRef = useRef<NotificacaoPreferencias | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function mostrar(n: Notificacao) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(n)
    timerRef.current = setTimeout(() => {
      setToast(atual => atual?.id === n.id ? null : atual)
      timerRef.current = null
    }, 5000)
  }

  useEffect(() => {
    let ativo = true
    let limpar: (() => void) | undefined
    usuarioAtual().then(async usuario => {
      if (!ativo || !usuario) return
      const prefs = await carregarPreferenciasNotificacao(usuario.id)
      if (!ativo) return
      preferenciasRef.current = prefs
      limpar = assinarNovasNotificacoes(usuario.id, nova => {
        if (nova.categoria === 'chat' && categoriaAtiva(nova, preferenciasRef.current)) mostrar(nova)
      })
    })
    return () => {
      ativo = false
      limpar?.()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function abrir(n: Notificacao) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setToast(null)
    if (!n.lida_em) await marcarNotificacaoLida(n.id)
    router.push(n.href || '/')
  }

  if (!toast) return null

  return (
    <button
      type="button"
      onClick={() => void abrir(toast)}
      className="fixed right-4 top-4 z-[120] w-[min(92vw,360px)] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-50 sm:right-6 sm:top-6"
      aria-live="polite"
    >
      <span className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <MessageCircle size={18}/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-blue-600">{origemToast(toast)}</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{toast.titulo}</span>
          {toast.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{toast.mensagem}</span>}
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">Clique para abrir</span>
        </span>
      </span>
    </button>
  )
}
