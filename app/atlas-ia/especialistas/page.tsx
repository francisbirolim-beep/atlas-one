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

  const fimRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const reconhecimentoRef = useRef<any>(null)
  const modoConversaRef = useRef(false)
  const carregandoRef = useRef(false)
  const falandoRef = useRef(false)

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

    return () => {
      modoConversaRef.current = false
      try { reconhecimentoRef.current?.abort?.() } catch {}
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

  function pararReconhecimento() {
    try { reconhecimentoRef.current?.stop?.() } catch {}
    reconhecimentoRef.current = null
    setOuvindo(false)
  }

  function pararConversa() {
    modoConversaRef.current = false
    setModoConversa(false)
    pararReconhecimento()
    falandoRef.current = false
    setFalandoResposta(false)
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

    const terminar = () => {
      falandoRef.current = false
      setFalandoResposta(false)
      aoTerminar?.()
    }
    fala.onend = terminar
    fala.onerror = terminar
    window.speechSynthesis.speak(fala)
  }

  function iniciarReconhecimento(enviarAutomaticamente: boolean) {
    if (typeof window === 'undefined' || carregandoRef.current || falandoRef.current) return
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErro('Reconhecimento de voz não está disponível neste navegador.')
      return
    }

    pararReconhecimento()
    setErro('')
    const r = new SpeechRecognition()
    reconhecimentoRef.current = r
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1

    let textoFinal = ''
    let enviado = false

    r.onstart = () => setOuvindo(true)
    r.onresult = (event: any) => {
      let parcial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const trecho = String(event.results[i]?.[0]?.transcript || '').trim()
        if (!trecho) continue
        if (event.results[i].isFinal) textoFinal = (textoFinal + ' ' + trecho).trim()
        else parcial = (parcial + ' ' + trecho).trim()
      }

      const exibido = [textoFinal, parcial].filter(Boolean).join(' ').trim()
      if (exibido) setEntrada(exibido)

      if (enviarAutomaticamente && textoFinal && !enviado) {
        enviado = true
        setEntrada('')
        try { r.stop() } catch {}
        void enviar(textoFinal)
      }
    }

    r.onerror = (event: any) => {
      if (!['no-speech', 'aborted'].includes(String(event?.error || ''))) {
        setErro('Não consegui entender o áudio. Tente novamente.')
      }
    }

    r.onend = () => {
      setOuvindo(false)
      reconhecimentoRef.current = null
      if (modoConversaRef.current && enviarAutomaticamente && !enviado && !carregandoRef.current && !falandoRef.current) {
        window.setTimeout(() => {
          if (modoConversaRef.current) iniciarReconhecimento(true)
        }, 500)
      }
    }

    try {
      r.start()
    } catch {
      setErro('Não foi possível iniciar o microfone.')
    }
  }

  function alternarDitado() {
    if (ouvindo) {
      pararReconhecimento()
      return
    }
    if (modoConversaRef.current) pararConversa()
    iniciarReconhecimento(false)
  }

  function alternarModoConversa() {
    if (modoConversaRef.current) {
      pararConversa()
      return
    }
    modoConversaRef.current = true
    setModoConversa(true)
    setEntrada('')
    setErro('')
    iniciarReconhecimento(true)
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

  async function enviar(textoForcado?: string) {
    const pergunta = String(textoForcado ?? entrada).trim()
    const anexoAtual = anexo
    if ((!pergunta && !anexoAtual) || carregandoRef.current) return

    setEntrada('')
    setAnexo(null)
    setErro('')
    setBolhas(prev => [...prev, {
      papel: 'user',
      texto: (pergunta || 'Analisar arquivo anexado') + (anexoAtual ? '\n📎 ' + anexoAtual.nome : ''),
    }])
    setCarregando(true)
    carregandoRef.current = true
    pararReconhecimento()

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
          if (modoConversaRef.current) iniciarReconhecimento(true)
        })
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao falar com o especialista.')
      if (anexoAtual) setAnexo(anexoAtual)
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
                    Digite, fale, use o modo Conversar ou envie foto/PDF para analisar junto com o especialista.
                  </p>
                </div>
              )}

              {bolhas.map((b, index) => (
                <div key={index} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={'max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ' + (b.papel === 'user' ? 'bg-[#182444] text-white' : 'border bg-slate-50')}>
                    {b.texto}
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

              {vozSuportada && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={alternarDitado}
                    disabled={carregando || falandoResposta || modoConversa}
                    className={'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ' + (ouvindo && !modoConversa ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-slate-600 hover:bg-slate-50')}
                  >
                    {ouvindo && !modoConversa ? <Square size={14}/> : <Mic size={15}/>}
                    {ouvindo && !modoConversa ? 'Parar' : 'Falar'}
                  </button>
                  <button
                    type="button"
                    onClick={alternarModoConversa}
                    disabled={carregando && !modoConversa}
                    className={'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ' + (modoConversa ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'bg-white text-slate-600 hover:bg-slate-50')}
                  >
                    {modoConversa ? <Square size={14}/> : <MessageCircle size={15}/>}
                    {modoConversa ? 'Encerrar conversa' : 'Conversar'}
                  </button>
                  {(ouvindo || falandoResposta) && (
                    <span className="text-xs font-medium text-slate-500">
                      {falandoResposta ? 'Respondendo em voz alta...' : 'Ouvindo...'}
                    </span>
                  )}
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
                Voz usa recursos do navegador. Fotos, PDFs e arquivos de texto podem ser analisados sem API paga de voz.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
