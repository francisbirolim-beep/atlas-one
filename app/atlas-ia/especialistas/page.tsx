'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Camera, CheckCircle2, ExternalLink, FileText, Loader2, MessageCircle, Mic, Paperclip, Send, ShieldCheck, Sparkles, Square, ThumbsUp, X } from 'lucide-react'
import Link from 'next/link'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario } from '@/lib/setores'
import { AI_ESPECIALISTAS, type AIEspecialista } from '@/lib/ai/specialists'
import type { AIModulo } from '@/lib/ai/types'
import BotaoOuvirResposta from '@/components/ai/BotaoOuvirResposta'

type Bolha = {
  papel: 'user' | 'assistant'
  texto: string
  interacaoId?: string | null
  fontesPublicas?: Array<{ titulo: string; url: string; trecho?: string }>
  audioUrl?: string
  audioDuracaoSeg?: number
}

type AudioEnviado = {
  storagePath: string
  mediaType: string
  duracaoSeg: number
  transcricaoAutomatica: boolean
}

type Anexo = {
  nome: string
  mediaType: string
  tipo: 'imagem' | 'pdf' | 'texto'
  dados: string
}

const MAX_ARQUIVO = 6 * 1024 * 1024
const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function limparTextoFalado(texto: string) {
  return String(texto || '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#>`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extensao(nome: string) {
  return (nome.split('.').pop() || '').toLowerCase()
}

function ehArquivoTexto(file: File) {
  const ext = extensao(file.name)
  return file.type.startsWith('text/')
    || ['csv', 'json', 'md', 'xml', 'yaml', 'yml', 'log'].includes(ext)
}

function formatarDuracao(segundos: number) {
  const total = Math.max(0, Math.floor(segundos || 0))
  const min = Math.floor(total / 60)
  const seg = total % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

export default function AtlasEspecialistasPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [permissoes, setPermissoes] = useState<Record<string, string>>({})
  const [selecionado, setSelecionado] = useState<AIModulo>('comercial')
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [sessoes, setSessoes] = useState<Partial<Record<AIModulo, string>>>({})
  const [entrada, setEntrada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [avaliados, setAvaliados] = useState<Record<string, boolean>>({})
  const [anexo, setAnexo] = useState<Anexo | null>(null)
  const [processandoAnexo, setProcessandoAnexo] = useState(false)
  const [vozSuportada, setVozSuportada] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [modoConversa, setModoConversa] = useState(false)
  const [falandoResposta, setFalandoResposta] = useState(false)
  const [gravacaoSuportada, setGravacaoSuportada] = useState(false)
  const [gravandoAudio, setGravandoAudio] = useState(false)
  const [enviandoAudio, setEnviandoAudio] = useState(false)
  const [segundosAudio, setSegundosAudio] = useState(0)
  const [transcricaoAudio, setTranscricaoAudio] = useState('')

  const fimRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const reconhecimentoRef = useRef<any>(null)
  const modoConversaRef = useRef(false)
  const modoReconhecimentoRef = useRef<'ditado' | 'conversa' | null>(null)
  const textoBaseVozRef = useRef('')
  const textoFinalVozRef = useRef('')
  const textoParcialVozRef = useRef('')
  const silencioTimerRef = useRef<number | null>(null)
  const reinicioVozTimerRef = useRef<number | null>(null)
  const turnoConversaEnviadoRef = useRef(false)
  const carregandoRef = useRef(false)
  const falandoRef = useRef(false)
  const gravadorRef = useRef<MediaRecorder | null>(null)
  const streamAudioRef = useRef<MediaStream | null>(null)
  const partesAudioRef = useRef<Blob[]>([])
  const gravandoAudioRef = useRef(false)
  const timerAudioRef = useRef<number | null>(null)
  const inicioAudioRef = useRef(0)
  const reconhecimentoAudioRef = useRef<any>(null)
  const transcricaoAudioFinalRef = useRef('')
  const transcricaoAudioParcialRef = useRef('')

  useEffect(() => {
    ;(async () => {
      const u = await usuarioAtual()
      setUsuario(u)
      if (u?.id && u.role !== 'master') {
        setPermissoes(await listarPermissoesUsuario(u.id))
      }
    })()
  }, [])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bolhas, carregando])

  useEffect(() => {
    carregandoRef.current = carregando
  }, [carregando])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as any
    setVozSuportada(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
    setGravacaoSuportada(Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof w.MediaRecorder !== 'undefined'))

    return () => {
      modoConversaRef.current = false
      modoReconhecimentoRef.current = null
      gravandoAudioRef.current = false
      try { reconhecimentoRef.current?.abort?.() } catch {}
      try { reconhecimentoAudioRef.current?.abort?.() } catch {}
      try { gravadorRef.current?.state !== 'inactive' && gravadorRef.current?.stop?.() } catch {}
      streamAudioRef.current?.getTracks().forEach(track => track.stop())
      if (silencioTimerRef.current) window.clearTimeout(silencioTimerRef.current)
      if (reinicioVozTimerRef.current) window.clearTimeout(reinicioVozTimerRef.current)
      if (timerAudioRef.current) window.clearInterval(timerAudioRef.current)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const especialistas = useMemo(() => {
    if (!usuario) return []
    if (usuario.role === 'master') return AI_ESPECIALISTAS
    return AI_ESPECIALISTAS.filter(e =>
      e.setorIds.some(id => ['consulta', 'edicao'].includes(String(permissoes[id] || '')))
    )
  }, [usuario, permissoes])

  useEffect(() => {
    if (especialistas.length && !especialistas.some(e => e.modulo === selecionado)) {
      setSelecionado(especialistas[0].modulo)
    }
  }, [especialistas, selecionado])

  const atual = AI_ESPECIALISTAS.find(e => e.modulo === selecionado) || AI_ESPECIALISTAS[0]

  function limparTimersVoz() {
    if (silencioTimerRef.current) {
      window.clearTimeout(silencioTimerRef.current)
      silencioTimerRef.current = null
    }
    if (reinicioVozTimerRef.current) {
      window.clearTimeout(reinicioVozTimerRef.current)
      reinicioVozTimerRef.current = null
    }
  }

  function textoAtualVoz() {
    return [textoBaseVozRef.current, textoFinalVozRef.current, textoParcialVozRef.current]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function pararInstanciaReconhecimento(abortar = false) {
    const atual = reconhecimentoRef.current
    reconhecimentoRef.current = null
    if (!atual) {
      setOuvindo(false)
      return
    }
    limparTimersVoz()
    try {
      if (abortar) atual.abort?.()
      else atual.stop?.()
    } catch {}
    setOuvindo(false)
  }

  function pararDitado() {
    const atual = textoAtualVoz()
    if (atual) setEntrada(atual)
    modoReconhecimentoRef.current = null
    pararInstanciaReconhecimento(false)
  }

  function pararConversa() {
    modoConversaRef.current = false
    modoReconhecimentoRef.current = null
    setModoConversa(false)
    turnoConversaEnviadoRef.current = false
    pararInstanciaReconhecimento(true)
    falandoRef.current = false
    setFalandoResposta(false)
    setEntrada('')
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  function falarResposta(texto: string, aoTerminar?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      aoTerminar?.()
      return
    }

    const limpo = limparTextoFalado(texto)
    if (!limpo) {
      aoTerminar?.()
      return
    }

    window.speechSynthesis.cancel()
    const fala = new SpeechSynthesisUtterance(limpo)
    fala.lang = 'pt-BR'
    fala.rate = 1
    fala.pitch = 1
    fala.volume = 1
    const vozes = window.speechSynthesis.getVoices()
    const voz = vozes.find(v => v.lang.toLowerCase() === 'pt-br')
      || vozes.find(v => v.lang.toLowerCase().startsWith('pt'))
    if (voz) fala.voice = voz

    falandoRef.current = true
    setFalandoResposta(true)

    let terminou = false
    const terminar = () => {
      if (terminou) return
      terminou = true
      falandoRef.current = false
      setFalandoResposta(false)
      aoTerminar?.()
    }
    fala.onend = terminar
    fala.onerror = terminar
    window.speechSynthesis.speak(fala)
  }

  function finalizarTurnoConversa() {
    if (!modoConversaRef.current || carregandoRef.current || falandoRef.current || turnoConversaEnviadoRef.current) return
    const texto = textoAtualVoz()
    if (!texto) {
      iniciarReconhecimento('conversa', false)
      return
    }

    turnoConversaEnviadoRef.current = true
    setEntrada('')
    pararInstanciaReconhecimento(false)
    textoBaseVozRef.current = ''
    textoFinalVozRef.current = ''
    textoParcialVozRef.current = ''
    void enviar(texto)
  }

  function iniciarReconhecimento(modo: 'ditado' | 'conversa', preservarTexto = false) {
    if (typeof window === 'undefined' || carregandoRef.current || falandoRef.current || gravandoAudioRef.current) return
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErro('Reconhecimento de voz não está disponível neste navegador.')
      return
    }

    pararInstanciaReconhecimento(true)
    setErro('')
    modoReconhecimentoRef.current = modo

    if (!preservarTexto) {
      textoBaseVozRef.current = modo === 'ditado' ? entrada.trim() : ''
      textoFinalVozRef.current = ''
      textoParcialVozRef.current = ''
      turnoConversaEnviadoRef.current = false
    }

    const r = new SpeechRecognition()
    reconhecimentoRef.current = r
    r.lang = 'pt-BR'
    r.interimResults = true
    // Alguns navegadores encerram a sessão mesmo com continuous=true.
    // O onend abaixo reinicia enquanto o usuário mantiver Falar/Conversar ativo.
    r.continuous = true
    r.maxAlternatives = 1

    r.onstart = () => {
      if (reconhecimentoRef.current === r) setOuvindo(true)
    }

    r.onresult = (event: any) => {
      let parcial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const trecho = String(event.results[i]?.[0]?.transcript || '').trim()
        if (!trecho) continue
        if (event.results[i].isFinal) {
          textoFinalVozRef.current = [textoFinalVozRef.current, trecho].filter(Boolean).join(' ').trim()
        } else {
          parcial = [parcial, trecho].filter(Boolean).join(' ').trim()
        }
      }
      textoParcialVozRef.current = parcial
      const exibido = textoAtualVoz()
      if (exibido) setEntrada(exibido)

      if (modo === 'conversa' && exibido) {
        if (silencioTimerRef.current) window.clearTimeout(silencioTimerRef.current)
        silencioTimerRef.current = window.setTimeout(() => {
          silencioTimerRef.current = null
          finalizarTurnoConversa()
        }, 2000)
      }
    }

    r.onerror = (event: any) => {
      const codigo = String(event?.error || '')
      if (['not-allowed', 'service-not-allowed'].includes(codigo)) {
        modoReconhecimentoRef.current = null
        modoConversaRef.current = false
        setModoConversa(false)
        setErro('O navegador bloqueou o microfone. Libere a permissão do microfone para o Atlas e tente novamente.')
        return
      }
      if (!['no-speech', 'aborted'].includes(codigo)) {
        setErro('O reconhecimento de voz foi interrompido. Vou manter o texto já capturado; tente novamente se necessário.')
      }
    }

    r.onend = () => {
      if (reconhecimentoRef.current === r) reconhecimentoRef.current = null
      setOuvindo(false)
      const modoAtual = modoReconhecimentoRef.current
      if (modoAtual !== modo) return

      const texto = textoAtualVoz()
      if (texto) {
        textoBaseVozRef.current = texto
        textoFinalVozRef.current = ''
        textoParcialVozRef.current = ''
      }

      if (!carregandoRef.current && !falandoRef.current && !gravandoAudioRef.current) {
        reinicioVozTimerRef.current = window.setTimeout(() => {
          reinicioVozTimerRef.current = null
          if (modoReconhecimentoRef.current === modo && !turnoConversaEnviadoRef.current) {
            iniciarReconhecimento(modo, true)
          }
        }, modo === 'conversa' ? 220 : 350)
      }
    }

    try {
      r.start()
    } catch {
      reconhecimentoRef.current = null
      setOuvindo(false)
      setErro('Não foi possível iniciar o microfone. Verifique a permissão do navegador.')
    }
  }

  function alternarDitado() {
    if (modoReconhecimentoRef.current === 'ditado') {
      pararDitado()
      return
    }
    if (modoConversaRef.current) pararConversa()
    if (gravandoAudioRef.current) return
    iniciarReconhecimento('ditado', false)
  }

  function alternarModoConversa() {
    if (modoConversaRef.current) {
      pararConversa()
      return
    }
    if (modoReconhecimentoRef.current === 'ditado') pararDitado()
    if (gravandoAudioRef.current) return

    modoConversaRef.current = true
    modoReconhecimentoRef.current = 'conversa'
    setModoConversa(true)
    setEntrada('')
    setErro('')
    turnoConversaEnviadoRef.current = false
    iniciarReconhecimento('conversa', false)
  }

  function pararTranscricaoGravacao() {
    const r = reconhecimentoAudioRef.current
    reconhecimentoAudioRef.current = null
    if (!r) return
    try { r.stop?.() } catch {}
  }

  function iniciarTranscricaoGravacao() {
    if (typeof window === 'undefined' || !gravandoAudioRef.current) return
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const r = new SpeechRecognition()
    reconhecimentoAudioRef.current = r
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = true
    r.maxAlternatives = 1

    r.onresult = (event: any) => {
      let parcial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const trecho = String(event.results[i]?.[0]?.transcript || '').trim()
        if (!trecho) continue
        if (event.results[i].isFinal) {
          transcricaoAudioFinalRef.current = [transcricaoAudioFinalRef.current, trecho].filter(Boolean).join(' ').trim()
        } else {
          parcial = [parcial, trecho].filter(Boolean).join(' ').trim()
        }
      }
      transcricaoAudioParcialRef.current = parcial
      const total = [transcricaoAudioFinalRef.current, parcial].filter(Boolean).join(' ').trim()
      setTranscricaoAudio(total)
    }

    r.onerror = (event: any) => {
      const codigo = String(event?.error || '')
      if (['not-allowed', 'service-not-allowed'].includes(codigo)) {
        setErro('O áudio continua gravando, mas o navegador não permitiu a transcrição automática.')
      }
    }

    r.onend = () => {
      if (reconhecimentoAudioRef.current === r) reconhecimentoAudioRef.current = null
      if (gravandoAudioRef.current) {
        window.setTimeout(() => {
          if (gravandoAudioRef.current && !reconhecimentoAudioRef.current) iniciarTranscricaoGravacao()
        }, 300)
      }
    }

    try { r.start() } catch {}
  }

  function mimeRecorderPreferido() {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return ''
    const candidatos = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
    return candidatos.find(tipo => MediaRecorder.isTypeSupported?.(tipo)) || ''
  }

  async function processarAudioGravado(blob: Blob, mediaType: string, duracaoSeg: number) {
    setEnviandoAudio(true)
    setErro('')
    try {
      const ext = mediaType.includes('mp4') ? 'm4a' : mediaType.includes('ogg') ? 'ogg' : mediaType.includes('mpeg') ? 'mp3' : 'webm'
      const file = new File([blob], `audio-atlas-${Date.now()}.${ext}`, { type: mediaType })
      const form = new FormData()
      form.append('audio', file)
      form.append('duracaoSeg', String(duracaoSeg))

      const token = await tokenAtual()
      const resp = await fetch('/api/ia/audio', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (token || '') },
        body: form,
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Não foi possível salvar o áudio.')

      const transcricao = [transcricaoAudioFinalRef.current, transcricaoAudioParcialRef.current]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const audioMeta: AudioEnviado = {
        storagePath: String(data.storagePath || ''),
        mediaType,
        duracaoSeg,
        transcricaoAutomatica: Boolean(transcricao),
      }

      if (!transcricao) {
        setBolhas(prev => [...prev, {
          papel: 'user',
          texto: `🎤 Áudio ${formatarDuracao(duracaoSeg)}\nNão houve transcrição automática neste navegador.`,
          audioUrl: String(data.signedUrl || ''),
          audioDuracaoSeg: duracaoSeg,
        }])
        setErro('O áudio foi salvo, mas este navegador não conseguiu transformar a fala em texto. Para a IA entender sem API paga, use Chrome/Edge com permissão de voz ou o modo Conversar.')
        return
      }

      await enviar(transcricao, {
        audio: audioMeta,
        audioUrl: String(data.signedUrl || ''),
        audioDuracaoSeg: duracaoSeg,
      })
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível enviar o áudio.')
    } finally {
      setEnviandoAudio(false)
      setTranscricaoAudio('')
      transcricaoAudioFinalRef.current = ''
      transcricaoAudioParcialRef.current = ''
    }
  }

  async function iniciarGravacaoAudio() {
    if (!gravacaoSuportada || gravandoAudioRef.current || carregandoRef.current || enviandoAudio) return
    if (modoConversaRef.current) pararConversa()
    if (modoReconhecimentoRef.current === 'ditado') pararDitado()

    setErro('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamAudioRef.current = stream
      partesAudioRef.current = []
      transcricaoAudioFinalRef.current = ''
      transcricaoAudioParcialRef.current = ''
      setTranscricaoAudio('')
      setSegundosAudio(0)

      const mimeType = mimeRecorderPreferido()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      gravadorRef.current = mr
      gravandoAudioRef.current = true
      setGravandoAudio(true)
      inicioAudioRef.current = Date.now()

      timerAudioRef.current = window.setInterval(() => {
        setSegundosAudio(Math.max(0, Math.floor((Date.now() - inicioAudioRef.current) / 1000)))
      }, 250)

      mr.ondataavailable = event => {
        if (event.data.size) partesAudioRef.current.push(event.data)
      }

      mr.onstop = () => {
        if (timerAudioRef.current) {
          window.clearInterval(timerAudioRef.current)
          timerAudioRef.current = null
        }
        const duracaoSeg = Math.max(1, Math.round((Date.now() - inicioAudioRef.current) / 1000))
        const tipoBase = String(mr.mimeType || mimeType || 'audio/webm').split(';')[0] || 'audio/webm'
        const blob = new Blob(partesAudioRef.current, { type: tipoBase })
        partesAudioRef.current = []
        streamAudioRef.current?.getTracks().forEach(track => track.stop())
        streamAudioRef.current = null
        gravadorRef.current = null
        setGravandoAudio(false)
        setSegundosAudio(duracaoSeg)
        if (!blob.size) {
          setErro('A gravação ficou vazia. Tente novamente.')
          return
        }
        void processarAudioGravado(blob, tipoBase, duracaoSeg)
      }

      mr.start(500)
      iniciarTranscricaoGravacao()
    } catch {
      gravandoAudioRef.current = false
      setGravandoAudio(false)
      streamAudioRef.current?.getTracks().forEach(track => track.stop())
      streamAudioRef.current = null
      setErro('Não foi possível acessar o microfone. Libere a permissão do microfone para o Atlas e tente novamente.')
    }
  }

  function pararEEnviarGravacaoAudio() {
    if (!gravandoAudioRef.current) return
    gravandoAudioRef.current = false
    pararTranscricaoGravacao()
    if (timerAudioRef.current) {
      window.clearInterval(timerAudioRef.current)
      timerAudioRef.current = null
    }
    window.setTimeout(() => {
      try {
        if (gravadorRef.current?.state && gravadorRef.current.state !== 'inactive') gravadorRef.current.stop()
      } catch {
        setErro('Não foi possível finalizar a gravação.')
      }
    }, 250)
  }

  async function reduzirImagem(file: File): Promise<Anexo> {
    const original = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    if (file.size <= 2 * 1024 * 1024 && MIMES_IMAGEM.has(file.type.toLowerCase())) {
      return {
        nome: file.name,
        mediaType: file.type.toLowerCase(),
        tipo: 'imagem',
        dados: original.split(',')[1] || '',
      }
    }

    return new Promise<Anexo>((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        try {
          const max = 1600
          const escala = Math.min(1, max / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * escala))
          canvas.height = Math.max(1, Math.round(img.height * escala))
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas indisponível')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          resolve({
            nome: file.name.replace(/\.[^.]+$/, '') + '.jpg',
            mediaType: 'image/jpeg',
            tipo: 'imagem',
            dados: dataUrl.split(',')[1] || '',
          })
        } catch (e) {
          reject(e)
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Formato de imagem não suportado pelo aparelho.'))
      }
      img.src = url
    })
  }

  async function selecionarArquivo(file?: File | null) {
    if (!file) return
    setProcessandoAnexo(true)
    setErro('')
    try {
      if (file.size > MAX_ARQUIVO) {
        throw new Error('Arquivo muito grande. O limite para análise direta é 6 MB.')
      }

      if (file.type.startsWith('image/')) {
        setAnexo(await reduzirImagem(file))
        return
      }

      if (file.type === 'application/pdf' || extensao(file.name) === 'pdf') {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        setAnexo({
          nome: file.name,
          mediaType: 'application/pdf',
          tipo: 'pdf',
          dados: dataUrl.split(',')[1] || '',
        })
        return
      }

      if (ehArquivoTexto(file)) {
        const texto = await file.text()
        setAnexo({
          nome: file.name,
          mediaType: file.type || 'text/plain',
          tipo: 'texto',
          dados: texto.slice(0, 45000),
        })
        return
      }

      throw new Error('Esse formato ainda não pode ser lido pela IA. Envie foto, PDF, TXT, CSV, JSON, Markdown, XML ou YAML.')
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível preparar o arquivo.')
    } finally {
      setProcessandoAnexo(false)
      if (arquivoRef.current) arquivoRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  function trocarEspecialista(especialista: AIEspecialista) {
    pararConversa()
    setSelecionado(especialista.modulo)
    setBolhas([])
    setEntrada('')
    setAnexo(null)
    setErro('')
  }

  async function enviar(
    textoForcado?: string,
    opcoes?: {
      audio?: AudioEnviado
      audioUrl?: string
      audioDuracaoSeg?: number
    },
  ) {
    const pergunta = String(textoForcado ?? entrada).trim()
    const anexoAtual = anexo
    if ((!pergunta && !anexoAtual) || carregandoRef.current) return

    setEntrada('')
    setAnexo(null)
    setErro('')
    const textoUsuario = opcoes?.audio
      ? `🎤 Áudio ${formatarDuracao(opcoes.audioDuracaoSeg || opcoes.audio.duracaoSeg)}\nTranscrição automática: ${pergunta}`
      : (pergunta || 'Analisar arquivo anexado') + (anexoAtual ? '\n📎 ' + anexoAtual.nome : '')
    setBolhas(prev => [...prev, {
      papel: 'user',
      texto: textoUsuario,
      audioUrl: opcoes?.audioUrl,
      audioDuracaoSeg: opcoes?.audioDuracaoSeg,
    }])
    setCarregando(true)
    carregandoRef.current = true
    pararInstanciaReconhecimento(true)

    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/ia/especialista', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({
          modulo: selecionado,
          pergunta,
          sessionId: sessoes[selecionado] || null,
          anexo: anexoAtual,
          audio: opcoes?.audio || null,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Não foi possível consultar o especialista.')

      if (data.sessionId) {
        setSessoes(prev => ({ ...prev, [selecionado]: data.sessionId }))
      }
      const resposta = String(data.resposta || '')
      setBolhas(prev => [...prev, {
        papel: 'assistant',
        texto: resposta,
        interacaoId: data.interacaoId || null,
        fontesPublicas: Array.isArray(data.fontesPublicas) ? data.fontesPublicas : [],
      }])

      if (modoConversaRef.current && resposta) {
        falarResposta(resposta, () => {
          if (modoConversaRef.current) {
            turnoConversaEnviadoRef.current = false
            iniciarReconhecimento('conversa', false)
          }
        })
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao falar com o especialista.')
      if (anexoAtual) setAnexo(anexoAtual)
      if (modoConversaRef.current) {
        turnoConversaEnviadoRef.current = false
        window.setTimeout(() => {
          if (modoConversaRef.current && !carregandoRef.current && !falandoRef.current) {
            iniciarReconhecimento('conversa', false)
          }
        }, 500)
      }
    } finally {
      setCarregando(false)
      carregandoRef.current = false
    }
  }

  async function aprovar(interacaoId: string) {
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/ia/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({ interacaoId, avaliacao: 'aprovado' }),
      })
      if (resp.ok) setAvaliados(prev => ({ ...prev, [interacaoId]: true }))
    } catch {
      // Feedback não deve bloquear a conversa.
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <div>
            <h1 className="font-semibold">Especialistas Atlas IA</h1>
            <p className="text-xs text-slate-500">14 especialistas · OpenCode + FreeLLMAPI · acesso por setor</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[330px_1fr]">
        <aside className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-slate-700">
            <Sparkles size={17}/> Escolha o especialista
          </div>
          <div className="space-y-1.5">
            {especialistas.map(e => (
              <button
                key={e.modulo}
                onClick={() => trocarEspecialista(e)}
                className={'w-full rounded-xl border p-3 text-left transition ' + (selecionado === e.modulo ? 'border-[#182444] bg-[#182444] text-white' : 'border-slate-200 hover:bg-slate-50')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot size={16}/>{e.nome}
                </div>
                <p className={'mt-1 text-xs ' + (selecionado === e.modulo ? 'text-white/70' : 'text-slate-500')}>
                  {e.objetivo}
                </p>
              </button>
            ))}
          </div>
          {!especialistas.length && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Nenhum especialista liberado para este usuário.
            </div>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            <ShieldCheck size={16} className="mt-0.5 shrink-0"/>
            Cada especialista só recebe dados do tenant e do setor permitido.
          </div>
        </aside>

        <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-[#182444]"/>
              <h2 className="font-semibold">{atual.nome}</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">{atual.objetivo}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-3xl space-y-4">
              {!bolhas.length && (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#182444] text-white">
                    <Bot size={26}/>
                  </div>
                  <h3 className="font-semibold">Converse com {atual.nome}</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                    Digite, dite, grave uma mensagem de voz, use o modo Conversar ou envie foto/PDF para analisar junto com o especialista.
                  </p>
                </div>
              )}

              {bolhas.map((b, index) => (
                <div key={index} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={'max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ' + (b.papel === 'user' ? 'bg-[#182444] text-white' : 'border bg-slate-50')}>
                    {b.texto}
                    {b.audioUrl && (
                      <audio
                        src={b.audioUrl}
                        controls
                        preload="metadata"
                        className="mt-3 w-full max-w-sm"
                      />
                    )}
                    {b.papel === 'assistant' && b.fontesPublicas && b.fontesPublicas.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fontes públicas</div>
                        <div className="flex flex-wrap gap-2">
                          {b.fontesPublicas.map((fonte, fonteIndex) => (
                            <a
                              key={fonte.url + fonteIndex}
                              href={fonte.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={fonte.trecho || fonte.titulo}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-900"
                            >
                              <span className="max-w-[260px] truncate">{fonte.titulo || new URL(fonte.url).hostname}</span>
                              <ExternalLink size={12} className="shrink-0"/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {b.papel === 'assistant' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2">
                        <BotaoOuvirResposta texto={b.texto}/>
                        {b.interacaoId && (
                          <button
                            onClick={() => aprovar(b.interacaoId!)}
                            disabled={Boolean(avaliados[b.interacaoId])}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 disabled:text-emerald-700"
                          >
                            {avaliados[b.interacaoId] ? <CheckCircle2 size={14}/> : <ThumbsUp size={14}/>}
                            {avaliados[b.interacaoId] ? 'Resposta aprovada' : 'Aprovar resposta'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {carregando && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={16} className="animate-spin"/> {atual.nome} está analisando...
                </div>
              )}
              {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
              <div ref={fimRef}/>
            </div>
          </div>

          <div className="border-t p-4">
            <div className="mx-auto max-w-3xl">
              <input
                ref={arquivoRef}
                type="file"
                className="hidden"
                accept="*/*"
                onChange={e => void selecionarArquivo(e.target.files?.[0])}
              />
              <input
                ref={cameraRef}
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={e => void selecionarArquivo(e.target.files?.[0])}
              />

              {(vozSuportada || gravacaoSuportada) && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {vozSuportada && (
                    <button
                      type="button"
                      onClick={alternarDitado}
                      disabled={carregando || falandoResposta || modoConversa || gravandoAudio || enviandoAudio}
                      className={'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ' + (modoReconhecimentoRef.current === 'ditado' ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-slate-600 hover:bg-slate-50')}
                    >
                      {modoReconhecimentoRef.current === 'ditado' ? <Square size={14}/> : <Mic size={15}/>}
                      {modoReconhecimentoRef.current === 'ditado' ? 'Parar ditado' : 'Falar'}
                    </button>
                  )}

                  {gravacaoSuportada && (
                    <button
                      type="button"
                      onClick={() => gravandoAudio ? pararEEnviarGravacaoAudio() : void iniciarGravacaoAudio()}
                      disabled={carregando || falandoResposta || modoConversa || enviandoAudio}
                      className={'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ' + (gravandoAudio ? 'border-red-300 bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
                    >
                      {gravandoAudio ? <Square size={14}/> : <Mic size={15}/>}
                      {gravandoAudio ? `Enviar áudio ${formatarDuracao(segundosAudio)}` : 'Gravar áudio'}
                    </button>
                  )}

                  {vozSuportada && (
                    <button
                      type="button"
                      onClick={alternarModoConversa}
                      disabled={(carregando && !modoConversa) || gravandoAudio || enviandoAudio}
                      className={'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ' + (modoConversa ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'bg-white text-slate-600 hover:bg-slate-50')}
                    >
                      {modoConversa ? <Square size={14}/> : <MessageCircle size={15}/>}
                      {modoConversa ? 'Encerrar conversa' : 'Conversar'}
                    </button>
                  )}

                  {(ouvindo || falandoResposta || enviandoAudio) && (
                    <span className="text-xs font-medium text-slate-500">
                      {enviandoAudio ? 'Enviando e preparando o áudio...' : falandoResposta ? 'Respondendo em voz alta...' : 'Ouvindo...'}
                    </span>
                  )}
                </div>
              )}

              {gravandoAudio && (
                <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-600"/>
                    Gravando mensagem de voz · {formatarDuracao(segundosAudio)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {transcricaoAudio || (vozSuportada ? 'Pode falar normalmente. A transcrição aparece aqui enquanto você fala.' : 'Gravando áudio. Este navegador não oferece transcrição automática gratuita.')}
                  </p>
                </div>
              )}

              {anexo && (
                <div className="mb-2 flex max-w-full items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {anexo.tipo === 'imagem' ? <Camera size={15} className="shrink-0"/> : <FileText size={15} className="shrink-0"/>}
                  <span className="min-w-0 flex-1 truncate">{anexo.nome}</span>
                  <button type="button" onClick={() => setAnexo(null)} aria-label="Remover anexo" className="rounded-lg p-1 hover:bg-slate-200">
                    <X size={14}/>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border p-2 focus-within:ring-2 focus-within:ring-slate-200">
                <button
                  type="button"
                  onClick={() => arquivoRef.current?.click()}
                  disabled={processandoAnexo || carregando}
                  className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  title="Anexar arquivo"
                  aria-label="Anexar arquivo"
                >
                  {processandoAnexo ? <Loader2 size={19} className="animate-spin"/> : <Paperclip size={19}/>}
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={processandoAnexo || carregando}
                  className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  title="Tirar ou enviar foto"
                  aria-label="Tirar ou enviar foto"
                >
                  <Camera size={19}/>
                </button>
                <textarea
                  value={entrada}
                  onChange={e => setEntrada(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void enviar()
                    }
                  }}
                  rows={1}
                  placeholder={'Pergunte ao ' + atual.nome + '...'}
                  className="max-h-36 min-h-10 flex-1 resize-none border-0 px-2 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => void enviar()}
                  disabled={carregando || (!entrada.trim() && !anexo) || !especialistas.length}
                  className="rounded-xl bg-[#182444] p-2.5 text-white disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send size={19}/>
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Ditado e conversa usam os recursos de voz do navegador, sem API paga. Mensagens de voz ficam armazenadas de forma privada no Atlas.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}