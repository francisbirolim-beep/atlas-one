'use client'

import { useEffect, useState } from 'react'
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react'
import { contarPendentes } from '@/lib/offlineFila'
import { sincronizarFilaOffline } from '@/lib/sincronizarFila'

export default function SincronizadorOffline() {
  const [pendentes, setPendentes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  async function atualizarContagem() {
    const n = await contarPendentes()
    setPendentes(n)
  }

  async function tentarSincronizar() {
    setSincronizando(true)
    try {
      const { enviados } = await sincronizarFilaOffline()
      if (enviados > 0) {
        setMensagemSucesso(
          `${enviados} pedido${enviados > 1 ? 's' : ''} enviado${enviados > 1 ? 's' : ''} com sucesso!`
        )
        setTimeout(() => setMensagemSucesso(''), 5000)
      }
    } finally {
      setSincronizando(false)
      atualizarContagem()
    }
  }

  useEffect(() => {
    atualizarContagem()
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      tentarSincronizar()
    }

    function aoFicarOnline() {
      tentarSincronizar()
    }

    window.addEventListener('online', aoFicarOnline)
    const intervalo = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) tentarSincronizar()
    }, 30000)

    return () => {
      window.removeEventListener('online', aoFicarOnline)
      clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (pendentes === 0 && !mensagemSucesso) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]">
      {mensagemSucesso ? (
        <div className="bg-brand-teal text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm">
          <CheckCircle2 size={18} />
          {mensagemSucesso}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-sm">
          <WifiOff size={18} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-slate-700 font-medium">
              {pendentes} pedido{pendentes > 1 ? 's' : ''} salvo{pendentes > 1 ? 's' : ''} aguardando internet
            </p>
            <p className="text-xs text-slate-400">
              {pendentes > 1 ? 'Serão enviados' : 'Será enviado'} automaticamente
            </p>
          </div>
          <button
            onClick={tentarSincronizar}
            disabled={sincronizando}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-100 text-brand-navy disabled:opacity-50"
            title="Tentar enviar agora"
          >
            <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
          </button>
        </div>
      )}
    </div>
  )
}
