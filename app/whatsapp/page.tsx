'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, ArrowLeft, Ban, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Clock3,
  BellRing, ExternalLink, Eye, EyeOff, Info, MapPin, MessageCircle, Mic, Paperclip, Search,
  Send, Settings, ShieldCheck, Smartphone, StickyNote, Tag, UserPlus, Users,
  UserRoundCheck, Plus, Zap, ChevronLeft, ChevronRight, Sparkles, X, History, Reply, SmilePlus, Camera, Square,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual } from '@/lib/auth'
import {
  type ChatConversa,
  type ChatMensagem,
  criarConversa as criarConversaInterna,
  enviarMensagem as enviarMensagemInterna,
  listarConversas as listarConversasInternas,
  listarMensagens as listarMensagensInternas,
  listarParticipantes as listarParticipantesInternos,
  marcarConversaComoLida,
} from '@/lib/chatInterno'
import { ativarPushNesteDispositivo, statusPushNesteDispositivo } from '@/lib/notificacoes'

type Usuario = { id: string; nome: string; role?: string; cargo?: string | null }
type Canal = {
  id: string
  nome: string
  numero_declarado?: string | null
  numero_conectado?: string | null
  principal: boolean
  usuario_id?: string | null
  usuario_nome?: string | null
  gateway_status: string
}
type Conversa = {
  id: string
  telefone: string
  contato_nome?: string | null
  cliente_id?: string | null
  whatsapp_canal_id?: string | null
  whatsapp_numero?: string | null
  whatsapp_chat_tipo?: 'contato' | 'grupo' | null
  whatsapp_chat_jid?: string | null
  grupo_nome?: string | null
  status: string
  responsavel_id?: string | null
  responsavel_nome?: string | null
  setor?: string | null
  ultimo_preview?: string | null
  nao_lidas?: number | null
  ultima_mensagem_em?: string | null
  transferida_em?: string | null
  acompanhando?: boolean
  grupo_id?: string | null
  grupo_nivel_acesso?: 'sem_acesso' | 'acompanhar' | 'atender' | 'gerenciar' | 'herdado' | null
  grupo_pode_atender?: boolean | null
  grupo_pode_transferir?: boolean | null
  grupo_pode_delegar?: boolean | null
  grupo_responsavel_principal_id?: string | null
  grupo_responsavel_principal_nome?: string | null
  grupo_responsavel_efetivo_id?: string | null
  grupo_responsavel_efetivo_nome?: string | null
  grupo_delegacao_fim_em?: string | null
  grupo_delegacao_ativa?: boolean
}
type Mensagem = {
  id: string
  conversa_id: string
  direcao: 'entrada' | 'saida'
  tipo: string
  texto?: string | null
  media_url?: string | null
  mime_type?: string | null
  arquivo_nome?: string | null
  usuario_nome?: string | null
  whatsapp_message_id?: string | null
  payload?: Record<string, any> | null
  created_at: string
}
type ClienteResumo = {
  id: string
  nome: string
  whatsapp?: string | null
  telefone?: string | null
  cidade?: string | null
  endereco?: string | null
  bairro?: string | null
  observacoes?: string | null
}
type ObraResumo = { id: string; nome?: string | null; status?: string | null }
type AcessoCanal = {
  canal_id: string
  visualizar: boolean
  atender: boolean
  transferir: boolean
  supervisionar: boolean
  dono: boolean
  principal: boolean
}
type Etiqueta = { id: string; nome: string; cor: string }
type Nota = { id: string; usuario_nome?: string | null; texto: string; created_at: string }
type EventoAtendimento = {
  id: string
  tipo: string
  usuario_id?: string | null
  usuario_nome?: string | null
  dados?: Record<string, unknown> | null
  created_at: string
}
type MensagemRapida = {
  id: string
  titulo: string
  mensagem: string
  atalho?: string | null
  categoria?: string | null
}
type DiretorioWhatsApp = {
  id: string
  tipo: 'contato' | 'grupo'
  jid: string
  telefone?: string | null
  nome: string
  participantes?: number | null
  canalId?: string
  conversaId?: string | null
  bloqueado?: boolean
  bloqueado_em?: string | null
  bloqueado_por_nome?: string | null
}
type SugestaoIA = {
  id: string
  texto: string
  setor?: string | null
  confianca?: number | null
  status: string
  created_at: string
}

