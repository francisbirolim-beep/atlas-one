'use client'

import { useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface BotaoMicrofoneProps {
  onResultado: (texto: string) => void
  titulo?: string
  className?: string
}

export default function BotaoMicrofone({ onResultado, titulo, className }: BotaoMicrofoneProps) {
  const [gravando, setGravando] = useState(false)
  const [suportado, setSuportado] = useState(true)
  const recRef = useRef<any>(null)

  function alternar() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSuportado(false)
      alert('Reconhecimento de voz não é suportado neste navegador. Tente pelo Chrome no celular ou computador.')
      return
    }
    if (gravando) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const texto = e.results?.[0]?.[0]?.transcript
      if (texto) onResultado(texto)
    }
    rec.onend = () => setGravando(false)
    rec.onerror = () => setGravando(false)
    recRef.current = rec
    try {
      rec.start()
      setGravando(true)
    } catch {
      setGravando(false)
    }
  }

  if (!suportado) return null

  return (
    <button
      type="button"
      onClick={alternar}
      title={titulo || (gravando ? 'Ouvindo... clique para parar' : 'Falar')}
      className={
        className ||
        `p-2 rounded-xl border transition-colors ${
          gravando
            ? 'bg-red-500 border-red-500 text-white animate-pulse'
            : 'border-slate-300 text-slate-500 hover:text-brand-navy hover:border-brand-navy'
        }`
      }
    >
      {gravando ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  )
}
