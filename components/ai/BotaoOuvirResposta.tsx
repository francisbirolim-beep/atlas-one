'use client'

import { useEffect, useMemo, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'

type Props = {
  texto: string
  className?: string
}

function limparTexto(texto: string) {
  return texto
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_#>`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function BotaoOuvirResposta({ texto, className = '' }: Props) {
  const [suportado, setSuportado] = useState(false)
  const [falando, setFalando] = useState(false)
  const textoFalado = useMemo(() => limparTexto(texto), [texto])

  useEffect(() => {
    setSuportado(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function parar() {
    window.speechSynthesis.cancel()
    setFalando(false)
  }

  function ouvir() {
    if (!textoFalado) return

    window.speechSynthesis.cancel()

    const fala = new SpeechSynthesisUtterance(textoFalado)
    fala.lang = 'pt-BR'
    fala.rate = 1
    fala.pitch = 1
    fala.volume = 1

    const vozes = window.speechSynthesis.getVoices()
    const vozPtBr = vozes.find(v => v.lang.toLowerCase() === 'pt-br')
      || vozes.find(v => v.lang.toLowerCase().startsWith('pt'))
    if (vozPtBr) fala.voice = vozPtBr

    fala.onstart = () => setFalando(true)
    fala.onend = () => setFalando(false)
    fala.onerror = () => setFalando(false)

    window.speechSynthesis.speak(fala)
  }

  if (!suportado || !textoFalado) return null

  return (
    <button
      type="button"
      onClick={falando ? parar : ouvir}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${className}`}
      title={falando ? 'Parar leitura' : 'Ouvir resposta'}
      aria-label={falando ? 'Parar leitura da resposta' : 'Ouvir resposta em voz alta'}
    >
      {falando ? <Square size={13} /> : <Volume2 size={14} />}
      {falando ? 'Parar' : 'Ouvir'}
    </button>
  )
}