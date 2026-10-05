'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Brain, Bug, Eye, FileText, HeartHandshake, History, ImageIcon, Lightbulb, Loader2, MessageSquarePlus, Paperclip, Send, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'
import { listarPermissoesUsuario } from '@/lib/setores'
import { AI_ESPECIALISTAS } from '@/lib/ai/specialists'
import type { AIModulo } from '@/lib/ai/types'
import BotaoOuvirResposta from '@/components/ai/BotaoOuvirResposta'
import GravadorAudioChat, { type AudioChatEnviado } from '@/components/GravadorAudioChat'

type ModoChat = 'livre' | AIModulo
type Bolha = {
  papel: 'user' | 'assistant'
  texto: string
  imagem?: string
  audio?: string
  transcricao?: string
  modo?: string
}
type Anexo = { nome: string; mediaType: string; tipo: 'imagem' | 'pdf' | 'texto'; dados: string }
type ImagemPendente = { prompt: string; usd: number; model: string; quality: string; size: string }
type RelatoSugerido = { texto: string; anexo: Anexo | null; audioStoragePath?: string | null }
type ConversaResumo = { id: string; titulo: string; preview: string; createdAt: string; updatedAt: string; mensagens: number }

const MAX = 8 * 1024 * 1024
const PEDIDO_IMAGEM = /\b(gere|gerar|crie|criar|faça|faca|produza|desenhe|imagem|foto)\b.*\b(imagem|foto|porta|janela|esquadria|desenho|render)\b/i
const RELATO_MELHORIA = /\b(achei um erro|tem um erro|deu erro|bug|defeito|falha|não funciona|nao funciona|não aparece|nao aparece|travando|travou|sumiu|perdeu|melhoria|sugestão|sugestao|poderia ter|seria bom|deveria ter)\b/i
export default function AtlasIAPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [permissoes, setPermissoes] = useState<Record<string, string>>({})
  const [permissoesProntas, setPermissoesProntas] = useState(false)
  const [modo, setModo] = useState<ModoChat>('livre')
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [sessoesEspecialistas, setSessoesEspecialistas] = useState<Partial<Record<AIModulo, string>>>({})
  const [entrada, setEntrada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [anexo, setAnexo] = useState<Anexo | null>(null)
  const [imagemPendente, setImagemPendente] = useState<ImagemPendente | null>(null)
  const [relatoSugerido, setRelatoSugerido] = useState<RelatoSugerido | null>(null)
  const [registrandoMelhoria, setRegistrandoMelhoria] = useState(false)
  const [mensagemMelhoria, setMensagemMelhoria] = useState('')
  const [conversaLivreId, setConversaLivreId] = useState<string | null>(null)
  const [criandoConversa, setCriandoConversa] = useState(false)
  const [novaConversaPendente, setNovaConversaPendente] = useState(false)
  const [conversas, setConversas] = useState<ConversaResumo[]>([])
  const [carregandoConversas, setCarregandoConversas] = useState(false)
  const [carregandoConversa, setCarregandoConversa] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const entradaRef = useRef<HTMLTextAreaElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const modoInicialAplicadoRef = useRef(false)
  const conversaVersaoRef = useRef(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    ;(async () => {
      const atual = await usuarioAtual()
      setUsuario(atual)
      if (atual?.id && atual.role !== 'master') {
        setPermissoes(await listarPermissoesUsuario(atual.id))
      }
      setPermissoesProntas(true)
    })()
  }, [])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bolhas, carregando, imagemPendente])

  useEffect(() => {
    if (!usuario?.id) return
    void carregarConversas()
  }, [usuario?.id])

  const especialistas = useMemo(() => {
    if (!usuario) return []
    if (usuario.role === 'master') return AI_ESPECIALISTAS
    return AI_ESPECIALISTAS.filter(especialista =>
      especialista.setorIds.some(id => ['consulta', 'edicao'].includes(String(permissoes[id] || '')))
    )
  }, [usuario, permissoes])

  useEffect(() => {
    if (modoInicialAplicadoRef.current || !usuario || !permissoesProntas) return
    const solicitado = String(searchParams.get('modo') || '').trim() as AIModulo
    if (solicitado && especialistas.some(especialista => especialista.modulo === solicitado)) {
      setModo(solicitado)
    }
    modoInicialAplicadoRef.current = true
  }, [usuario, permissoesProntas, especialistas, searchParams])

  const especialistaAtual = modo === 'livre'
    ? null
    : especialistas.find(especialista => especialista.modulo === modo)
      || AI_ESPECIALISTAS.find(especialista => especialista.modulo === modo)
      || null

  function nomeModo() {
    return especialistaAtual?.nome || 'Conversa livre'
  }

  async function registrarRelato(relato: RelatoSugerido, limparComposer = false) {
    if (registrandoMelhoria || relato.texto.trim().length < 5) return
    setRegistrandoMelhoria(true)
    setMensagemMelhoria('')
    setErro('')
    try {
      const token = await tokenAtual()
      const tela = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/atlas-ia'
      const viewport = typeof window !== 'undefined' ? { largura: window.innerWidth, altura: window.innerHeight } : null
      const r = await fetch('/api/ia/melhorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({
          descricao: relato.texto,
          tela,
          origem: 'atlas_ia_chat',
          anexo: relato.anexo && relato.anexo.tipo !== 'texto' ? relato.anexo : null,
          audioStoragePath: relato.audioStoragePath || null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          viewport,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível registrar a melhoria.')
      const numero = j.item?.numero ? '#' + j.item.numero : ''
      setMensagemMelhoria(j.duplicado
        ? 'Esse relato já existia. O Atlas somou esta ocorrência ao chamado ' + numero + '.'
        : 'Relato ' + numero + ' registrado em Melhorias Atlas e enviado para análise/aprovação.')
      setRelatoSugerido(null)
      if (limparComposer) {
        setEntrada('')
        setAnexo(null)
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao registrar melhoria.')
    } finally {
      setRegistrandoMelhoria(false)
    }
  }

  function registrarDoComposer() {
    const texto = entrada.trim()
    if (texto.length < 5) {
      setErro('Escreva no campo abaixo o defeito ou melhoria que você encontrou.')
      return
    }
    void registrarRelato({ texto, anexo }, true)
  }

  async function carregarConversas() {
    if (carregandoConversas) return
    setCarregandoConversas(true)
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/agente/conversas', {
        headers: { Authorization: 'Bearer ' + (token || '') },
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível carregar as conversas.')
      setConversas(Array.isArray(j.conversas) ? j.conversas : [])
    } catch {
      // O histórico não pode impedir o usuário de conversar.
    } finally {
      setCarregandoConversas(false)
    }
  }

  async function carregarConversa(id: string) {
    if (!id || carregando || carregandoConversa) return
    setCarregandoConversa(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/agente/conversas?id=' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + (token || '') },
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível abrir a conversa.')
      const mensagens = Array.isArray(j.mensagens) ? j.mensagens : []
      conversaVersaoRef.current += 1
      setCarregando(false)
      setModo('livre')
      setConversaLivreId(String(j.conversaId || id))
      setNovaConversaPendente(false)
      setBolhas(mensagens
        .filter((m: any) => m.papel === 'user' || m.papel === 'assistant')
        .map((m: any) => ({
          papel: m.papel as 'user' | 'assistant',
          texto: String(m.conteudo || ''),
          modo: 'Conversa livre',
        })))
      setHistorico(mensagens
        .filter((m: any) => m.papel === 'user' || m.papel === 'assistant')
        .map((m: any) => ({
          role: m.papel === 'assistant' ? 'assistant' : 'user',
          content: String(m.conteudo || ''),
        })))
      setImagemPendente(null)
      setRelatoSugerido(null)
      setMensagemMelhoria('')
      setEntrada('')
      setAnexo(null)
      window.setTimeout(() => entradaRef.current?.focus(), 50)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível abrir a conversa.')
    } finally {
      setCarregandoConversa(false)
    }
  }

  async function novaConversa() {
    if (criandoConversa) return
    setCriandoConversa(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const r = await fetch('/api/agente/conversas', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok || !j.conversaId) throw new Error(j.error || 'Não foi possível iniciar uma nova conversa.')

      conversaVersaoRef.current += 1
      setModo('livre')
      setConversaLivreId(String(j.conversaId))
      setNovaConversaPendente(false)
      setBolhas([])
      setHistorico([])
      setImagemPendente(null)
      setEntrada('')
      setAnexo(null)
      setRelatoSugerido(null)
      setMensagemMelhoria('')
      setSessoesEspecialistas({})
      window.setTimeout(() => entradaRef.current?.focus(), 50)
      void carregarConversas()
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível iniciar uma nova conversa.')
    } finally {
      setCriandoConversa(false)
    }
  }
  function trocarModo(novo: ModoChat) {
    if (novo === modo) return
    conversaVersaoRef.current += 1
    setModo(novo)
    setBolhas([])
    setHistorico([])
    setImagemPendente(null)
    setEntrada('')
    setAnexo(null)
    setErro('')
    if (novo !== 'livre') {
      setSessoesEspecialistas(prev => {
        const proximo = { ...prev }
        delete proximo[novo]
        return proximo
      })
    }
  }

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX) return setErro('Arquivo muito grande. Máximo de 8 MB.')
    setErro('')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      if (file.type.startsWith('text/') || file.type === 'application/json') reader.readAsText(file)
      else reader.readAsDataURL(file)
    })
    if (file.type.startsWith('image/')) {
      setAnexo({ nome: file.name, mediaType: file.type, tipo: 'imagem', dados: dataUrl.split(',')[1] || '' })
    } else if (file.type === 'application/pdf') {
      setAnexo({ nome: file.name, mediaType: file.type, tipo: 'pdf', dados: dataUrl.split(',')[1] || '' })
    } else {
      setAnexo({ nome: file.name, mediaType: file.type || 'text/plain', tipo: 'texto', dados: dataUrl })
    }
  }

  async function prepararImagem(prompt: string) {
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/agente/imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ prompt, confirmar: false }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao preparar geração de imagem')
      setImagemPendente({
        prompt,
        usd: j.estimate?.usd || 0,
        model: j.estimate?.model || '',
        quality: j.estimate?.quality || '',
        size: j.estimate?.size || '',
      })
    } catch (e: any) {
      setErro(e.message || 'Erro ao preparar geração de imagem')
    } finally {
      setCarregando(false)
    }
  }
  async function gerarImagem() {
    if (!imagemPendente || carregando) return
    const pedido = imagemPendente
    setImagemPendente(null)
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/agente/imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ prompt: pedido.prompt, confirmar: true }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao gerar imagem')
      setBolhas(prev => [...prev, {
        papel: 'assistant',
        texto: `Imagem gerada para: ${pedido.prompt}`,
        imagem: j.image,
        modo: 'Conversa livre',
      }])
    } catch (e: any) {
      setErro(e.message || 'Erro ao gerar imagem')
    } finally {
      setCarregando(false)
    }
  }

  async function enviarMensagem(textoDireto?: string, audio?: AudioChatEnviado) {
    const versaoConversa = conversaVersaoRef.current
    const texto = String(textoDireto ?? entrada).trim()
    const atual = textoDireto === undefined ? anexo : null
    if ((!texto && !atual) || carregando || criandoConversa) return

    if (textoDireto === undefined) {
      setEntrada('')
      setAnexo(null)
    }
    setErro('')
    setBolhas(prev => [...prev, audio
      ? {
          papel: 'user',
          texto: 'Áudio enviado',
          audio: audio.url,
          transcricao: texto,
          modo: nomeModo(),
        }
      : {
          papel: 'user',
          texto: (texto || 'Analisar arquivo') + (atual ? `\n📎 ${atual.nome}` : ''),
          modo: nomeModo(),
        }
    ])

    if (modo === 'livre' && texto && RELATO_MELHORIA.test(texto)) {
      setRelatoSugerido({
        texto,
        anexo: atual && atual.tipo !== 'texto' ? atual : null,
        audioStoragePath: audio?.storagePath || null,
      })
      setMensagemMelhoria('')
    }

    if (modo === 'livre' && !atual && !audio && PEDIDO_IMAGEM.test(texto)) {
      await prepararImagem(texto)
      return
    }

    setCarregando(true)
    try {
      const token = await tokenAtual()
      if (modo === 'livre') {
        const r = await fetch('/api/agente/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
          body: JSON.stringify({
            mensagem: texto,
            anexo: atual,
            messages: historico,
            conversaId: conversaLivreId,
            novaConversa: novaConversaPendente && !conversaLivreId,
          }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro ao falar com o Atlas IA')
        if (conversaVersaoRef.current !== versaoConversa) return
        if (j.conversaId) {
          setConversaLivreId(String(j.conversaId))
          setNovaConversaPendente(false)
        }
        setHistorico(j.messages || [])
        void carregarConversas()
        if (j.text) setBolhas(prev => [...prev, {
          papel: 'assistant',
          texto: j.text,
          modo: 'Conversa livre',
        }])
      } else {
        const r = await fetch('/api/ia/especialista', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify({
            modulo: modo,
            pergunta: texto,
            sessionId: sessoesEspecialistas[modo] || null,
            anexo: atual,
          }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro ao falar com o especialista')
        if (conversaVersaoRef.current !== versaoConversa) return
        if (j.sessionId) {
          setSessoesEspecialistas(prev => ({ ...prev, [modo]: j.sessionId }))
        }
        if (j.resposta) setBolhas(prev => [...prev, {
          papel: 'assistant',
          texto: String(j.resposta),
          modo: especialistaAtual?.nome || 'Especialista Atlas',
        }])
      }
    } catch (e: any) {
      if (conversaVersaoRef.current === versaoConversa) {
        setErro(e.message || 'Erro ao falar com o Atlas IA')
        if (atual) setAnexo(atual)
      }
    } finally {
      if (conversaVersaoRef.current === versaoConversa) setCarregando(false)
    }
  }

  function enviar() {
    void enviarMensagem()
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <aside className="hidden w-72 flex-col border-r bg-[#111a31] p-4 text-white md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="rounded-xl bg-white/10 p-2"><Sparkles size={22}/></div>
          <div><b>Atlas IA</b><p className="text-xs text-white/60">Inteligência da Esquadrifácio</p></div>
        </div>
        <button
          onClick={() => void novaConversa()}
          disabled={criandoConversa}
          className="mb-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#182444] disabled:opacity-60"
        >
          <MessageSquarePlus size={17}/> Nova conversa
        </button>
        <div className="space-y-2 text-sm">
          <button onClick={() => trocarModo('livre')} className={"w-full rounded-xl p-3 text-left " + (modo === 'livre' ? 'bg-white/10' : 'text-white/80 hover:bg-white/10')}>
            <Bot size={17} className="mb-2"/><b>Conversa livre</b>
            <p className="mt-1 text-xs text-white/60">Pergunte qualquer coisa. O Atlas usa dados internos só quando fizer sentido.</p>
          </button>
          <div className="pt-2">
            <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              <span className="flex items-center gap-1.5"><History size={13}/> Conversas recentes</span>
              {carregandoConversas && <Loader2 size={12} className="animate-spin"/>}
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {conversas.length === 0 && !carregandoConversas && <p className="px-2 py-2 text-xs text-white/35">As conversas salvas aparecerão aqui.</p>}
              {conversas.slice(0, 12).map(c => <button
                key={c.id}
                onClick={() => void carregarConversa(c.id)}
                disabled={carregandoConversa}
                className={"w-full rounded-lg px-2.5 py-2 text-left transition " + (conversaLivreId === c.id && modo === 'livre' ? 'bg-white/15' : 'text-white/70 hover:bg-white/10')}
                title={c.preview || c.titulo}
              >
                <div className="truncate text-xs font-semibold">{c.titulo}</div>
                <div className="mt-0.5 text-[10px] text-white/35">{new Date(c.updatedAt).toLocaleDateString('pt-BR')}</div>
              </button>)}
            </div>
          </div>
          <Link href="/atlas-ia/especialistas" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <Brain size={17} className="mb-2"/><b>Especialistas Atlas</b>
            <p className="mt-1 text-xs text-white/50">Veja os especialistas e suas funções.</p>
          </Link>
          <Link href="/atlas-ia/whatsapp" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <MessageSquarePlus size={17} className="mb-2"/><b>IA do WhatsApp</b>
            <p className="mt-1 text-xs text-white/50">Ver atividade, aprendizado, canais e controlar a autonomia.</p>
          </Link>
          <Link href="/atlas-ia/supervisao" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <Eye size={17} className="mb-2"/><b>Supervisão dos agentes</b>
            <p className="mt-1 text-xs text-white/50">Escritório animado, atividade, custos, erros e validações da IA.</p>
          </Link>
          <Link href="/atlas-ia/aprendizado" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <Sparkles size={17} className="mb-2"/><b>Central de Aprendizado</b>
            <p className="mt-1 text-xs text-white/50">Mandar catálogos, cursos, tabelas, regras e revisar validações.</p>
          </Link>
          <Link href="/atlas-ia/conhecimento" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <FileText size={17} className="mb-2"/><b>Conhecimento por setor</b>
            <p className="mt-1 text-xs text-white/50">Conhecimento já organizado por especialista e setor.</p>
          </Link>
          <Link href="/atlas-ia/pessoas" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <HeartHandshake size={17} className="mb-2"/><b>Atlas Pessoas</b>
            <p className="mt-1 text-xs text-white/50">Diário privado, clima e compartilhamento voluntário.</p>
          </Link>
          {usuario?.role === 'master' && <Link href="/administracao/melhorias-atlas" className="block rounded-xl p-3 text-white/80 hover:bg-white/10">
            <Lightbulb size={17} className="mb-2"/><b>Melhorias Atlas</b>
            <p className="mt-1 text-xs text-white/50">Analisar defeitos, sugestões e aprovações.</p>
          </Link>}
        </div>
        <div className="mt-auto rounded-xl bg-emerald-400/10 p-3 text-xs text-emerald-100">
          <ShieldCheck size={16} className="mb-1"/>Dados internos continuam limitados às permissões do usuário.
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
            <div><h1 className="font-semibold">Atlas IA</h1><p className="text-xs text-slate-500">{nomeModo()}</p></div>
          </div>
          <div className="flex items-center gap-2">
            {usuario?.role === 'master' && <Link
              href="/atlas-ia/supervisao"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
              title="Abrir Supervisão dos agentes IA"
            >
              <Eye size={15}/><span className="hidden sm:inline">Supervisão</span>
            </Link>}
            <button
              type="button"
              onClick={() => void novaConversa()}
              disabled={criandoConversa}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 md:hidden"
              title="Nova conversa"
            >
              <MessageSquarePlus size={15}/><span className="hidden sm:inline">Nova</span>
            </button>
            {modo === 'livre' && <Link
              href="/atlas-ia/aprendizado"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              title="Central de Aprendizado: enviar materiais e validar"
            >
              <Sparkles size={15}/><span className="hidden sm:inline">Aprender / validar</span>
            </Link>}
            {modo !== 'livre' && <Link
              href={'/atlas-ia/conhecimento?modulo=' + modo}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              title="Enviar catálogo, regra, PDF ou imagem para validação deste especialista"
            >
              <FileText size={15}/><span className="hidden sm:inline">Ensinar / validar</span>
            </Link>}
            <div className="text-right text-xs text-slate-500">
              <b className="block text-slate-700">{usuario?.nome || 'Usuário'}</b>{modo === 'livre' ? 'Conversa geral' : 'Especialista ativo'}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-4">
            {bolhas.length === 0 && <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#182444] text-white">
                {modo === 'livre' ? <Sparkles size={26}/> : <Brain size={26}/>}
              </div>
              <h2 className="text-xl font-semibold">{modo === 'livre' ? 'Conversa livre' : nomeModo()}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                {modo === 'livre'
                  ? 'Converse normalmente. O Atlas identifica o assunto e consulta por trás o conhecimento validado dos setores que você pode acessar; se quiser, também pode escolher um especialista diretamente.'
                  : especialistaAtual?.objetivo || 'Converse com o especialista selecionado.'}
              </p>
            </div>}
            {bolhas.map((b, i) => <div key={i} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm ' + (b.papel === 'user' ? 'bg-[#182444] text-white' : 'border bg-white')}>
                {b.imagem && <img src={b.imagem} alt={b.texto} className="mb-3 max-h-[560px] w-full rounded-xl object-contain"/>}
                {b.audio && <audio src={b.audio} controls className="mb-2 w-64 max-w-full"/>}
                <div>{b.texto}</div>
                {b.transcricao && <div className="mt-2 border-t border-white/20 pt-2 text-xs opacity-75">Transcrição: {b.transcricao}</div>}
                {b.papel === 'assistant' && <div className="mt-2 border-t pt-1.5"><BotaoOuvirResposta texto={b.texto}/></div>}
              </div>
            </div>)}
            {imagemPendente && <div className="flex justify-start"><div className="max-w-[92%] rounded-2xl border bg-white p-4 text-sm shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold"><ImageIcon size={18}/> Gerar imagem</div>
              <p className="text-slate-600">Esta ação usa geração de imagem paga. Estimativa: <b>US$ {imagemPendente.usd.toFixed(3)}</b> para {imagemPendente.size}, qualidade {imagemPendente.quality}. O custo real pode variar.</p>
              <div className="mt-3 flex gap-2"><button onClick={gerarImagem} className="rounded-xl bg-[#182444] px-4 py-2 font-semibold text-white">Pode gerar</button><button onClick={() => setImagemPendente(null)} className="rounded-xl border px-4 py-2">Cancelar</button></div>
            </div></div>}
            {relatoSugerido && <div className="flex justify-start"><div className="max-w-[92%] rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-amber-900"><Bug size={17}/> Isso parece um defeito ou melhoria do Atlas</div>
              <p className="mt-2 text-amber-800">Posso registrar este relato na central Melhorias Atlas. A IA classifica o impacto e o risco, mas nenhuma alteração é publicada sem aprovação.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={registrandoMelhoria} onClick={() => void registrarRelato(relatoSugerido)} className="rounded-xl bg-[#182444] px-4 py-2 font-semibold text-white disabled:opacity-40">
                  {registrandoMelhoria ? 'Registrando...' : 'Registrar melhoria'}
                </button>
                <button onClick={() => setRelatoSugerido(null)} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-amber-900">Não registrar</button>
              </div>
            </div></div>}
            {mensagemMelhoria && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagemMelhoria}</div>}
            {carregando && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16}/> {modo === 'livre' ? 'Atlas IA está pensando...' : nomeModo() + ' está analisando...'}</div>}
            {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <div ref={fimRef}/>
          </div>
        </div>

        <div className="border-t bg-white p-3 md:p-5">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-500">Modo da conversa</div>
              <div className="flex flex-wrap items-center gap-2">
                {modo === 'livre' && <button
                  type="button"
                  onClick={registrarDoComposer}
                  disabled={registrandoMelhoria}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                  title="Registrar o texto digitado como defeito ou melhoria"
                >
                  <Bug size={14}/>{registrandoMelhoria ? 'Registrando...' : 'Relatar defeito / melhoria'}
                </button>}
                <select
                  value={modo}
                  onChange={e => trocarModo(e.target.value as ModoChat)}
                  className="max-w-full rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  aria-label="Escolher modo da conversa"
                >
                  <option value="livre">✨ Conversa livre</option>
                  {especialistas.length > 0 && <optgroup label="Especialistas">
                    {especialistas.map(especialista => <option key={especialista.modulo} value={especialista.modulo}>{especialista.nome}</option>)}
                  </optgroup>}
                </select>
              </div>
            </div>

            <input ref={arquivoRef} className="hidden" type="file" accept="image/*,application/pdf,text/plain,text/csv,application/json" onChange={selecionarArquivo}/>
            {anexo && <div className="mb-2 inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs">📎 {anexo.nome}</div>}
            <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-200">
              <button onClick={() => arquivoRef.current?.click()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Anexar arquivo"><Paperclip size={20}/></button>
              <textarea
                ref={entradaRef}
                value={entrada}
                onChange={e => setEntrada(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                rows={1}
                placeholder={modo === 'livre' ? 'Converse livremente com o Atlas IA...' : `Pergunte ao ${nomeModo()}...`}
                className="max-h-36 min-h-10 flex-1 resize-none border-0 px-2 py-2 text-sm outline-none"
              />
              <GravadorAudioChat
                disabled={carregando || carregandoConversa || !!anexo}
                onEnviar={audio => enviarMensagem(audio.transcricao, audio)}
              />
              <button onClick={enviar} disabled={carregando || carregandoConversa || (!entrada.trim() && !anexo)} className="rounded-xl bg-[#182444] p-2.5 text-white disabled:opacity-40">
                <Send size={19}/>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Conversa livre aceita assuntos gerais. Ao usar dados internos ou especialistas, o Atlas respeita as permissões do usuário.
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
}