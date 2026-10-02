'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type AudioEnviado = { arquivo: File; transcricao: string; urlLocal: string }

interface Props {
  onEnviar: (audio: AudioEnviado) => void | Promise<void>
  disabled?: boolean
}

function mimePreferido() {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find(tipo => MediaRecorder.isTypeSupported(tipo)) || ''
}

export default function GravadorAudioChat({ onEnviar, disabled }: Props) {
  const [gravando, setGravando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const partesRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function transcreverEEnviar(blob: Blob) {
    setProcessando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no Atlas.')
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
      const arquivo = new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' })
      const form = new FormData()
      form.append('audio', arquivo)
      const resposta = await fetch('/api/agente/transcrever', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resposta.json()
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível transcrever o áudio.')
      const transcricao = String(json.text || '').trim()
      if (!transcricao) throw new Error('Não foi possível entender o áudio.')
      await onEnviar({ arquivo, transcricao, urlLocal: URL.createObjectURL(arquivo) })
    } catch (e: any) {
      alert(e?.message || 'Não foi possível enviar o áudio.')
    } finally {
      setProcessando(false)
    }
  }
  async function alternar() {
    if (disabled || processando) return
    if (gravando) {
      recorderRef.current?.stop()
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
      const mime = mimePreferido()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = evento => {
        if (evento.data.size) partesRef.current.push(evento.data)
      }
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setGravando(false)
        setSegundos(0)
        const blob = new Blob(partesRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size) void transcreverEEnviar(blob)
      }
      recorder.start(250)
      setSegundos(0)
      setGravando(true)
      timerRef.current = setInterval(() => setSegundos(valor => valor + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  return (
    <button type="button" onClick={alternar} disabled={disabled || processando}
      aria-label={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'}
      title={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'}
      className={`inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-2.5 transition disabled:opacity-40 ${
        gravando ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}>
      {processando ? <Loader2 size={19} className="animate-spin" /> : gravando ? <><Square size={15}/><span className="ml-1 text-[10px] font-bold">{segundos}s</span></> : <Mic size={20}/>}
    </button>
  )
}