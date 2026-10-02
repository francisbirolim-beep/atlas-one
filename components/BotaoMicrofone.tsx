'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

interface BotaoMicrofoneProps {
  onResultado: (texto: string) => void
  titulo?: string
  className?: string
}

function melhorMimeAudio() {
  if (typeof MediaRecorder === 'undefined') return ''
  const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return tipos.find(tipo => MediaRecorder.isTypeSupported(tipo)) || ''
}

export default function BotaoMicrofone({ onResultado, titulo, className }: BotaoMicrofoneProps) {
  const [gravando, setGravando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const gravadorRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const partesRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function transcrever(blob: Blob) {
    if (!blob.size) return
    setProcessando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada')
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('audio', new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' }))
      const resposta = await fetch('/api/agente/transcrever', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resposta.json()
      if (!resposta.ok) throw new Error(json.error || 'Falha ao transcrever áudio')
      if (json.text) onResultado(String(json.text))
    } catch (e: any) {
      alert(e?.message || 'Não foi possível entender o áudio.')
    } finally {
      setProcessando(false)
    }
  }
  async function alternar() {
    if (processando) return
    if (gravando) {
      gravadorRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Gravação de áudio não é suportada neste navegador.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      partesRef.current = []
      const mime = melhorMimeAudio()
      const gravador = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      gravadorRef.current = gravador

      gravador.ondataavailable = evento => {
        if (evento.data.size) partesRef.current.push(evento.data)
      }
      gravador.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setGravando(false)
        setSegundos(0)
        const blob = new Blob(partesRef.current, { type: gravador.mimeType || 'audio/webm' })
        void transcrever(blob)
      }
      gravador.onerror = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setGravando(false)
        setSegundos(0)
      }

      gravador.start(250)
      setSegundos(0)
      setGravando(true)
      timerRef.current = setInterval(() => setSegundos(valor => valor + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  const classe = className || `p-2 rounded-xl border transition-colors ${
    gravando
      ? 'bg-red-500 border-red-500 text-white'
      : 'border-slate-300 text-slate-500 hover:text-brand-navy hover:border-brand-navy'
  }`

  return (
    <button type="button" onClick={alternar} disabled={processando}
      title={titulo || (gravando ? 'Parar gravação' : 'Gravar áudio')}
      className={classe + ' disabled:opacity-50'}>
      {processando ? <Loader2 size={16} className="animate-spin" /> : gravando ? <><Square size={14} /><span className="ml-1 text-[10px]">{segundos}s</span></> : <Mic size={16} />}
    </button>
  )
}