function hora(valor?: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function telefoneFormatado(valor: string) {
  const n = valor.replace(/\D/g, '')
  if (n.startsWith('55') && n.length >= 12) {
    const ddd = n.slice(2, 4)
    const local = n.slice(4)
    return `+55 (${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`
  }
  return valor
}
async function headersJson() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

export default function WhatsAppAtendimentoPage() {
  const [eu, setEu] = useState<Usuario | null>(null)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [canais, setCanais] = useState<Canal[]>([])
  const [acessos, setAcessos] = useState<AcessoCanal[]>([])
  const [ativa, setAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [mensagemRespondendo, setMensagemRespondendo] = useState<Mensagem | null>(null)
  const [emojiMensagemId, setEmojiMensagemId] = useState<string | null>(null)
  const [emojiCustom, setEmojiCustom] = useState('')
  const [sugestaoIA, setSugestaoIA] = useState<SugestaoIA | null>(null)
  const [modoIA, setModoIA] = useState<'observando' | 'sugerindo' | 'automatico'>('observando')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'internas' | 'aguardando' | 'com_atendente' | 'nao_lidas' | 'minhas' | 'acompanhando' | 'transferidas' | 'finalizadas' | 'grupos'>('todas')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [canaisConectados, setCanaisConectados] = useState(0)
  const [canaisTotal, setCanaisTotal] = useState(0)
  const [destinoId, setDestinoId] = useState('')
  const [setorTransferencia, setSetorTransferencia] = useState('')
  const [transferenciaAberta, setTransferenciaAberta] = useState(false)
  const [delegacaoAberta, setDelegacaoAberta] = useState(false)
  const [destinoDelegacaoId, setDestinoDelegacaoId] = useState('')
  const [diasDelegacao, setDiasDelegacao] = useState(1)
  const [motivoDelegacao, setMotivoDelegacao] = useState('')
  const [salvandoDelegacao, setSalvandoDelegacao] = useState(false)
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [obras, setObras] = useState<ObraResumo[]>([])
  const [carregandoCliente, setCarregandoCliente] = useState(false)
  const [painelDireito, setPainelDireito] = useState<'cliente' | 'agenda' | 'notas' | 'historico'>('cliente')
  const [painelDireitoRecolhido, setPainelDireitoRecolhido] = useState(true)
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [etiquetasAtivas, setEtiquetasAtivas] = useState<string[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [historico, setHistorico] = useState<EventoAtendimento[]>([])
  const [mensagensRapidas, setMensagensRapidas] = useState<MensagemRapida[]>([])
  const [apoioAberto, setApoioAberto] = useState<'rapidas' | 'etiquetas' | null>(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [conversaInternaAberta, setConversaInternaAberta] = useState(false)
  const [conversasInternas, setConversasInternas] = useState<ChatConversa[]>([])
  const [conversaInternaAtiva, setConversaInternaAtiva] = useState<ChatConversa | null>(null)
  const [mensagensInternas, setMensagensInternas] = useState<ChatMensagem[]>([])
  const [participantesConversaInterna, setParticipantesConversaInterna] = useState<Array<{id:string;nome:string}>>([])
  const [textoInterno, setTextoInterno] = useState('')
  const [enviandoInterno, setEnviandoInterno] = useState(false)
  const [enviandoArquivoInterno, setEnviandoArquivoInterno] = useState(false)
  const [pushDisponivel, setPushDisponivel] = useState(false)
  const [pushInscrito, setPushInscrito] = useState(true)
  const [ativandoPush, setAtivandoPush] = useState(false)
  const [gravandoInterno, setGravandoInterno] = useState(false)
  const [buscaUsuarioInterno, setBuscaUsuarioInterno] = useState('')
  const [usuariosInternosSelecionados, setUsuariosInternosSelecionados] = useState<string[]>([])
  const [nomeGrupoInterno, setNomeGrupoInterno] = useState('')
  const [buscaInterna, setBuscaInterna] = useState('')
  const [diretorioAberto, setDiretorioAberto] = useState(false)
  const [diretorio, setDiretorio] = useState<DiretorioWhatsApp[]>([])
  const [buscaDiretorio, setBuscaDiretorio] = useState('')
  const [canalDiretorio, setCanalDiretorio] = useState('')
  const [carregandoDiretorio, setCarregandoDiretorio] = useState(false)
  const [novoDDD, setNovoDDD] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [iniciandoNumero, setIniciandoNumero] = useState(false)
  const [contatosBusca, setContatosBusca] = useState<DiretorioWhatsApp[]>([])
  const [buscandoContatos, setBuscandoContatos] = useState(false)
  const [novaRapidaTitulo, setNovaRapidaTitulo] = useState('')
  const [novaRapidaTexto, setNovaRapidaTexto] = useState('')
  const [enviandoMidia, setEnviandoMidia] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [segundosGravacao, setSegundosGravacao] = useState(0)
  const fimRef = useRef<HTMLDivElement | null>(null)
  const arquivoInputRef = useRef<HTMLInputElement | null>(null)
  const gravadorRef = useRef<MediaRecorder | null>(null)
  const partesAudioRef = useRef<Blob[]>([])
  const timerGravacaoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canalFiltroInicializadoRef = useRef(false)
  const conversaAtivaIdRef = useRef<string | null>(null)
  const carregandoConversasRef = useRef(false)
  const recarregarConversasPendenteRef = useRef(false)
  const refreshConversasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const arquivoInternoInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInternaInputRef = useRef<HTMLInputElement | null>(null)
  const gravadorInternoRef = useRef<MediaRecorder | null>(null)
  const partesAudioInternoRef = useRef<Blob[]>([])

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('atlas-whatsapp-painel-direito-recolhido')
      setPainelDireitoRecolhido(salvo === null ? false : salvo === '1')
    } catch {}
  }, [])

  useEffect(() => {
    let vivo = true
    statusPushNesteDispositivo().then(status => {
      if (!vivo) return
      setPushDisponivel(status.suportado && status.permissao !== 'denied')
      setPushInscrito(status.inscrito && status.dispositivosAtivos > 0)
    }).catch(() => undefined)
    return () => { vivo = false }
  }, [])

  async function ativarNotificacoesDesktop() {
    if (ativandoPush) return
    setAtivandoPush(true)
    setErro('')
    try {
      const resultado = await ativarPushNesteDispositivo()
      if (!resultado.ok) {
        setErro(resultado.error || 'Não foi possível ativar as notificações neste computador.')
        return
      }
      setPushInscrito(true)
    } finally {
      setAtivandoPush(false)
    }
  }

  function alternarPainelDireitoRecolhido(valor?: boolean) {
    setPainelDireitoRecolhido(atual => {
      const proximo = typeof valor === 'boolean' ? valor : !atual
      try {
        localStorage.setItem('atlas-whatsapp-painel-direito-recolhido', proximo ? '1' : '0')
      } catch {}
      return proximo
    })
  }

  async function carregarConversas(selecionar = true) {
    if (carregandoConversasRef.current) {
      recarregarConversasPendenteRef.current = true
      return
    }
    carregandoConversasRef.current = true
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/conversas', { headers, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao carregar conversas.')
      setEu(json.usuario)
      setConversas(json.conversas || [])
      setUsuarios(json.usuarios || [])
      const canaisRecebidos = (json.canais || []) as Canal[]
      const conversasRecebidas = (json.conversas || []) as Conversa[]
      setCanais(canaisRecebidos)
      setAcessos(json.acessos || [])
      setCanaisConectados(Number(json.canaisConectados || 0))
      setCanaisTotal(Number(json.canaisTotal || 0))
      if (!canalFiltroInicializadoRef.current && canaisRecebidos.length > 0) {
        let salvo = ''
        try { salvo = localStorage.getItem('atlas-whatsapp-canal-filtro') || '' } catch {}
        const inicial = canaisRecebidos.some(c => c.id === salvo)
          ? salvo
          : (canaisRecebidos.find(c => c.principal)?.id || canaisRecebidos[0]?.id || 'todos')
        setCanalFiltro(inicial)
        canalFiltroInicializadoRef.current = true
      } else if (canalFiltro !== 'todos' && !canaisRecebidos.some(c => c.id === canalFiltro)) {
        const fallback = canaisRecebidos.find(c => c.principal)?.id || canaisRecebidos[0]?.id || 'todos'
        setCanalFiltro(fallback)
        try { localStorage.setItem('atlas-whatsapp-canal-filtro', fallback) } catch {}
      }
      const conversaIdSolicitada = selecionar && typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('conversaId')
        : null
      setAtiva(atual => {
        if (atual) {
          return conversasRecebidas.find((c: Conversa) => c.id === atual.id) || null
        }
        if (conversaIdSolicitada) {
          return conversasRecebidas.find((c: Conversa) => c.id === conversaIdSolicitada) || null
        }
        return atual
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar atendimento.')
    } finally {
      setCarregando(false)
      carregandoConversasRef.current = false
      if (recarregarConversasPendenteRef.current) {
        recarregarConversasPendenteRef.current = false
        queueMicrotask(() => { void carregarConversas(false) })
      }
    }
  }

  function agendarRefreshConversas(delay = 250) {
    if (refreshConversasTimerRef.current) clearTimeout(refreshConversasTimerRef.current)
    refreshConversasTimerRef.current = setTimeout(() => {
      refreshConversasTimerRef.current = null
      void carregarConversas(false)
    }, delay)
  }

  function selecionarConversa(conversa: Conversa) {
    setConversaInternaAtiva(null)
    setMensagensInternas([])
    setParticipantesConversaInterna([])
    conversaAtivaIdRef.current = conversa.id
    setMensagens([])
    setEtiquetas([])
    setEtiquetasAtivas([])
    setNotas([])
    setMensagensRapidas([])
    setHistorico([])
    setSugestaoIA(null)
    setErro('')
    setAtiva(conversa)
  }

  function selecionarCanal(canalId: string) {
    setCanalFiltro(canalId)
    setBusca('')
    try { localStorage.setItem('atlas-whatsapp-canal-filtro', canalId) } catch {}
    setAtiva(atual => {
      if (!atual || canalId === 'todos' || atual.whatsapp_canal_id === canalId) return atual
      return null
    })
  }

  async function atualizarConversasInternas(usuarioId?: string) {
    const id = usuarioId || eu?.id
    if (!id) return
    try {
      const lista = await listarConversasInternas(id)
      setConversasInternas(lista)
      setConversaInternaAtiva(atual => atual ? (lista.find(c => c.id === atual.id) || atual) : atual)
    } catch {}
  }

  function selecionarConversaInterna(conversa: ChatConversa) {
    conversaAtivaIdRef.current = null
    setAtiva(null)
    setMensagens([])
    setErro('')
    setConversaInternaAtiva(conversa)
    if (eu?.id) {
      setConversasInternas(lista=>lista.map(item=>item.id===conversa.id?{...item,nao_lidas:0}:item))
      void marcarConversaComoLida(conversa.id,eu.id).then(()=>atualizarConversasInternas(eu.id))
    }
  }

  async function enviarInterno() {
    if (!conversaInternaAtiva || !textoInterno.trim() || enviandoInterno) return
    const corpo = textoInterno.trim()
    setTextoInterno('')
    setEnviandoInterno(true)
    try {
      const ok = await enviarMensagemInterna(conversaInternaAtiva.id, corpo)
      if (!ok) {
        setTextoInterno(corpo)
        setErro('Não foi possível enviar a mensagem interna.')
        return
      }
      const historico = await listarMensagensInternas(conversaInternaAtiva.id)
      setMensagensInternas(historico)
      await atualizarConversasInternas()
    } finally {
      setEnviandoInterno(false)
    }
  }

  async function enviarArquivoInterno(file: File) {
    if (!conversaInternaAtiva || enviandoArquivoInterno) return
    setErro('')
    setEnviandoArquivoInterno(true)
    try {
      if (file.size > 50 * 1024 * 1024) {
        setErro('Arquivo maior que 50 MB.')
        return
      }
      const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '')
      const caminho = `${eu?.id || 'usuario'}/${conversaInternaAtiva.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('chat-anexos')
        .upload(caminho, file, { contentType: file.type || undefined })
      if (uploadError) {
        setErro('Não foi possível enviar o arquivo.')
        return
      }

      const { data: url } = supabase.storage.from('chat-anexos').getPublicUrl(caminho)
      const ok = await enviarMensagemInterna(conversaInternaAtiva.id, '', {
        anexoUrl: url.publicUrl,
        anexoNome: file.name,
      })
      if (!ok) {
        setErro('Arquivo enviado, mas não foi possível registrar a mensagem.')
        return
      }

      const historico = await listarMensagensInternas(conversaInternaAtiva.id)
      setMensagensInternas(historico)
      await atualizarConversasInternas()
    } catch {
      setErro('Não foi possível enviar o arquivo.')
    } finally {
      setEnviandoArquivoInterno(false)
      if (arquivoInternoInputRef.current) arquivoInternoInputRef.current.value = ''
      if (cameraInternaInputRef.current) cameraInternaInputRef.current.value = ''
    }
  }

  async function alternarAudioInterno() {
    if (gravandoInterno) {
      gravadorInternoRef.current?.stop()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      partesAudioInternoRef.current = []
      const mr = new MediaRecorder(stream)
      gravadorInternoRef.current = mr
      mr.ondataavailable = e => {
        if (e.data.size) partesAudioInternoRef.current.push(e.data)
      }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        setGravandoInterno(false)
        const blob = new Blob(partesAudioInternoRef.current, { type: mr.mimeType || 'audio/webm' })
        void enviarArquivoInterno(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }))
      }
      mr.start()
      setGravandoInterno(true)
    } catch {
      setErro('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  function abrirConversaInterna() {
    setBuscaUsuarioInterno('')
    setUsuariosInternosSelecionados([])
    setNomeGrupoInterno('')
    setConversaInternaAberta(true)
  }

  async function iniciarConversaInternaSelecionada() {
    const ids = usuariosInternosSelecionados.filter(id => id && id !== eu?.id)
    if (!ids.length) return
    const participantes = usuarios.filter(u => ids.includes(u.id)).map(u => ({ id: u.id, nome: u.nome }))
    if (!participantes.length) return
    const tipo = participantes.length > 1 ? 'grupo' : 'direta'
    const nome = tipo === 'grupo'
      ? (nomeGrupoInterno.trim() || participantes.map(p => p.nome).join(', '))
      : participantes[0].nome
    const conversa = await criarConversaInterna(nome, tipo, participantes)
    if (!conversa) {
      setErro('Não foi possível abrir a conversa interna.')
      return
    }
    setConversaInternaAberta(false)
    selecionarConversaInterna(conversa)
    await atualizarConversasInternas()
  }

  function abrirDiretorio() {
    const canalPreferido = canalFiltro !== 'todos'
      ? canalFiltro
      : (canais.find(c => c.principal)?.id || canais[0]?.id || '')
    setCanalDiretorio(canalPreferido)
    setBuscaDiretorio('')
    setDiretorio([])
    setNovoDDD('')
    setNovoTelefone('')
    setNovoNome('')
    setDiretorioAberto(true)
  }

  async function carregarDiretorio() {
    if (!diretorioAberto || !canalDiretorio) return
    setCarregandoDiretorio(true)
    try {
      const headers = await headersJson()
      const params = new URLSearchParams({
        canalId: canalDiretorio,
        busca: buscaDiretorio.trim(),
      })
      const resp = await fetch(`/api/integracoes/whatsapp/contatos?${params.toString()}`, { headers, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao buscar contatos do WhatsApp.')
      setDiretorio(json.itens || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao buscar contatos do WhatsApp.')
      setDiretorio([])
    } finally {
      setCarregandoDiretorio(false)
    }
  }

  async function iniciarDoDiretorio(item: DiretorioWhatsApp) {
    try {
      const canalId = item.canalId || canalDiretorio
      if (!canalId) throw new Error('Canal WhatsApp não identificado.')
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/contatos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          canalId,
          tipo: item.tipo,
          jid: item.jid,
          telefone: item.telefone || null,
          nome: item.nome,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao abrir conversa.')
      setDiretorioAberto(false)
      selecionarConversa(json.conversa as Conversa)
      agendarRefreshConversas(0)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir conversa.')
    }
  }

  async function iniciarPorNumero() {
    if (iniciandoNumero) return
    setErro('')
    const ddd = novoDDD.replace(/\D/g, '')
    const numero = novoTelefone.replace(/\D/g, '')
    const digitos = ddd ? `${ddd}${numero}` : numero
    let telefone = digitos
    if (digitos.length === 10 || digitos.length === 11) telefone = `55${digitos}`
    if (ddd && ddd.length !== 2) {
      setErro('Informe o DDD com 2 dígitos. Ex.: 17.')
      return
    }
    if (ddd && (numero.length < 8 || numero.length > 9)) {
      setErro('Informe o número do WhatsApp com 8 ou 9 dígitos.')
      return
    }
    if (!/^55\d{10,11}$/.test(telefone)) {
      setErro('Informe o DDD e o número do WhatsApp. Ex.: 17 99176-4080.')
      return
    }
    if (!canalDiretorio) {
      setErro('Canal WhatsApp não identificado.')
      return
    }

    setIniciandoNumero(true)
    try {
      await iniciarDoDiretorio({
        id: `novo-${telefone}`,
        tipo: 'contato',
        jid: `${telefone}@s.whatsapp.net`,
        telefone,
        nome: novoNome.trim() || telefoneFormatado(telefone),
        canalId: canalDiretorio,
      })
    } finally {
      setIniciandoNumero(false)
    }
  }

  async function carregarMensagens(conversaId: string) {
    try {
      const headers = await headersJson()
      const resp = await fetch(
        `/api/integracoes/whatsapp/mensagens?conversaId=${encodeURIComponent(conversaId)}`,
        { headers, cache: 'no-store' },
      )
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao carregar mensagens.')
      if (conversaAtivaIdRef.current !== conversaId) return
      setMensagens(json.mensagens || [])
    } catch (e) {
      if (conversaAtivaIdRef.current !== conversaId) return
      setErro(e instanceof Error ? e.message : 'Falha ao carregar mensagens.')
    }
  }

  async function carregarSugestaoIA(conversaId: string) {
    try {
      const headers = await headersJson()
      const resp = await fetch(`/api/integracoes/whatsapp/ia?conversaId=${encodeURIComponent(conversaId)}`, { headers, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) return
      if (conversaAtivaIdRef.current !== conversaId) return
      setSugestaoIA((json.sugestao || null) as SugestaoIA | null)
      setModoIA((json.modo || 'observando') as 'observando' | 'sugerindo' | 'automatico')
    } catch {}
  }

  async function acaoSugestaoIA(acao: 'usar' | 'rejeitar') {
    if (!sugestaoIA) return
    const atual = sugestaoIA
    if (acao === 'usar') setTexto(atual.texto)
    setSugestaoIA(null)
    try {
      const headers = await headersJson()
      await fetch('/api/integracoes/whatsapp/ia', {
        method: 'POST', headers,
        body: JSON.stringify({ sugestaoId: atual.id, acao }),
      })
    } catch {}
  }

  async function carregarApoio(conversaId: string) {
    try {
      const headers = await headersJson()
      const resp = await fetch(
        `/api/integracoes/whatsapp/apoio?conversaId=${encodeURIComponent(conversaId)}`,
        { headers },
      )
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao carregar recursos internos.')
      if (conversaAtivaIdRef.current !== conversaId) return
      setEtiquetas(json.etiquetas || [])
      setEtiquetasAtivas(json.etiquetasAtivas || [])
      setNotas(json.notas || [])
      setMensagensRapidas(json.mensagensRapidas || [])
      setHistorico(json.historico || [])
    } catch (e) {
      if (conversaAtivaIdRef.current !== conversaId) return
      setErro(e instanceof Error ? e.message : 'Falha ao carregar recursos internos.')
    }
  }

  useEffect(() => { void carregarConversas() }, [])

  useEffect(() => {
    if (!eu?.id) return
    const usuarioId = eu.id

    const atualizar = () => { void atualizarConversasInternas(usuarioId) }
    atualizar()

    const canal = supabase
      .channel(`whatsapp-atlas-lista-interna-${usuarioId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversas' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participantes' }, atualizar)
      .subscribe()

    // Fallback para manter a experiência em tempo real mesmo se o websocket
    // oscilar ou o navegador suspender a aba por alguns segundos.
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') atualizar()
    }, 2000)

    const aoVoltar = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') atualizar()
    }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
      void supabase.removeChannel(canal)
    }
  }, [eu?.id])

  useEffect(() => {
    const conversaId = conversaInternaAtiva?.id
    if (!conversaId) {
      setMensagensInternas([])
      setParticipantesConversaInterna([])
      return
    }

    let vivo = true
    const carregar = async () => {
      const [mensagens, participantes] = await Promise.all([
        listarMensagensInternas(conversaId),
        listarParticipantesInternos(conversaId),
      ])
      if (!vivo) return
      setMensagensInternas(mensagens)
      setParticipantesConversaInterna(participantes.map(p => ({
        id: p.usuario_id,
        nome: p.usuario_nome || 'Usuário',
      })))
      if (eu?.id) {
        await marcarConversaComoLida(conversaId, eu.id)
        if (vivo) setConversasInternas(lista=>lista.map(item=>item.id===conversaId?{...item,nao_lidas:0}:item))
      }
    }

    void carregar()
    const canal = supabase
      .channel(`whatsapp-atlas-interno-${conversaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: `conversa_id=eq.${conversaId}` }, payload => {
        if (!vivo) return
        const nova = payload.new as ChatMensagem
        setMensagensInternas(atual => atual.some(m => m.id === nova.id) ? atual : [...atual, nova])
        void atualizarConversasInternas()
      })
      .subscribe()

    return () => {
      vivo = false
      void supabase.removeChannel(canal)
    }
  }, [conversaInternaAtiva?.id])

  useEffect(() => {
    if (!diretorioAberto || !canalDiretorio) return
    const timer = setTimeout(() => { void carregarDiretorio() }, 250)
    return () => clearTimeout(timer)
  }, [diretorioAberto, canalDiretorio, buscaDiretorio])

  useEffect(() => {
    const q = busca.trim()
    if (q.length < 2 || canais.length === 0) {
      setContatosBusca([])
      setBuscandoContatos(false)
      return
    }

    let ativo = true
    const timer = setTimeout(() => {
      void (async () => {
        setBuscandoContatos(true)
        try {
          const headers = await headersJson()
          // Busca global: procura o contato em todos os WhatsApps conectados,
          // independente do filtro/canal que estiver aberto na tela.
          const canalSelecionado = canalFiltro !== 'todos' ? canalFiltro : ''
          const principal = canais.find(c => c.principal)?.id || ''
          const ids = [
            ...(canalSelecionado ? [canalSelecionado] : []),
            ...(principal && principal !== canalSelecionado ? [principal] : []),
            ...canais.map(c => c.id).filter(id => id !== canalSelecionado && id !== principal),
          ]

          const respostas = await Promise.all(ids.map(async canalId => {
            const params = new URLSearchParams({ canalId, busca: q })
            const resp = await fetch(`/api/integracoes/whatsapp/contatos?${params.toString()}`, { headers, cache: 'no-store' })
            const json = await resp.json()
            if (!resp.ok) return [] as DiretorioWhatsApp[]
            return ((json.itens || []) as DiretorioWhatsApp[]).map(item => ({ ...item, canalId }))
          }))
          if (ativo) {
            // Remove duplicados por telefone/JID. Como a ordem acima prioriza
            // o canal atual e depois o número principal, o melhor resultado fica.
            const unicos = new Map<string, DiretorioWhatsApp>()
            for (const item of respostas.flat()) {
              const telefone = String(item.telefone || '').replace(/\D/g, '')
              const jidNormalizado = String(item.jid || '').replace(/^\d+@lid$/, '')
              const chave = telefone ? `tel:${telefone}` : `jid:${jidNormalizado || item.jid}`
              if (!unicos.has(chave)) unicos.set(chave, item)
            }
            setContatosBusca([...unicos.values()].slice(0, 40))
          }
        } catch {
          if (ativo) setContatosBusca([])
        } finally {
          if (ativo) setBuscandoContatos(false)
        }
      })()
    }, 220)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [busca, canalFiltro, canais])

  useEffect(() => {
    conversaAtivaIdRef.current = ativa?.id || null
    if (!ativa?.id) {
      setMensagens([])
      setEtiquetas([])
      setEtiquetasAtivas([])
      setNotas([])
      setMensagensRapidas([])
      setHistorico([])
      setSugestaoIA(null)
      return
    }
    const conversaId = ativa.id
    setMensagens([])
    setEtiquetas([])
    setEtiquetasAtivas([])
    setNotas([])
    setMensagensRapidas([])
    setHistorico([])
    setSugestaoIA(null)
    setMensagemRespondendo(null)
    setEmojiMensagemId(null)
    setEmojiCustom('')
    setTransferenciaAberta(false)
    setDelegacaoAberta(false)
    setApoioAberto(null)
    void carregarMensagens(conversaId)
    void carregarApoio(conversaId)
    void (async () => {
      try {
        const headers = await headersJson()
        await fetch('/api/integracoes/whatsapp/conversas', {
          method: 'POST',
          headers,
          body: JSON.stringify({ acao: 'visualizar', conversaId }),
        })
      } catch {}
    })()
  }, [ativa?.id])

  useEffect(() => {
    if (!ativa?.id) {
      setSugestaoIA(null)
      setModoIA('observando')
      return
    }
    const conversaId = ativa.id
    const atualizar = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void carregarSugestaoIA(conversaId)
      }
    }
    atualizar()
    const timer = setInterval(atualizar, 15000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [ativa?.id])

  useEffect(() => {
    let vivo = true
    if (!ativa?.cliente_id) {
      setCliente(null)
      setObras([])
      setCarregandoCliente(false)
      return
    }
    setCarregandoCliente(true)
    Promise.all([
      supabase.from('clientes')
        .select('id,nome,whatsapp,telefone,cidade,endereco,bairro,observacoes')
        .eq('id', ativa.cliente_id).maybeSingle(),
      supabase.from('obras')
        .select('id,nome,status')
        .eq('cliente_id', ativa.cliente_id)
        .order('created_at', { ascending: false }).limit(4),
    ]).then(([clienteResp, obrasResp]) => {
      if (!vivo) return
      setCliente((clienteResp.data || null) as ClienteResumo | null)
      setObras((obrasResp.data || []) as ObraResumo[])
      setCarregandoCliente(false)
    }).catch(() => {
      if (!vivo) return
      setCliente(null)
      setObras([])
      setCarregandoCliente(false)
    })
    return () => { vivo = false }
  }, [ativa?.cliente_id])

  useEffect(() => {
    if (!eu?.id) return
    const canal = supabase
      .channel(`atendimento-whatsapp-${eu.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimento_conversas' }, () => {
        agendarRefreshConversas()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atendimento_mensagens' }, p => {
        const mensagem = p.new as Mensagem
        if (mensagem.conversa_id === ativa?.id) void carregarMensagens(ativa.id)
        agendarRefreshConversas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimento_whatsapp_permissoes' }, () => {
        agendarRefreshConversas(0)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimento_whatsapp_canais' }, () => {
        agendarRefreshConversas(0)
      })
      .subscribe()
    return () => { void supabase.removeChannel(canal) }
  }, [eu?.id, ativa?.id])

  useEffect(() => {
    if (!eu?.id) return

    const atualizarTela = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      agendarRefreshConversas(0)
      const conversaId = conversaAtivaIdRef.current
      if (conversaId) void carregarMensagens(conversaId)
    }

    const aoVoltarParaTela = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') atualizarTela()
    }

    const timer = setInterval(atualizarTela, 2000)
    window.addEventListener('focus', atualizarTela)
    document.addEventListener('visibilitychange', aoVoltarParaTela)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', atualizarTela)
      document.removeEventListener('visibilitychange', aoVoltarParaTela)
    }
  }, [eu?.id, ativa?.id])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.length])

  const internasFiltradas = useMemo(() => {
    const q = buscaInterna.toLocaleLowerCase('pt-BR').trim()
    return conversasInternas.filter(c => {
      if (!q) return true
      return `${c.nome || ''} ${c.ultima_mensagem || ''}`.toLocaleLowerCase('pt-BR').includes(q)
    })
  }, [conversasInternas, buscaInterna])

  const totalInternasNaoLidas = useMemo(
    () => conversasInternas.reduce((soma,c)=>soma+Number(c.nao_lidas||0),0),
    [conversasInternas],
  )

  const filtradas = useMemo(() => {
    const q = busca.toLocaleLowerCase('pt-BR').trim()
    return conversas.filter(c => {
      if (filtro === 'internas') return false
      if (!c.ultima_mensagem_em && filtro !== 'grupos') return false
      if (canalFiltro !== 'todos' && c.whatsapp_canal_id !== canalFiltro) return false
      if (filtro === 'aguardando') {
        const podeSerMeu = !c.responsavel_id || c.responsavel_id === eu?.id || eu?.role === 'master'
        const aguardandoAceite = c.status === 'aguardando' && podeSerMeu
        const aguardandoMensagem = Number(c.nao_lidas || 0) > 0 && podeSerMeu && c.status !== 'finalizado'
        if (!aguardandoAceite && !aguardandoMensagem) return false
      }
      if (filtro === 'com_atendente' && (!c.responsavel_id || c.status === 'finalizado')) return false
      if (filtro === 'minhas' && (c.responsavel_id !== eu?.id || c.status === 'finalizado')) return false
      if (filtro === 'nao_lidas' && !c.nao_lidas) return false
      if (filtro === 'acompanhando' && !c.acompanhando) return false
      if (filtro === 'transferidas' && !c.transferida_em) return false
      if (filtro === 'finalizadas' && c.status !== 'finalizado') return false
      if (filtro === 'grupos' && c.whatsapp_chat_tipo !== 'grupo') return false
      if (!q) return true
      return `${c.contato_nome || ''} ${c.grupo_nome || ''} ${c.telefone} ${c.responsavel_nome || ''} ${c.setor || ''}`
        .toLocaleLowerCase('pt-BR').includes(q)
    })
  }, [conversas, busca, filtro, canalFiltro, eu?.id, eu?.role])

  const usuariosInternosBusca = useMemo(() => {
    const q = busca.toLocaleLowerCase('pt-BR').trim()
    if (q.length < 2) return []
    return usuarios
      .filter(u => u.id !== eu?.id && String(u.nome || '').toLocaleLowerCase('pt-BR').includes(q))
      .slice(0, 12)
  }, [usuarios, eu?.id, busca])

  const contatosBuscaVisiveis = useMemo(() => {
    if (busca.trim().length < 2) return []
    const visiveis = new Set(
      filtradas.flatMap(c => [
        c.whatsapp_chat_jid ? `${c.whatsapp_canal_id || ''}:${c.whatsapp_chat_jid}` : '',
        c.telefone ? `${c.whatsapp_canal_id || ''}:tel:${c.telefone.replace(/\D/g, '')}` : '',
      ]).filter(Boolean),
    )
    return contatosBusca.filter(item => {
      const porJid = `${item.canalId || ''}:${item.jid}`
      const porTelefone = item.telefone
        ? `${item.canalId || ''}:tel:${item.telefone.replace(/\D/g, '')}`
        : ''
      return !visiveis.has(porJid) && (!porTelefone || !visiveis.has(porTelefone))
    })
  }, [contatosBusca, filtradas, busca])

  async function acaoConversaPorId(conversaId: string, acao: string, extra: Record<string, unknown> = {}) {
    if (!conversaId) return false
    setErro('')

    const anteriorLista = conversas.find(c => c.id === conversaId) || null
    const anteriorAtiva = ativa?.id === conversaId ? ativa : null
    const destino = extra.destinoId ? usuarios.find(u => u.id === String(extra.destinoId)) || null : null

    const aplicar = (c: Conversa): Conversa => {
      if (c.id !== conversaId) return c
      if (acao === 'assumir') return { ...c, responsavel_id: eu?.id || c.responsavel_id, responsavel_nome: eu?.nome || c.responsavel_nome, status: 'em_atendimento', nao_lidas: 0 }
      if (acao === 'finalizar') return { ...c, status: 'finalizado', nao_lidas: 0 }
      if (acao === 'marcar_lida') return { ...c, nao_lidas: 0 }
      if (acao === 'acompanhar') return { ...c, acompanhando: true }
      if (acao === 'parar_acompanhar') return { ...c, acompanhando: false }
      if (acao === 'transferir' && destino) {
        return { ...c, responsavel_id: destino.id, responsavel_nome: destino.nome, status: 'aguardando', setor: extra.setor ? String(extra.setor) : c.setor }
      }
      return c
    }

    setConversas(lista => lista.map(aplicar))
    setAtiva(atual => atual?.id === conversaId ? aplicar(atual) : atual)
    if (acao === 'transferir') {
      setDestinoId('')
      setSetorTransferencia('')
      setTransferenciaAberta(false)
    }

    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/conversas', {
        method: 'POST', headers,
        body: JSON.stringify({ acao, conversaId, ...extra }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel alterar o atendimento.')

      if (acao === 'arquivar' || acao === 'bloquear') {
        setConversas(lista => lista.filter(c => c.id !== conversaId))
        if (conversaAtivaIdRef.current === conversaId) {
          conversaAtivaIdRef.current = null
          setAtiva(null)
          setMensagens([])
          setHistorico([])
        }
      }
      void carregarConversas(false)
      if (conversaAtivaIdRef.current === conversaId) void carregarApoio(conversaId)
      return true
    } catch (e) {
      if (anteriorLista) {
        setConversas(lista => lista.map(c => c.id === conversaId ? anteriorLista : c))
      }
      if (anteriorAtiva) {
        setAtiva(atual => atual?.id === conversaId ? anteriorAtiva : atual)
      }
      setErro(e instanceof Error ? e.message : 'Nao foi possivel alterar o atendimento.')
      return false
    }
  }

  async function acaoConversa(acao: string, extra: Record<string, unknown> = {}) {
    if (!ativa) return
    await acaoConversaPorId(ativa.id, acao, extra)
  }

  function podeAtenderConversa(conversa: Conversa) {
    if (eu?.role === 'master') return true
    if (conversa.whatsapp_chat_tipo === 'grupo') return conversa.grupo_pode_atender === true
    const acesso = conversa.whatsapp_canal_id
      ? acessos.find(a => a.canal_id === conversa.whatsapp_canal_id)
      : null
    return Boolean(acesso?.dono || acesso?.atender)
  }

  function podeTransferirConversa(conversa: Conversa) {
    if (eu?.role === 'master') return true
    if (conversa.whatsapp_chat_tipo === 'grupo') return conversa.grupo_pode_transferir === true
    const acesso = conversa.whatsapp_canal_id
      ? acessos.find(a => a.canal_id === conversa.whatsapp_canal_id)
      : null
    return Boolean(acesso?.transferir)
  }

  function podeSupervisionarConversa(conversa: Conversa) {
    if (eu?.role === 'master') return true
    const acesso = conversa.whatsapp_canal_id
      ? acessos.find(a => a.canal_id === conversa.whatsapp_canal_id)
      : null
    return Boolean(acesso?.dono || acesso?.supervisionar)
  }

  async function delegarResponsabilidadeGrupo() {
    if (!ativa?.grupo_id || !destinoDelegacaoId || salvandoDelegacao) return
    setErro('')
    setSalvandoDelegacao(true)
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/grupos/delegacoes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          grupoId: ativa.grupo_id,
          destinoId: destinoDelegacaoId,
          dias: Math.max(1, diasDelegacao || 1),
          motivo: motivoDelegacao.trim() || null,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel delegar a responsabilidade.')
      setDelegacaoAberta(false)
      setDestinoDelegacaoId('')
      setDiasDelegacao(1)
      setMotivoDelegacao('')
      agendarRefreshConversas()
      void carregarApoio(ativa.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nao foi possivel delegar a responsabilidade.')
    } finally {
      setSalvandoDelegacao(false)
    }
  }

  async function encerrarDelegacaoGrupo() {
    if (!ativa?.grupo_id || salvandoDelegacao) return
    setErro('')
    setSalvandoDelegacao(true)
    try {
      const headers = await headersJson()
      const resp = await fetch(`/api/integracoes/whatsapp/grupos/delegacoes?grupoId=${encodeURIComponent(ativa.grupo_id)}`, {
        method: 'DELETE',
        headers,
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel encerrar a delegacao.')
      setDelegacaoAberta(false)
      agendarRefreshConversas()
      await carregarApoio(ativa.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nao foi possivel encerrar a delegacao.')
    } finally {
      setSalvandoDelegacao(false)
    }
  }

  async function acaoApoio(acao: string, extra: Record<string, unknown> = {}) {
    if (!ativa) return
    setErro('')
    const headers = await headersJson()
    const resp = await fetch('/api/integracoes/whatsapp/apoio', {
      method: 'POST',
      headers,
      body: JSON.stringify({ acao, conversaId: ativa.id, ...extra }),
    })
    const json = await resp.json()
    if (!resp.ok) {
      setErro(json.error || 'Nao foi possivel atualizar o atendimento.')
      return false
    }
    await carregarApoio(ativa.id)
    return true
  }

  function mimeDoArquivo(file: File) {
    const informado = String(file.type || '').split(';')[0].toLowerCase()
    if (informado) return informado
    const ext = file.name.split('.').pop()?.toLowerCase()
    const mapa: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
      mp4: 'video/mp4', mov: 'video/quicktime',
      webm: 'audio/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus', aac: 'audio/aac',
      pdf: 'application/pdf', txt: 'text/plain', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
    return ext ? (mapa[ext] || 'application/octet-stream') : 'application/octet-stream'
  }

  async function enviarArquivo(file: File, opcoes: { ptt?: boolean } = {}) {
    if (!ativa || enviandoMidia) return
    setErro('')
    setEnviandoMidia(true)
    try {
      if (!file.size) throw new Error('Arquivo vazio.')
      if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo excede o limite de 50 MB.')

      const mimeType = mimeDoArquivo(file)
      const headers = await headersJson()
      const preparar = await fetch('/api/integracoes/whatsapp/midia', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          acao: 'preparar',
          conversaId: ativa.id,
          nome: file.name,
          mimeType,
          tamanho: file.size,
        }),
      })
      const prep = await preparar.json()
      if (!preparar.ok) throw new Error(prep.error || 'Não foi possível preparar o arquivo.')

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-midia')
        .uploadToSignedUrl(prep.path, prep.token, file, {
          contentType: mimeType,
          upsert: false,
        })
      if (uploadError) throw new Error(uploadError.message)

      const registrar = await fetch('/api/integracoes/whatsapp/midia', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          acao: 'enviar',
          conversaId: ativa.id,
          mediaPath: prep.path,
          mimeType,
          fileName: file.name,
          tamanho: file.size,
          ptt: opcoes.ptt === true,
        }),
      })
      const envio = await registrar.json()
      if (!registrar.ok) throw new Error(envio.error || 'Não foi possível enfileirar a mídia.')

      await carregarMensagens(ativa.id)
      agendarRefreshConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o arquivo.')
    } finally {
      setEnviandoMidia(false)
      if (arquivoInputRef.current) arquivoInputRef.current.value = ''
    }
  }

  async function alternarAudio() {
    if (gravando) {
      gravadorRef.current?.stop()
      return
    }

    try {
      setErro('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      partesAudioRef.current = []
      const preferido = typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const gravador = preferido
        ? new MediaRecorder(stream, { mimeType: preferido })
        : new MediaRecorder(stream)
      gravadorRef.current = gravador

      gravador.ondataavailable = evento => {
        if (evento.data.size) partesAudioRef.current.push(evento.data)
      }
      gravador.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current)
        timerGravacaoRef.current = null
        setGravando(false)
        setSegundosGravacao(0)

        const blob = new Blob(partesAudioRef.current, { type: 'audio/webm' })
        if (blob.size) {
          const arquivo = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' })
          void enviarArquivo(arquivo, { ptt: true })
        }
      }

      gravador.start(250)
      setGravando(true)
      setSegundosGravacao(0)
      timerGravacaoRef.current = setInterval(() => {
        setSegundosGravacao(valor => valor + 1)
      }, 1000)
    } catch {
      setErro('Não foi possível acessar o microfone. Autorize o microfone para este site e tente novamente.')
      setGravando(false)
    }
  }

  async function enviar() {
    if (!ativa || !texto.trim() || enviando) return
    const corpo = texto.trim()
    setTexto('')
    setEnviando(true)
    setErro('')
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/mensagens', {
        method: 'POST', headers,
        body: JSON.stringify({
          conversaId: ativa.id,
          texto: corpo,
          respostaMensagemId: mensagemRespondendo?.id || null,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel enviar.')
      setMensagemRespondendo(null)
      await carregarMensagens(ativa.id)
      agendarRefreshConversas()
    } catch (e) {
      setTexto(corpo)
      setErro(e instanceof Error ? e.message : 'Nao foi possivel enviar.')
    } finally {
      setEnviando(false)
    }
  }

  async function reagirMensagem(mensagemId: string, emoji: string) {
    if (!ativa || !mensagemId || !emoji.trim()) return
    setErro('')
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/mensagens', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          acao: 'reagir',
          conversaId: ativa.id,
          mensagemId,
          emoji: emoji.trim(),
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel reagir.')
      setEmojiMensagemId(null)
      setEmojiCustom('')
      await carregarMensagens(ativa.id)
      await carregarApoio(ativa.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nao foi possivel reagir.')
    }
  }

  const reacoesPorMensagem = useMemo(() => {
    const porWhatsapp = new Map<string,string>()
    for (const m of mensagens) {
      if (m.whatsapp_message_id) porWhatsapp.set(m.whatsapp_message_id, m.id)
    }
    const mapa = new Map<string, Array<{emoji:string; usuario:string}>>()
    for (const m of mensagens) {
      if (m.tipo !== 'reacao') continue
      const p = m.payload && typeof m.payload === 'object' ? m.payload : {}
      const targetWhatsapp =
        p.reactionTargetWhatsappId ||
        p.reactionKey?.id ||
        p.reactionKey?.key?.id ||
        null
      const targetId =
        p.reactionTargetMessageId ||
        (targetWhatsapp ? porWhatsapp.get(String(targetWhatsapp)) : null)
      if (!targetId) continue
      const atual = mapa.get(String(targetId)) || []
      atual.push({ emoji: String(m.texto || '👍'), usuario: m.usuario_nome || (m.direcao === 'saida' ? 'Equipe' : 'WhatsApp') })
      mapa.set(String(targetId), atual)
    }
    return mapa
  }, [mensagens])

  const mensagensVisiveis = useMemo(
    () => mensagens.filter(m => m.tipo !== 'reacao'),
    [mensagens],
  )

  const totais = useMemo(() => {
    const doCanal = conversas.filter(c =>
      canalFiltro === 'todos' || c.whatsapp_canal_id === canalFiltro
    )
    const chats = doCanal.filter(c => Boolean(c.ultima_mensagem_em))
    return {
      todas: chats.length,
      internas: conversasInternas.length,
      abertas: chats.filter(c => c.status !== 'finalizado').length,
      aguardando: chats.filter(c => {
        const podeSerMeu = !c.responsavel_id || c.responsavel_id === eu?.id || eu?.role === 'master'
        return c.status !== 'finalizado' && podeSerMeu &&
          (c.status === 'aguardando' || Number(c.nao_lidas || 0) > 0)
      }).length,
      comAtendente: chats.filter(c => Boolean(c.responsavel_id) && c.status !== 'finalizado').length,
      minhas: chats.filter(c => c.responsavel_id === eu?.id && c.status !== 'finalizado').length,
      grupos: doCanal.filter(c => c.whatsapp_chat_tipo === 'grupo').length,
      naoLidas: chats.filter(c => Number(c.nao_lidas || 0) > 0).length,
      acompanhando: chats.filter(c => Boolean(c.acompanhando)).length,
      transferidas: chats.filter(c => Boolean(c.transferida_em)).length,
      finalizadas: chats.filter(c => c.status === 'finalizado').length,
    }
  }, [conversas, conversasInternas.length, eu?.id, canalFiltro])

  const acessoCanalAtivo = ativa?.whatsapp_canal_id
    ? acessos.find(a => a.canal_id === ativa.whatsapp_canal_id) || null
    : null
  const podeResponder = Boolean(
    ativa &&
    ativa.responsavel_id === eu?.id &&
    ativa.status === 'em_atendimento'
  )
  const podeAssumirAtiva = Boolean(
    ativa &&
    ativa.status !== 'finalizado' &&
    (ativa.whatsapp_chat_tipo !== 'grupo' || ativa.grupo_pode_atender === true || eu?.role === 'master') &&
    (
      !ativa.responsavel_id ||
      (ativa.responsavel_id === eu?.id && ativa.status === 'aguardando') ||
      (eu?.role === 'master' && ativa.responsavel_id !== eu?.id)
    )
  )
  const atendimentoMeu = Boolean(
    ativa &&
    ativa.responsavel_id === eu?.id &&
    ativa.status === 'em_atendimento'
  )
  const podeReabrirAtiva = Boolean(
    ativa &&
    ativa.status === 'finalizado' &&
    ativa.whatsapp_chat_tipo !== 'grupo' &&
    (
      eu?.role === 'master' ||
      acessoCanalAtivo?.dono ||
      acessoCanalAtivo?.atender
    )
  )
  const canalAtivo = ativa?.whatsapp_canal_id
    ? canais.find(c=>c.id===ativa.whatsapp_canal_id) || null
    : null
  const canalSelecionado = canalFiltro !== 'todos'
    ? canais.find(c => c.id === canalFiltro) || null
    : null
  const canalPronto = canalAtivo?.gateway_status === 'connected'
  const podeTransferirAtiva = Boolean(
    ativa && (
      eu?.role === 'master' ||
      (ativa.whatsapp_chat_tipo === 'grupo' ? ativa.grupo_pode_transferir === true : acessoCanalAtivo?.transferir)
    ),
  )
  const podeArquivarAtiva = Boolean(
    ativa && (
      eu?.role === 'master' ||
      acessoCanalAtivo?.dono ||
      acessoCanalAtivo?.transferir ||
      ativa.responsavel_id === eu?.id
    )
  )
  const podeBloquearAtiva = Boolean(
    ativa &&
    ativa.whatsapp_chat_tipo !== 'grupo' &&
    (
      eu?.role === 'master' ||
      acessoCanalAtivo?.dono ||
      acessoCanalAtivo?.transferir
    )
  )
  const podeSupervisionarAtiva = Boolean(
    ativa && (
      eu?.role === 'master' ||
      acessoCanalAtivo?.dono ||
      acessoCanalAtivo?.supervisionar
    )
  )
  const podeDelegarGrupo = Boolean(
    ativa?.whatsapp_chat_tipo === 'grupo' &&
    ativa.grupo_id &&
    (eu?.role === 'master' || ativa.grupo_pode_delegar === true)
  )

  const cadastroNome = ativa?.contato_nome || ''
  const cadastroWhatsApp = ativa?.telefone || ''
  const cadastroConversaId = ativa?.id || ''
  const urlCadastroCliente = ativa
    ? '/clientes/novo?origem=whatsapp&nome=' + encodeURIComponent(cadastroNome) + '&whatsapp=' + encodeURIComponent(cadastroWhatsApp) + '&conversaId=' + encodeURIComponent(cadastroConversaId)
    : '/clientes/novo'
  const urlCadastroColaborador = ativa
    ? '/cadastro?aba=usuarios&origem=whatsapp&nome=' + encodeURIComponent(cadastroNome) + '&whatsapp=' + encodeURIComponent(cadastroWhatsApp)
    : '/cadastro?aba=usuarios'
  const urlCadastroFornecedor = ativa
    ? '/cadastro/fornecedores?novo=1&origem=whatsapp&nome=' + encodeURIComponent(cadastroNome) + '&whatsapp=' + encodeURIComponent(cadastroWhatsApp)
    : '/cadastro/fornecedores'

  return (
    <main className="h-[100dvh] min-h-0 w-full max-w-full overflow-x-hidden overflow-y-hidden bg-white p-0">
      <div className="h-[100dvh] w-full max-w-full overflow-x-hidden overflow-y-hidden bg-white">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link>
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={20}/>
                <h1 className="font-bold text-slate-900">WhatsApp Atlas</h1>
              </div>
              <p className="text-xs text-slate-500">
                {canalSelecionado
                  ? `${canalSelecionado.nome} · ${canalSelecionado.principal ? 'Empresa' : 'Pessoal'}`
                  : canais.length === 1
                    ? `${canais[0].nome} · ${telefoneFormatado(canais[0].numero_conectado || canais[0].numero_declarado || '')}`
                    : `${canais.length} canais conectados`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:inline-flex">
              {canaisConectados === 1 ? '1 canal conectado' : `${canaisConectados} canais conectados`}
            </span>
            {pushDisponivel && !pushInscrito && (
              <button
                type="button"
                onClick={() => void ativarNotificacoesDesktop()}
                disabled={ativandoPush}
                className="hidden items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 sm:inline-flex"
                title="Ativar notificações deste computador"
              >
                <BellRing size={15}/>
                {ativandoPush ? 'Ativando...' : 'Ativar notificações'}
              </button>
            )}
            <button
              type="button"
              onClick={abrirConversaInterna}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              title="Iniciar conversa interna com alguém da empresa"
            >
              <Plus size={15}/>
              <span className="hidden sm:inline">Nova conversa interna</span>
            </button>
            <Link href="/whatsapp/numeros" className="rounded-xl border p-2 hover:bg-slate-50" title="Gerenciar canais WhatsApp">
              <Smartphone size={18}/>
            </Link>
            {eu?.role === 'master' && (
              <Link href="/whatsapp/configuracao" className="rounded-xl border p-2 hover:bg-slate-50" title="Configurar roteamento">
                <Settings size={18}/>
              </Link>
            )}
          </div>
        </header>

        {erro && <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}
        {!carregando && canais.length === 0 && (
          <div className="border-b bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            Nenhum WhatsApp está conectado. Conecte um número para carregar as conversas.
          </div>
        )}

        <div className="grid h-[calc(100dvh-72px)] min-h-0 w-full max-w-full grid-cols-[minmax(0,1fr)] overflow-hidden md:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className={`${ativa || conversaInternaAtiva ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden border-r`}>
            <div className="border-b p-3">
              {canais.length > 1 && (
                <div className="mb-3 md:hidden">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Número em uso</span>
                    <span className="text-[10px] text-slate-400">Toque para trocar</span>
                  </div>
                  <div className="-mx-1 min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-1 pb-1">
                    <div className="flex w-max min-w-full gap-2">
                      {canais.map(c => {
                        const selecionado = canalFiltro === c.id
                        return (
                          <button key={c.id} type="button" onClick={() => selecionarCanal(c.id)}
                            className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${selecionado ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}>
                            <span className="block text-xs font-extrabold">{c.nome}</span>
                            <span className="mt-0.5 block text-[10px] font-medium opacity-70">{c.principal ? 'Empresa' : (c.usuario_nome || 'Pessoal')}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Conversas</p>
                  <p className="text-[11px] text-slate-500">WhatsApp + conversas internas da equipe</p>
                </div>
                <div className="flex items-center gap-1">
                  {canais.length > 1 && (
                    <select value={canalFiltro === 'todos' ? (canais.find(c => c.principal)?.id || canais[0]?.id || '') : canalFiltro}
                      onChange={e=>selecionarCanal(e.target.value)}
                      className="hidden max-w-[145px] rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 md:block">
                      {canais.map(c=><option key={c.id} value={c.id}>{c.nome}{c.principal?' · Empresa':' · Pessoal'}</option>)}
                    </select>
                  )}
                  <button onClick={abrirDiretorio} disabled={canais.length===0}
                    className="grid h-8 w-8 place-items-center rounded-lg border bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={canais.length ? 'Nova conversa ou abrir grupo' : 'Conecte um WhatsApp primeiro'}>
                    <Plus size={16}/>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3">
                <Search size={16} className="text-slate-400"/>
                <input value={busca} onChange={e=>setBusca(e.target.value)}
                  placeholder="Buscar conversas..." className="w-full bg-transparent py-2.5 text-sm outline-none"/>
              </div>
              <div className="mt-3 flex items-center justify-between px-0.5">
                <span className="text-xs font-extrabold text-slate-800">Conversas</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">{totais.todas} no total</span>
              </div>
              <div className="mt-2 min-w-0 max-w-full">
                <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <button onClick={()=>setFiltro('todas')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='todas'?'border-blue-600 bg-blue-600 text-white':'bg-white text-slate-600'}`}>
                  Todas {totais.todas}
                </button>
                <button onClick={()=>setFiltro('aguardando')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='aguardando'?'border-amber-500 bg-amber-50 text-amber-800':'bg-white text-slate-600'}`}>
                  Aguardando {totais.aguardando}
                </button>
                <button onClick={()=>setFiltro('com_atendente')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='com_atendente'?'border-emerald-500 bg-emerald-50 text-emerald-800':'bg-white text-slate-600'}`}>
                  Com atendente {totais.comAtendente}
                </button>
                <button onClick={()=>setFiltro('nao_lidas')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='nao_lidas'?'border-red-400 bg-red-50 text-red-700':'bg-white text-slate-600'}`}>
                  Não lidas {totais.naoLidas}
                </button>
                <button onClick={()=>setFiltro('minhas')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='minhas'?'border-blue-400 bg-blue-50 text-blue-700':'bg-white text-slate-600'}`}>
                  Minhas {totais.minhas}
                </button>
                <button onClick={()=>setFiltro('acompanhando')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='acompanhando'?'border-cyan-400 bg-cyan-50 text-cyan-700':'bg-white text-slate-600'}`}>
                  Acompanhando {totais.acompanhando}
                </button>
                <button onClick={()=>setFiltro('transferidas')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='transferidas'?'border-violet-400 bg-violet-50 text-violet-700':'bg-white text-slate-600'}`}>
                  Transferidas {totais.transferidas}
                </button>
                <button onClick={()=>setFiltro('finalizadas')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='finalizadas'?'border-slate-400 bg-slate-100 text-slate-700':'bg-white text-slate-600'}`}>
                  Finalizadas {totais.finalizadas}
                </button>
                <button onClick={()=>setFiltro('grupos')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 ${filtro==='grupos'?'border-violet-400 bg-violet-50 text-violet-700':'bg-white text-slate-600'}`}>
                  Grupos {totais.grupos}
                </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {carregando ? (
                <div className="p-8 text-center text-sm text-slate-400">Carregando atendimentos...</div>
              ) : filtradas.length === 0 && contatosBuscaVisiveis.length === 0 && usuariosInternosBusca.length === 0 && !buscandoContatos ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  {busca.trim().length >= 2 ? 'Nenhum contato ou conversa encontrado.' : 'Nenhuma conversa neste filtro.'}
                </div>
              ) : (
                <>
                  {filtradas.map(c => (
                <div key={c.id} role="button" tabIndex={0}
                  onClick={()=>selecionarConversa(c)}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selecionarConversa(c)}}}
                  className={`group flex w-full cursor-pointer gap-3 border-b px-4 py-3 text-left outline-none transition hover:bg-slate-50 focus:bg-slate-50 ${ativa?.id===c.id?'bg-emerald-50':''}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                    {c.whatsapp_chat_tipo === 'grupo'
                      ? <Users size={18}/>
                      : (c.contato_nome || c.telefone).slice(0,1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="truncate text-sm">
                        {c.whatsapp_chat_tipo === 'grupo'
                          ? (c.grupo_nome || c.contato_nome || 'Grupo WhatsApp')
                          : (c.contato_nome || telefoneFormatado(c.telefone))}
                      </b>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">{hora(c.ultima_mensagem_em)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {c.ultimo_preview || (c.whatsapp_chat_tipo === 'grupo' ? 'Grupo sincronizado do WhatsApp' : 'Conversa WhatsApp')}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      {c.whatsapp_chat_tipo === 'grupo' && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">Grupo</span>
                      )}
                      {c.status === 'finalizado' ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Finalizado</span>
                      ) : c.status === 'em_atendimento' && c.responsavel_id ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          Atendimento por {c.responsavel_nome || (c.responsavel_id===eu?.id ? 'você' : 'atendente')}
                        </span>
                      ) : c.responsavel_id ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          Aguardando {c.responsavel_id===eu?.id ? 'você' : (c.responsavel_nome || 'atendente')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Aguardando atendimento</span>
                      )}
                      {c.acompanhando && (
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-cyan-700">Acompanhando</span>
                      )}
                      {c.transferida_em && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">Transferida</span>
                      )}
                      {c.setor && <span className="truncate text-slate-400">{c.setor}</span>}
                      {c.whatsapp_canal_id && (
                        <span className="truncate text-emerald-700">
                          {canais.find(x=>x.id===c.whatsapp_canal_id)?.nome || c.whatsapp_numero || 'WhatsApp'}
                        </span>
                      )}
                      {!!c.nao_lidas && <span className="ml-auto rounded-full bg-emerald-600 px-1.5 py-0.5 font-bold text-white">{c.nao_lidas}</span>}
                    </div>
                    {c.status !== 'finalizado' && (
                      <div className={`mt-2 flex flex-wrap gap-1.5 ${!c.responsavel_id ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'}`}>
                        {podeSupervisionarConversa(c) && (
                          <button type="button" onClick={async e=>{e.stopPropagation();await acaoConversaPorId(c.id,c.acompanhando?'parar_acompanhar':'acompanhar')}}
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${c.acompanhando?'border-amber-300 bg-amber-50 text-amber-800':'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}>
                            {c.acompanhando?'Acompanhando':'Acompanhar'}
                          </button>
                        )}
                        {podeTransferirConversa(c) && (
                          <button type="button" onClick={e=>{e.stopPropagation();selecionarConversa(c);setTransferenciaAberta(true)}}
                            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50">
                            Transferir
                          </button>
                        )}
                        <button type="button" onClick={e=>{e.stopPropagation();selecionarConversa(c);setApoioAberto('etiquetas')}}
                          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">
                          Etiquetas
                        </button>
                        {(!c.responsavel_id || (c.responsavel_id === eu?.id && c.status === 'aguardando')) && (
                          <button type="button" onClick={async e=>{e.stopPropagation();selecionarConversa(c);await acaoConversaPorId(c.id,'assumir')}}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100">
                            {c.responsavel_id === eu?.id ? 'Aceitar atendimento' : 'Atender'}
                          </button>
                        )}
                        {c.responsavel_id === eu?.id && Number(c.nao_lidas || 0) > 0 && (
                          <button type="button" onClick={async e=>{e.stopPropagation();await acaoConversaPorId(c.id,'marcar_lida')}}
                            className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-800 hover:bg-blue-100">
                            Dar baixa
                          </button>
                        )}
                      </div>
                    )}
                    {c.status === 'finalizado' && c.whatsapp_chat_tipo !== 'grupo' && podeAtenderConversa(c) && (
                      <div className="mt-2">
                        <button type="button" onClick={async e=>{e.stopPropagation();selecionarConversa(c);await acaoConversaPorId(c.id,'assumir')}}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100">
                          Nova conversa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
                </>
              )}
              {busca.trim().length >= 2 && usuariosInternosBusca.length > 0 && (
                <div className="border-t border-blue-100 bg-blue-50/30">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Equipe Atlas · conversa interna</span>
                  </div>
                  {usuariosInternosBusca.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={async()=>{
                        const conversa=await criarConversaInterna(item.nome,'direta',[{id:item.id,nome:item.nome}])
                        if(conversa){selecionarConversaInterna(conversa);await atualizarConversasInternas()}
                      }}
                      className="flex w-full items-center gap-3 border-t border-blue-100 px-3 py-2.5 text-left hover:bg-blue-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {String(item.nome || '?').slice(0,1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.nome}</p>
                        <p className="truncate text-[11px] text-blue-500">Usuário interno do Atlas</p>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-700">Conversar</span>
                    </button>
                  ))}
                </div>
              )}

              {busca.trim().length >= 2 && (buscandoContatos || contatosBuscaVisiveis.length > 0) && (
                <div className="border-t border-slate-200">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Contatos do WhatsApp</span>
                    {buscandoContatos && <span className="text-[10px] text-slate-400">Buscando...</span>}
                  </div>
                  {contatosBuscaVisiveis.map(item => (
                    <button
                      key={`${item.canalId || ''}:${item.jid}`}
                      onClick={async () => {
                        if (item.bloqueado) {
                          if (!item.conversaId) {
                            setErro('O contato está bloqueado, mas a conversa original não foi localizada para desbloqueio.')
                            return
                          }
                          if (!window.confirm('Desbloquear este contato neste WhatsApp e abrir a conversa novamente?')) return
                          const ok = await acaoConversaPorId(item.conversaId, 'desbloquear')
                          if (!ok) return
                          await iniciarDoDiretorio({ ...item, bloqueado: false })
                          return
                        }
                        await iniciarDoDiretorio(item)
                      }}
                      className={`flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-left ${item.bloqueado?'bg-red-50/60 hover:bg-red-50':'hover:bg-emerald-50'}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${item.bloqueado?'bg-red-100 text-red-700':'bg-emerald-50 text-emerald-700'}`}>
                        {item.bloqueado ? <Ban size={16}/> : item.tipo === 'grupo' ? <Users size={16}/> : item.nome.slice(0,1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.nome}</p>
                        <p className={`truncate text-[11px] ${item.bloqueado?'text-red-600':'text-slate-400'}`}>
                          {item.bloqueado
                            ? `Bloqueado${item.bloqueado_por_nome ? ` por ${item.bloqueado_por_nome}` : ''}`
                            : item.tipo === 'grupo'
                              ? `Grupo · ${item.participantes || 0} participantes`
                              : (item.telefone ? telefoneFormatado(item.telefone) : 'Contato salvo no WhatsApp')}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold ${item.bloqueado?'text-red-700':'text-emerald-700'}`}>
                        {item.bloqueado ? 'Desbloquear' : 'Abrir'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className={`${ativa || conversaInternaAtiva ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-white`}>
            {conversaInternaAtiva ? (
              <>
                <div className="flex min-w-0 items-center gap-3 border-b bg-white px-4 py-3">
                  <button type="button" onClick={()=>setConversaInternaAtiva(null)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-white text-slate-700 md:hidden"
                    aria-label="Voltar para conversas">
                    <ArrowLeft size={18}/>
                  </button>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                    {conversaInternaAtiva.tipo==='grupo'?<Users size={18}/>:String(conversaInternaAtiva.nome||'?').slice(0,1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="truncate text-slate-900">{conversaInternaAtiva.nome || 'Conversa interna'}</b>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">INTERNA</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      Equipe Atlas · conversa interna · {participantesConversaInterna.map(p=>p.nome).join(', ') || 'carregando participantes'}
                    </p>
                  </div>
                  <button type="button" onClick={abrirConversaInterna}
                    className="hidden rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 sm:inline-flex">
                    + Pessoas
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5">
                  <div className="mx-auto max-w-3xl space-y-3">
                    {mensagensInternas.length===0 ? (
                      <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-400">
                        <div>
                          <MessageCircle className="mx-auto mb-3 text-blue-300" size={34}/>
                          <p className="font-semibold text-slate-600">Conversa interna da equipe</p>
                          <p className="mt-1 text-xs">As mensagens ficam somente dentro do Atlas.</p>
                        </div>
                      </div>
                    ) : mensagensInternas.map(m=>{
                      const minha=m.usuario_id===eu?.id
                      return (
                        <div key={m.id} className={`flex ${minha?'justify-end':'justify-start'}`}>
                          <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${minha?'bg-blue-600 text-white':'border bg-white text-slate-800'}`}>
                            {!minha && <b className="mb-1 block text-[11px] text-blue-700">{m.usuario_nome || 'Equipe'}</b>}
                            {m.texto && <p className="whitespace-pre-wrap break-words text-sm">{m.texto}</p>}
                            {m.anexo_url && (
                              /\.(jpg|jpeg|png|webp|heic)$/i.test(m.anexo_nome||'')
                                ? <a href={m.anexo_url} target="_blank" rel="noopener noreferrer"><img src={m.anexo_url} alt={m.anexo_nome||'Imagem'} className="mt-2 max-h-72 max-w-full rounded-xl object-contain"/></a>
                                : /\.(mp4|mov)$/i.test(m.anexo_nome||'')
                                  ? <video src={m.anexo_url} controls playsInline className="mt-2 max-h-72 max-w-full rounded-xl"/>
                                  : /\.(webm|mp3|m4a|ogg)$/i.test(m.anexo_nome||'')
                                    ? <audio src={m.anexo_url} controls className="mt-2 max-w-full"/>
                                    : <a href={m.anexo_url} target="_blank" rel="noopener noreferrer"
                                        className={`mt-2 block max-w-full truncate rounded-lg border px-2 py-1.5 text-xs font-bold ${minha?'border-blue-300 bg-blue-500/30 text-white':'border-blue-100 bg-blue-50 text-blue-600'}`}>
                                        📎 {m.anexo_nome||'Abrir anexo'}
                                      </a>
                            )}
                            <p className={`mt-1 text-right text-[10px] ${minha?'text-blue-100':'text-slate-400'}`}>{hora(m.created_at)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t bg-white p-3">
                  <input ref={arquivoInternoInputRef} type="file" accept="image/*,video/*,audio/*,.pdf"
                    className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void enviarArquivoInterno(f)}}/>
                  <input ref={cameraInternaInputRef} type="file" accept="image/*,video/*" capture="environment"
                    className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void enviarArquivoInterno(f)}}/>
                  <div className="mx-auto flex max-w-3xl items-end gap-2">
                    <button type="button" disabled={enviandoArquivoInterno}
                      onClick={()=>arquivoInternoInputRef.current?.click()}
                      aria-label="Anexar foto, vídeo, áudio ou PDF"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <Paperclip size={18}/>
                    </button>
                    <button type="button" disabled={enviandoArquivoInterno}
                      onClick={()=>cameraInternaInputRef.current?.click()}
                      aria-label="Abrir câmera"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <Camera size={18}/>
                    </button>
                    <textarea
                      value={textoInterno}
                      onChange={e=>setTextoInterno(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void enviarInterno()}}}
                      rows={2}
                      placeholder="Mensagem interna para a equipe..."
                      className="min-h-[54px] max-h-32 flex-1 resize-y rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    {textoInterno.trim() ? (
                      <button type="button" disabled={enviandoInterno}
                        onClick={()=>void enviarInterno()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
                        <Send size={18}/>
                      </button>
                    ) : (
                      <button type="button" disabled={enviandoArquivoInterno}
                        onClick={()=>void alternarAudioInterno()}
                        aria-label={gravandoInterno?'Parar e enviar áudio':'Gravar áudio'}
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-40 ${gravandoInterno?'bg-red-600':'bg-blue-600'}`}>
                        {gravandoInterno?<Square size={15}/>:<Mic size={18}/>}
                      </button>
                    )}
                  </div>
                  {gravandoInterno && (
                    <p className="mx-auto mt-1 max-w-3xl text-xs font-semibold text-red-600">
                      Gravando áudio… toque no botão vermelho para enviar.
                    </p>
                  )}
                  <p className="mt-2 text-center text-[10px] font-medium text-blue-500">
                    Conversa interna — visível apenas aos participantes e ao Master.
                  </p>
                </div>
              </>
            ) : !ativa ? (
              <div className="grid h-full place-items-center text-center text-slate-500">
                <div><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border-2 border-blue-200 bg-blue-50 text-blue-500"><MessageCircle size={30}/></div><p className="font-semibold text-slate-600">Selecione uma conversa para começar</p></div>
              </div>
            ) : <>
              <div className="flex min-w-0 flex-wrap items-center gap-2 border-b bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <button type="button" onClick={()=>setAtiva(null)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-white text-slate-700 md:hidden"
                  aria-label="Voltar para conversas" title="Voltar para conversas">
                  <ArrowLeft size={18}/>
                </button>
                <div className="min-w-0 flex-1">
                  <b className="block truncate">
                    {ativa.whatsapp_chat_tipo === 'grupo'
                      ? (ativa.grupo_nome || ativa.contato_nome || 'Grupo WhatsApp')
                      : (ativa.contato_nome || telefoneFormatado(ativa.telefone))}
                  </b>
                  <p className="text-xs text-slate-500">
                    {ativa.whatsapp_chat_tipo === 'grupo'
                      ? `Grupo WhatsApp · ${ativa.status === 'em_atendimento' && ativa.responsavel_nome
                          ? `Atendimento por ${ativa.responsavel_nome}`
                          : ativa.responsavel_nome
                            ? `Aguardando ${ativa.responsavel_nome}`
                            : 'Aguardando atendimento'}`
                      : `${telefoneFormatado(ativa.telefone)} · ${ativa.status === 'em_atendimento' && ativa.responsavel_nome
                          ? `Atendimento por ${ativa.responsavel_nome}`
                          : ativa.responsavel_nome || 'Em espera'}`}
                    {ativa.setor ? ` · ${ativa.setor}` : ''}
                  </p>
                  {canalAtivo&&(
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                      Via {canalAtivo.nome}{canalAtivo.numero_declarado ? ` · ${telefoneFormatado(canalAtivo.numero_declarado)}` : ''}
                    </p>
                  )}
                  {!!etiquetasAtivas.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {etiquetas.filter(e => etiquetasAtivas.includes(e.id)).map(e => (
                        <span key={e.id} className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {e.nome}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {ativa.cliente_id && (
                  <Link href={`/clientes/${ativa.cliente_id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                    Cliente 360
                  </Link>
                )}
                {podeSupervisionarAtiva && (
                  <button onClick={()=>void acaoConversa(ativa.acompanhando?'parar_acompanhar':'acompanhar')}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${ativa.acompanhando?'bg-cyan-50 text-cyan-700':'bg-white text-slate-600'}`}>
                    {ativa.acompanhando ? <EyeOff size={15}/> : <Eye size={15}/>}
                    {ativa.acompanhando ? 'Parar de acompanhar' : 'Acompanhar'}
                  </button>
                )}
                {podeReabrirAtiva && (
                  <button onClick={()=>void acaoConversa('assumir')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                    <MessageCircle size={15}/> Reativar conversa
                  </button>
                )}
                {podeAssumirAtiva && (
                  <button onClick={()=>void acaoConversa('assumir')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                    <UserRoundCheck size={15}/>
                    {ativa.responsavel_id ? 'Assumir atendimento' : 'Atender'}
                  </button>
                )}
                {ativa.status === 'em_atendimento' && ativa.responsavel_nome && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={15}/> Atendimento por {ativa.responsavel_nome}
                  </span>
                )}
                {podeDelegarGrupo && (
                  <button onClick={()=>setDelegacaoAberta(aberta=>!aberta)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${delegacaoAberta?'bg-violet-50 text-violet-800':'bg-white text-violet-700'}`}>
                    <Users size={15}/> {ativa.grupo_delegacao_ativa ? 'Responsável temporário' : 'Delegar grupo'}
                  </button>
                )}
                {atendimentoMeu && Number(ativa.nao_lidas || 0) > 0 && (
                  <button type="button" onClick={()=>void acaoConversa('marcar_lida')}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100">
                    <CheckCircle2 size={15}/> Dar baixa
                  </button>
                )}
                {ativa.responsavel_id && ativa.status !== 'finalizado' &&
                  (eu?.role === 'master' || ativa.responsavel_id === eu?.id) && (
                  <button onClick={()=>void acaoConversa('finalizar')}
                    className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold">
                    <CheckCircle2 size={15}/> Finalizar
                  </button>
                )}
                {podeTransferirAtiva && ativa.status !== 'finalizado' && (
                  <button onClick={()=>setTransferenciaAberta(aberta=>!aberta)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${transferenciaAberta?'bg-slate-100 text-slate-900':'bg-white text-slate-600'}`}>
                    <ShieldCheck size={15}/> Transferir
                  </button>
                )}
                {podeArquivarAtiva && (
                  <button type="button"
                    onClick={()=>{if(window.confirm('Remover esta conversa da caixa? O histórico continuará salvo e poderá ser encontrado novamente pela busca.'))void acaoConversa('arquivar')}}
                    className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    title="Remove da caixa, mas preserva todo o histórico">
                    <Archive size={15}/> Remover da lista
                  </button>
                )}
                {podeBloquearAtiva && (
                  <button type="button"
                    onClick={()=>{if(window.confirm('Bloquear este contato neste número do WhatsApp? O histórico ficará salvo no Atlas.'))void acaoConversa('bloquear')}}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
                    <Ban size={15}/> Bloquear
                  </button>
                )}
              </div>

              {delegacaoAberta && podeDelegarGrupo && ativa.grupo_id && (
                <div className="border-b bg-violet-50/70 px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b className="text-xs text-violet-900">Responsabilidade temporária do grupo</b>
                      <p className="text-[10px] text-violet-700">
                        Responsável principal: {ativa.grupo_responsavel_principal_nome || 'não definido'}
                        {ativa.grupo_delegacao_ativa && ativa.grupo_delegacao_fim_em
                          ? ` · temporário até ${new Date(ativa.grupo_delegacao_fim_em).toLocaleString('pt-BR')}`
                          : ''}
                      </p>
                    </div>
                    {ativa.grupo_delegacao_ativa && (
                      <button type="button" disabled={salvandoDelegacao}
                        onClick={()=>void encerrarDelegacaoGrupo()}
                        className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 disabled:opacity-40">
                        Encerrar e devolver
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(170px,1fr)_90px_minmax(180px,1.2fr)_auto]">
                    <select value={destinoDelegacaoId} onChange={e=>setDestinoDelegacaoId(e.target.value)}
                      className="rounded-lg border bg-white px-2 py-2 text-xs">
                      <option value="">Delegar para...</option>
                      {usuarios.filter(u=>u.id!==ativa.grupo_responsavel_principal_id).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    <label className="flex items-center gap-1 rounded-lg border bg-white px-2">
                      <input type="number" min={1} max={365} value={diasDelegacao}
                        onChange={e=>setDiasDelegacao(Math.max(1,Number(e.target.value)||1))}
                        className="w-12 bg-transparent py-2 text-xs outline-none"/>
                      <span className="text-[10px] text-slate-500">dias</span>
                    </label>
                    <input value={motivoDelegacao} onChange={e=>setMotivoDelegacao(e.target.value)}
                      placeholder="Motivo (férias, folga, ausência...)"
                      className="rounded-lg border bg-white px-2 py-2 text-xs"/>
                    <button type="button" disabled={!destinoDelegacaoId||salvandoDelegacao}
                      onClick={()=>void delegarResponsabilidadeGrupo()}
                      className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                      {salvandoDelegacao?'Salvando...':'Confirmar'}
                    </button>
                  </div>
                </div>
              )}

              {transferenciaAberta && podeTransferirAtiva && ativa.status !== 'finalizado' && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-b bg-slate-50 px-4 py-2">
                  <select value={destinoId} onChange={e=>setDestinoId(e.target.value)}
                    className="rounded-lg border bg-white px-2 py-1.5 text-xs">
                    <option value="">Transferir para...</option>
                    {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                  <input value={setorTransferencia} onChange={e=>setSetorTransferencia(e.target.value)}
                    placeholder="Setor (opcional)" className="rounded-lg border px-2 py-1.5 text-xs"/>
                  <button disabled={!destinoId}
                    onClick={()=>void acaoConversa('transferir',{destinoId,setor:setorTransferencia||null})}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                    Confirmar transferência
                  </button>
                </div>
              )}

              <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto bg-[#fbfcfe] p-2.5 sm:p-4">
                {mensagensVisiveis.map(m => {
                  const saida = m.direcao === 'saida'
                  const texto = m.texto === '[reactionMessage]' ? 'Reação no WhatsApp' : m.texto
                  const midia = Boolean(m.media_url)
                  const legendaGenerica =
                    (m.tipo === 'audio' && texto === '🎤 Áudio') ||
                    (m.tipo === 'imagem' && (texto === '📷 Imagem' || texto === '🖼️ Figurinha')) ||
                    (m.tipo === 'video' && texto === '🎥 Vídeo') ||
                    (m.tipo === 'documento' && texto === '📎 Documento')
                  return (
                    <div key={m.id} className={`group/msg flex min-w-0 w-full ${saida?'justify-end':'justify-start'}`}>
                      <div className={`relative min-w-0 max-w-[88%] overflow-visible rounded-xl px-3 py-2 shadow-sm sm:max-w-[82%] ${saida?'bg-[#d9fdd3]':'bg-white'}`}>
                        {podeResponder && (
                          <div className={`absolute -top-3 z-10 hidden items-center gap-1 rounded-full border bg-white p-1 shadow-md group-hover/msg:flex ${saida?'right-2':'left-2'}`}>
                            <button type="button" onClick={()=>setMensagemRespondendo(m)}
                              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                              title="Responder esta mensagem">
                              <Reply size={14}/>
                            </button>
                            <button type="button" onClick={()=>setEmojiMensagemId(atual=>atual===m.id?null:m.id)}
                              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                              title="Reagir com emoji">
                              <SmilePlus size={14}/>
                            </button>
                          </div>
                        )}
                        {emojiMensagemId===m.id && podeResponder && (
                          <div className={`absolute top-7 z-20 flex flex-wrap items-center gap-1 rounded-xl border bg-white p-2 shadow-xl ${saida?'right-0':'left-0'}`}>
                            {['👍','✅','❤️','😂','👏','🙏','🔥','👀'].map(emoji=>(
                              <button key={emoji} type="button" onClick={()=>void reagirMensagem(m.id,emoji)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-slate-100">
                                {emoji}
                              </button>
                            ))}
                            <div className="flex items-center gap-1 border-l pl-2">
                              <input value={emojiCustom} onChange={e=>setEmojiCustom(e.target.value)}
                                onKeyDown={e=>{if(e.key==='Enter'&&emojiCustom.trim()){e.preventDefault();void reagirMensagem(m.id,emojiCustom)}}}
                                placeholder="emoji" className="w-16 rounded-md border px-2 py-1 text-xs"/>
                              <button type="button" disabled={!emojiCustom.trim()} onClick={()=>void reagirMensagem(m.id,emojiCustom)}
                                className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-30">OK</button>
                            </div>
                          </div>
                        )}
                        {(() => {
                          const p = m.payload && typeof m.payload === 'object' ? m.payload : {}
                          const quotedId = p.quotedMessageId ? String(p.quotedMessageId) : ''
                          const alvo = quotedId ? mensagens.find(x=>x.id===quotedId) : null
                          const quotedText = alvo?.texto || p.quotedText
                          return quotedText ? (
                            <div className="mb-2 rounded-lg border-l-4 border-emerald-400 bg-white/60 px-2 py-1.5 text-[11px] text-slate-500">
                              <b className="block text-[10px] text-slate-600">Resposta</b>
                              <span className="block max-w-full truncate">{String(quotedText)}</span>
                            </div>
                          ) : null
                        })()}
                        {saida && m.usuario_nome && <p className="mb-1 text-[10px] font-bold text-emerald-700">{m.usuario_nome} diz</p>}

                        {m.tipo === 'audio' && midia && (
                          <audio controls preload="metadata" src={m.media_url || undefined} className="max-w-full"/>
                        )}
                        {m.tipo === 'audio' && !midia && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            🎤 Áudio indisponível — recebido antes da captura de mídia ser ativada.
                          </div>
                        )}

                        {m.tipo === 'imagem' && midia && (
                          <a href={m.media_url || '#'} target="_blank" rel="noreferrer">
                            <img src={m.media_url || undefined} alt={m.arquivo_nome || 'Imagem do WhatsApp'}
                              className="max-h-80 max-w-full rounded-lg object-contain"/>
                          </a>
                        )}
                        {m.tipo === 'imagem' && !midia && texto && (
                          <p className="text-sm text-slate-700">{texto}</p>
                        )}

                        {m.tipo === 'video' && midia && (
                          <video controls preload="metadata" src={m.media_url || undefined}
                            className="max-h-80 max-w-full rounded-lg"/>
                        )}
                        {m.tipo === 'video' && !midia && (
                          <p className="text-sm text-slate-500">🎥 Vídeo indisponível nesta mensagem antiga.</p>
                        )}

                        {m.tipo === 'documento' && midia && (
                          <a href={m.media_url || '#'} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-white">
                            <Paperclip size={16}/>
                            <span className="min-w-0 truncate">{m.arquivo_nome || texto || 'Abrir documento'}</span>
                            <ExternalLink size={13} className="ml-auto shrink-0"/>
                          </a>
                        )}
                        {m.tipo === 'documento' && !midia && (
                          <p className="text-sm text-slate-500">{texto || '📎 Documento indisponível nesta mensagem antiga.'}</p>
                        )}

                        {m.tipo === 'reacao' && (
                          <p className="text-xs italic text-slate-500">{texto || 'Reação no WhatsApp'}</p>
                        )}

                        {!['audio','imagem','video','documento','reacao'].includes(m.tipo) && texto && (
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-900">{texto}</p>
                        )}
                        {midia && texto && !legendaGenerica && ['imagem','video'].includes(m.tipo) && (
                          <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-900">{texto}</p>
                        )}
                        {!texto && !midia && <p className="text-sm text-slate-500">[{m.tipo}]</p>}
                        {!!reacoesPorMensagem.get(m.id)?.length && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {reacoesPorMensagem.get(m.id)!.map((r,i)=>(
                              <span key={`${r.emoji}-${i}`} title={r.usuario}
                                className="rounded-full border bg-white/80 px-1.5 py-0.5 text-xs shadow-sm">{r.emoji}</span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-right text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={fimRef}/>
              </div>

              <div className="border-t bg-white p-3">
                {apoioAberto === 'etiquetas' && (
                  <div className="mb-2 rounded-xl border bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <b className="text-xs text-slate-700">Etiquetas da conversa</b>
                      <button onClick={()=>setApoioAberto(null)} className="text-[10px] font-semibold text-slate-400 hover:text-slate-700">Fechar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {etiquetas.map(e => {
                        const ativaTag = etiquetasAtivas.includes(e.id)
                        return (
                          <button key={e.id}
                            onClick={()=>void acaoApoio('etiqueta_alternar',{etiquetaId:e.id})}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ativaTag?'bg-emerald-50 text-emerald-700':'bg-white text-slate-600'}`}>
                            {ativaTag ? '✓ ' : ''}{e.nome}
                          </button>
                        )
                      })}
                      {!etiquetas.length && <span className="text-xs text-slate-400">Nenhuma etiqueta cadastrada.</span>}
                    </div>
                    {eu?.role === 'master' && (
                      <div className="mt-3 flex gap-2 border-t pt-3">
                        <input value={novaEtiqueta} onChange={e=>setNovaEtiqueta(e.target.value)}
                          placeholder="Nova etiqueta" className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs"/>
                        <button disabled={!novaEtiqueta.trim()}
                          onClick={async()=>{
                            const ok=await acaoApoio('etiqueta_criar',{nome:novaEtiqueta.trim()})
                            if(ok)setNovaEtiqueta('')
                          }}
                          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                          <Plus size={14}/>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {ativa.status === 'finalizado' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Atendimento encerrado</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">O histórico acima continua salvo. Reative para abrir um novo ciclo de atendimento sem perder nenhuma mensagem anterior.</p>
                    </div>
                    {podeReabrirAtiva ? (
                      <button type="button" onClick={()=>void acaoConversa('assumir')}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                        <MessageCircle size={15}/> Reativar conversa
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">Você possui acesso ao histórico, mas não permissão para atender neste número.</span>
                    )}
                  </div>
                ) : (!ativa.responsavel_id || (ativa.responsavel_id === eu?.id && ativa.status === 'aguardando')) ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                      <Clock3 size={16}/> {ativa.responsavel_id === eu?.id ? 'Atendimento transferido para você. Aceite para começar.' : 'Esta conversa está aguardando atendimento.'}
                    </div>
                    <button type="button" onClick={()=>void acaoConversa('assumir')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                      <UserRoundCheck size={15}/> {ativa.responsavel_id === eu?.id ? 'Aceitar atendimento' : 'Atender agora'}
                    </button>
                  </div>
                ) : ativa.responsavel_id && ativa.responsavel_id !== eu?.id && ativa.status !== 'finalizado' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3">
                    <div className="text-xs text-slate-600">
                      Atendimento de <b>{ativa.responsavel_nome || 'outro atendente'}</b>.
                    </div>
                    {eu?.role === 'master' ? (
                      <button type="button" onClick={()=>void acaoConversa('assumir')}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                        <UserRoundCheck size={15}/> Assumir atendimento
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">Você pode acompanhar em tempo real.</span>
                    )}
                  </div>
                ) : !podeResponder ? (
                  <div className="rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-600">
                    Você não possui permissão para responder por este canal.
                  </div>
                ) : (
                  <div>
                    {sugestaoIA && (
                      <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={16}/></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-xs text-violet-900">Sugestão da IA</b>
                              {sugestaoIA.setor && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-violet-700">{sugestaoIA.setor}</span>}
                              {typeof sugestaoIA.confianca === 'number' && <span className="text-[10px] text-violet-500">{Math.round(sugestaoIA.confianca*100)}% confiança</span>}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{sugestaoIA.texto}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button onClick={()=>void acaoSugestaoIA('usar')} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white">Usar e editar</button>
                              <button onClick={()=>void acaoSugestaoIA('rejeitar')} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"><X size={13}/>Descartar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {!sugestaoIA && modoIA === 'observando' && eu?.role === 'master' && (
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-blue-600"><Sparkles size={12}/>IA observando e aprendendo · sem responder</div>
                    )}
                    <div className="mb-2 flex items-center gap-1 text-slate-500">
                      <input ref={arquivoInputRef} type="file" className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,audio/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                        onChange={e=>{
                          const file=e.target.files?.[0]
                          if(file) void enviarArquivo(file)
                        }}/>
                      <button disabled={enviandoMidia||!canalPronto}
                        onClick={()=>arquivoInputRef.current?.click()}
                        className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40" title="Enviar foto, vídeo, áudio ou documento">
                        <Paperclip size={18}/>
                      </button>
                      <button onClick={()=>setApoioAberto(apoioAberto==='etiquetas'?null:'etiquetas')}
                        className={`rounded-lg p-2 hover:bg-slate-100 ${apoioAberto==='etiquetas'?'bg-slate-100 text-emerald-700':''}`}
                        title="Etiquetas">
                        <Tag size={18}/>
                      </button>
                      <button onClick={()=>setApoioAberto(apoioAberto==='rapidas'?null:'rapidas')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold hover:bg-slate-100 ${apoioAberto==='rapidas'?'bg-slate-100 text-blue-700':''}`}
                        title="Mensagens rápidas">
                        <Zap size={17}/> Rápidas
                      </button>
                      <span className="ml-auto text-[10px] text-slate-400">Enter envia · Shift+Enter quebra linha</span>
                    </div>

                    {apoioAberto === 'rapidas' && (
                      <div className="mb-2 max-h-64 overflow-y-auto rounded-xl border bg-white p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <b className="text-xs text-slate-700">Mensagens rápidas</b>
                          <span className="text-[10px] text-slate-400">{mensagensRapidas.length} cadastradas</span>
                        </div>
                        <div className="space-y-1">
                          {mensagensRapidas.map(r=>(
                            <button key={r.id} onClick={()=>{setTexto(r.mensagem);setApoioAberto(null)}}
                              className="w-full rounded-lg border px-3 py-2 text-left hover:bg-slate-50">
                              <div className="flex items-center gap-2">
                                <b className="text-xs text-slate-800">{r.titulo}</b>
                                {r.atalho && <span className="text-[10px] text-blue-600">{r.atalho}</span>}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{r.mensagem}</p>
                            </button>
                          ))}
                          {!mensagensRapidas.length && <p className="py-3 text-center text-xs text-slate-400">Nenhuma mensagem rápida cadastrada.</p>}
                        </div>
                        {eu?.role === 'master' && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            <input value={novaRapidaTitulo} onChange={e=>setNovaRapidaTitulo(e.target.value)}
                              placeholder="Título da resposta" className="w-full rounded-lg border px-2 py-1.5 text-xs"/>
                            <textarea value={novaRapidaTexto} onChange={e=>setNovaRapidaTexto(e.target.value)}
                              placeholder="Mensagem pronta" rows={2} className="w-full resize-none rounded-lg border px-2 py-1.5 text-xs"/>
                            <button disabled={!novaRapidaTitulo.trim()||!novaRapidaTexto.trim()}
                              onClick={async()=>{
                                const ok=await acaoApoio('rapida_criar',{titulo:novaRapidaTitulo.trim(),mensagem:novaRapidaTexto.trim()})
                                if(ok){setNovaRapidaTitulo('');setNovaRapidaTexto('')}
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                              <Plus size={14}/> Criar resposta
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {mensagemRespondendo && (
                      <div className="mb-2 flex items-center gap-3 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2">
                        <Reply size={15} className="shrink-0 text-emerald-700"/>
                        <div className="min-w-0 flex-1">
                          <b className="block text-[10px] uppercase tracking-wide text-emerald-700">Respondendo</b>
                          <p className="truncate text-xs text-slate-600">{mensagemRespondendo.texto || `[${mensagemRespondendo.tipo}]`}</p>
                        </div>
                        <button type="button" onClick={()=>setMensagemRespondendo(null)}
                          className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-white">
                          <X size={14}/>
                        </button>
                      </div>
                    )}
                    {gravando && (
                      <div className="mb-2 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        <span>● Gravando áudio · {Math.floor(segundosGravacao/60)}:{String(segundosGravacao%60).padStart(2,'0')}</span>
                        <span>Clique no microfone para enviar</span>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea value={texto} onChange={e=>setTexto(e.target.value)}
                        onKeyDown={e=>{
                          if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void enviar()}
                        }}
                        rows={2} placeholder={canalPronto?'Digite uma mensagem':'Conecte o WhatsApp pelo QR Code'}
                        className="min-h-[58px] max-h-32 flex-1 resize-y rounded-2xl border px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-emerald-200"/>
                      <button disabled={enviandoMidia||!canalPronto}
                        onClick={()=>void alternarAudio()}
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border disabled:opacity-40 ${gravando?'bg-red-600 text-white':'bg-white text-slate-500 hover:bg-slate-50'}`}
                        title={gravando?'Parar e enviar áudio':'Gravar áudio'}>
                        <Mic size={18}/>
                      </button>
                      <button disabled={!texto.trim()||enviando||enviandoMidia||gravando||!canalPronto}
                        onClick={()=>void enviar()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40">
                        <Send size={18}/>
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  O Atlas preserva o historico de mensagens e eventos mesmo apos finalizar o atendimento.
                </p>
              </div>
            </>}
          </section>

          <aside className="hidden min-h-0 min-w-0 flex-col border-l border-slate-200 bg-white xl:flex">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="shrink-0 text-blue-600"/>
                    <b className="truncate text-sm text-slate-900">Conversas internas</b>
                    {totalInternasNaoLidas > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {totalInternasNaoLidas > 99 ? '99+' : totalInternasNaoLidas}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">Equipe Atlas · atualiza em tempo real</p>
                </div>
                <button type="button" onClick={abrirConversaInterna}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  title="Nova conversa interna">
                  <Plus size={16}/>
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <Search size={15} className="text-slate-400"/>
                <input value={buscaInterna} onChange={e=>setBuscaInterna(e.target.value)}
                  placeholder="Buscar conversa interna..."
                  className="w-full bg-transparent py-2.5 text-xs outline-none"/>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {internasFiltradas.length === 0 ? (
                <div className="grid min-h-[260px] place-items-center px-5 text-center">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-500">
                      <Users size={20}/>
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      {buscaInterna.trim() ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa interna ainda'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      Use o botão + para conversar com alguém da equipe.
                    </p>
                  </div>
                </div>
              ) : internasFiltradas.map(c=>{
                const naoLidas=Number(c.nao_lidas||0)
                const selecionada=conversaInternaAtiva?.id===c.id
                return (
                  <button key={c.id} type="button" onClick={()=>selecionarConversaInterna(c)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50/60 ${selecionada?'bg-blue-50':''}`}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${selecionada?'bg-blue-600 text-white':'bg-blue-100 text-blue-700'}`}>
                      {c.tipo==='grupo'?<Users size={17}/>:String(c.nome||'?').slice(0,1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <b className={`truncate text-sm ${naoLidas>0?'font-extrabold text-slate-950':'font-semibold text-slate-800'}`}>
                          {c.nome || 'Conversa interna'}
                        </b>
                        <span className={`ml-auto shrink-0 text-[10px] ${naoLidas>0?'font-bold text-blue-600':'text-slate-400'}`}>
                          {hora(c.ultima_mensagem_em)}
                        </span>
                      </span>
                      <span className={`mt-0.5 flex items-center gap-2 text-xs ${naoLidas>0?'font-semibold text-slate-700':'text-slate-500'}`}>
                        <span className="min-w-0 flex-1 truncate">
                          {c.ultima_mensagem || (c.tipo==='grupo'?'Grupo interno':'Conversa privada')}
                        </span>
                        {naoLidas>0 && (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {naoLidas>99?'99+':naoLidas}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500"/>
                Mensagens internas ficam somente no Atlas
              </div>
            </div>
          </aside>
        </div>
      </div>

        {conversaInternaAberta && (
          <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={e=>{if(e.currentTarget===e.target)setConversaInternaAberta(false)}}>
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Nova conversa interna</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Escolha quem da empresa participa da conversa.</p>
                </div>
                <button type="button" onClick={()=>setConversaInternaAberta(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar"><X size={17}/></button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3">
                  <Search size={16} className="text-slate-400"/>
                  <input autoFocus value={buscaUsuarioInterno}
                    onChange={e=>setBuscaUsuarioInterno(e.target.value)}
                    placeholder="Buscar Keila, Júlio, Gabi..."
                    className="w-full bg-transparent py-2.5 text-sm outline-none"/>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border">
                  {usuarios
                    .filter(u=>u.id!==eu?.id)
                    .filter(u=>!buscaUsuarioInterno.trim()||u.nome.toLocaleLowerCase('pt-BR').includes(buscaUsuarioInterno.toLocaleLowerCase('pt-BR').trim()))
                    .map(u=>{
                      const selecionado=usuariosInternosSelecionados.includes(u.id)
                      return (
                        <button type="button" key={u.id}
                          onClick={()=>setUsuariosInternosSelecionados(lista=>selecionado?lista.filter(id=>id!==u.id):[...lista,u.id])}
                          className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 ${selecionado?'bg-blue-50':'hover:bg-slate-50'}`}>
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${selecionado?'bg-blue-600 text-white':'bg-slate-100 text-slate-700'}`}>
                            {u.nome.slice(0,1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm text-slate-900">{u.nome}</b>
                            <span className="block text-[11px] text-slate-400">{u.cargo || 'Usuário da empresa'}</span>
                          </span>
                          <span className={`grid h-5 w-5 place-items-center rounded border text-[10px] ${selecionado?'border-blue-600 bg-blue-600 text-white':'border-slate-300'}`}>
                            {selecionado?'✓':''}
                          </span>
                        </button>
                      )
                    })}
                </div>

                {usuariosInternosSelecionados.length>1 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Nome do grupo interno</span>
                    <input value={nomeGrupoInterno} onChange={e=>setNomeGrupoInterno(e.target.value)}
                      placeholder="Ex.: Comercial e Produção"
                      className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100"/>
                  </label>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {usuariosInternosSelecionados.length===0
                      ? 'Selecione uma pessoa ou várias.'
                      : usuariosInternosSelecionados.length===1
                        ? 'Conversa privada interna.'
                        : `${usuariosInternosSelecionados.length} pessoas · grupo interno`}
                  </p>
                  <button type="button" disabled={!usuariosInternosSelecionados.length}
                    onClick={iniciarConversaInternaSelecionada}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                    Iniciar conversa
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {diretorioAberto && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={e=>{if(e.currentTarget===e.target)setDiretorioAberto(false)}}>
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Nova conversa no WhatsApp</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Digite o DDD e o número ou escolha um contato já sincronizado.</p>
                </div>
                <button onClick={()=>setDiretorioAberto(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar">×</button>
              </div>

              <div className="space-y-4 p-5">
                {canais.length > 1 && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Número da empresa</label>
                    <select value={canalDiretorio} onChange={e=>setCanalDiretorio(e.target.value)}
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm">
                      {canais.map(c=><option key={c.id} value={c.id}>{c.nome} · {telefoneFormatado(c.numero_conectado || c.numero_declarado || '')}</option>)}
                    </select>
                  </div>
                )}

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="mb-3">
                    <b className="text-sm text-slate-900">Conversar com um número novo</b>
                    <p className="text-xs text-slate-500">Não precisa cadastrar o cliente antes. A conversa abre direto no Atlas.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)_auto]">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">DDD</span>
                      <input value={novoDDD}
                        onChange={e=>setNovoDDD(e.target.value.replace(/\D/g,'').slice(0,2))}
                        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void iniciarPorNumero()}}}
                        inputMode="numeric" autoFocus placeholder="17"
                        className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Número do WhatsApp</span>
                      <input value={novoTelefone}
                        onChange={e=>setNovoTelefone(e.target.value.replace(/\D/g,'').slice(0,9))}
                        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void iniciarPorNumero()}}}
                        inputMode="numeric" placeholder="99176-4080"
                        className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
                    </label>
                    <button onClick={()=>void iniciarPorNumero()}
                      disabled={iniciandoNumero || novoDDD.replace(/\D/g,'').length !== 2 || ![8,9].includes(novoTelefone.replace(/\D/g,'').length)}
                      className="self-end rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                      {iniciandoNumero ? 'Abrindo...' : 'Conversar'}
                    </button>
                  </div>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">Nome (opcional)</span>
                    <input value={novoNome} onChange={e=>setNovoNome(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void iniciarPorNumero()}}}
                      placeholder="Ex.: João da Silva"
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
                  </label>
                  <p className="mt-2 text-[11px] text-slate-500">Digite o DDD e o telefone em campos separados. O Atlas acrescenta +55 automaticamente.</p>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <b className="text-xs uppercase tracking-wide text-slate-500">Contatos e grupos sincronizados</b>
                    {carregandoDiretorio && <span className="text-[10px] text-slate-400">Buscando...</span>}
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3">
                    <Search size={16} className="text-slate-400"/>
                    <input value={buscaDiretorio} onChange={e=>setBuscaDiretorio(e.target.value)}
                      placeholder="Buscar por nome ou telefone..."
                      className="w-full bg-transparent py-2.5 text-sm outline-none"/>
                  </div>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border">
                    {!carregandoDiretorio && diretorio.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-400">
                        {buscaDiretorio.trim() ? 'Nenhum contato encontrado.' : 'Digite acima para localizar um contato salvo.'}
                      </div>
                    ) : diretorio.slice(0,80).map(item=>(
                      <button key={item.id} onClick={()=>void iniciarDoDiretorio(item)}
                        className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                          {item.tipo==='grupo'?<Users size={16}/>:item.nome.slice(0,1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm text-slate-800">{item.nome}</b>
                          <span className="block truncate text-[11px] text-slate-400">
                            {item.tipo==='grupo' ? `Grupo · ${item.participantes || 0} participantes` : (item.telefone ? telefoneFormatado(item.telefone) : 'Contato do WhatsApp')}
                          </span>
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">Abrir</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

    </main>
  )
}
