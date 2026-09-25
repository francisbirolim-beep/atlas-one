'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

const POS_KEY = 'atlas-atendimento-fab-position'

export default function BotaoChatGlobal() {
  const pathname = usePathname()
  const router = useRouter()
  const [naoLidas, setNaoLidas] = useState(0)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(POS_KEY)
      if (saved) setPos(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    let ativo = true
    let canal: any
    void usuarioAtual().then(async eu => {
      if (!eu || !ativo) return
      const atualizar = async () => {
        const { data: ps } = await supabase.from('chat_participantes').select('conversa_id,ultima_leitura_em').eq('usuario_id', eu.id)
        let total = 0
        for (const p of ps || []) {
          let q = supabase.from('chat_mensagens').select('id', { count: 'exact', head: true }).eq('conversa_id', p.conversa_id).neq('usuario_id', eu.id)
          if (p.ultima_leitura_em) q = q.gt('created_at', p.ultima_leitura_em)
          const { count } = await q
          total += count || 0
        }
        if (ativo) setNaoLidas(total)
      }
      await atualizar()
      canal = supabase.channel('chat-global-' + eu.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, async payload => {
        const m = payload.new as any
        if (m.usuario_id === eu.id) return
        const { data: p } = await supabase.from('chat_participantes').select('id').eq('conversa_id', m.conversa_id).eq('usuario_id', eu.id).maybeSingle()
        if (!p) return
        setNaoLidas(n => n + 1)
        if (typeof document !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(m.usuario_nome || 'Atlas Atendimento', {
            body: m.texto || m.anexo_nome || 'Nova mensagem',
            tag: 'atlas-atendimento-' + m.conversa_id,
          })
        }
      }).subscribe()
    })
    return () => { ativo = false; if (canal) void supabase.removeChannel(canal) }
  }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return
      drag.current.moved = true
      const size = 56
      const x = Math.max(8, Math.min(window.innerWidth - size - 8, e.clientX - drag.current.dx))
      const y = Math.max(8, Math.min(window.innerHeight - size - 8, e.clientY - drag.current.dy))
      setPos({ x, y })
    }
    const up = () => {
      if (!drag.current) return
      if (drag.current.moved && pos) localStorage.setItem(POS_KEY, JSON.stringify(pos))
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [pos])

  if (pathname.startsWith('/atendimento')) return null

  const style = pos ? { left: pos.x, top: pos.y } : undefined
  return (
    <button
      type="button"
      aria-label="Abrir Atendimento WhatsApp"
      title="Atendimento WhatsApp — arraste para mover"
      style={style}
      onPointerDown={e => {
        const r = e.currentTarget.getBoundingClientRect()
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onClick={() => {
        if (drag.current?.moved) return
        router.push('/atendimento')
      }}
      className={(pos ? '' : 'bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 sm:bottom-6 sm:right-6 ') + 'fixed z-[80] flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2'}
    >
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor">
        <path d="M16.04 3C8.86 3 3.02 8.8 3.02 15.94c0 2.52.73 4.98 2.1 7.08L3 29l6.17-2.03a13.08 13.08 0 0 0 6.86 1.9h.01c7.18 0 13.02-5.8 13.02-12.94C29.06 8.8 23.22 3 16.04 3Zm7.65 18.48c-.32.9-1.87 1.72-2.58 1.82-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.42-2.2-.81-3.87-1.65-6.4-5.49-6.59-5.74-.19-.26-1.57-2.08-1.57-3.97 0-1.89.99-2.82 1.34-3.2.35-.39.77-.48 1.03-.48h.74c.24 0 .56-.09.88.67.32.77 1.09 2.65 1.19 2.84.1.19.16.42.03.67-.13.26-.19.42-.39.64-.19.23-.41.5-.58.67-.19.19-.39.4-.17.78.23.39 1 1.65 2.15 2.67 1.48 1.31 2.72 1.72 3.11 1.91.39.19.61.16.84-.1.23-.26.96-1.12 1.22-1.5.26-.39.51-.32.87-.19.35.13 2.25 1.06 2.64 1.25.39.19.64.29.74.45.09.16.09.93-.23 1.83Z" />
      </svg>
      {naoLidas > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      <span className="sr-only">Atendimento WhatsApp</span>
    </button>
  )
}
