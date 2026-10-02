'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

export type AudioChatEnviado = {
  arquivo: File
  transcricao: string
  url: string
  storagePath?: string
  duracaoSeg: number
  mediaType: string
}

interface Props {
  onEnviar: (audio: AudioChatEnviado) => void | Promise<void>
  disabled?: boolean
}

function mimePreferido() {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
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
  const inicioRef = useRef(0)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function processar(blob: Blob, duracaoSeg: number) {
    if (!blob.size) return
    setProcessando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no Atlas.')

      const mediaType = blob.type.split(';')[0] || 'audio/webm'
      const ext = mediaType.includes('mp4') ? 'm4a' : mediaType.includes('ogg') ? 'ogg' : 'webm'
      const arquivo = new File([blob], `audio-atlas-${Date.now()}.${ext}`, { type: mediaType })
      const formUpload = new FormData()
      formUpload.append('audio', arquivo)
      formUpload.append('duracaoSeg', String(duracaoSeg))
      const formTranscricao = new FormData()
      formTranscricao.append('audio', arquivo)

      const [respUpload, respTranscricao] = await Promise.all([
        fetch('/api/ia/audio', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formUpload,
        }),
        fetch('/api/agente/transcrever', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formTranscricao,
        }),
      ])

      const [upload, transcricao] = await Promise.all([
        respUpload.json().catch(() => ({})),
        respTranscricao.json().catch(() => ({})),
      ])
      if (!respUpload.ok) throw new Error(upload.error || 'Não foi possível salvar o áudio.')
      if (!respTranscricao.ok) throw new Error(transcricao.error || 'Não foi possível transcrever o áudio.')
      const texto = String(transcricao.text || '').trim()
      if (!texto) throw new Error('Não foi possível entender o áudio.')
      await onEnviar({
        arquivo,
        transcricao: texto,
        url: String(upload.signedUrl || URL.createObjectURL(arquivo)),
        storagePath: upload.storagePath || undefined,
        duracaoSeg,
        mediaType,
      })
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      partesRef.current = []
      const mime = mimePreferido()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      inicioRef.current = Date.now()

      recorder.ondataavailable = evento => {
        if (evento.data.size) partesRef.current.push(evento.data)
      }
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setGravando(false)
        const duracao = Math.max(1, Math.round((Date.now() - inicioRef.current) / 1000))
        setSegundos(0)
        const blob = new Blob(partesRef.current, { type: recorder.mimeType || 'audio/webm' })
        void processar(blob, duracao)
      }
      recorder.start(250)
      setSegundos(0)
      setGravando(true)
      timerRef.current = setInterval(() => {
        setSegundos(Math.max(0, Math.floor((Date.now() - inicioRef.current) / 1000)))
      }, 500)
    } catch {
      alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={disabled || processando}
      aria-label={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'}
      title={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'}
      className={`inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-2.5 transition disabled:opacity-40 ${
        gravando ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {processando ? <Loader2 size={19} className="animate-spin" /> : gravando ? <><Square size={15}/><span className="ml-1 text-[10px] font-bold">{segundos}s</span></> : <Mic size={20}/>}
    </button>
  )
}