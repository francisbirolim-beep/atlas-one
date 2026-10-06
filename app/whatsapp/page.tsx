'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Clock3,
  ExternalLink, Eye, EyeOff, Info, MapPin, MessageCircle, Mic, Paperclip, Search,
  Send, Settings, ShieldCheck, Smartphone, StickyNote, Tag, UserPlus, Users,
  UserRoundCheck, Plus, Zap, ChevronLeft, ChevronRight, Sparkles, X, History,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual } from '@/lib/auth'

type Usuario = { id: string; nome: string; role?: string }
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
  const [sugestaoIA, setSugestaoIA] = useState<SugestaoIA | null>(null)
  const [modoIA, setModoIA] = useState<'observando' | 'sugerindo' | 'automatico'>('observando')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'aguardando' | 'com_atendente' | 'nao_lidas' | 'minhas' | 'acompanhando' | 'transferidas' | 'finalizadas' | 'grupos'>('todas')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [canaisConectados, setCanaisConectados] = useState(0)
  const [canaisTotal, setCanaisTotal] = useState(0)
  const [destinoId, setDestinoId] = useState('')
  const [setorTransferencia, setSetorTransferencia] = useState('')
  const [transferenciaAberta, setTransferenciaAberta] = useState(false)
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

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('atlas-whatsapp-painel-direito-recolhido')
      setPainelDireitoRecolhido(salvo === null ? false : salvo === '1')
    } catch {}
  }, [])

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
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/conversas', { headers })
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
      if (selecionar && !ativa) {
        const conversaId = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('conversaId')
          : null
        const solicitada = conversaId
          ? conversasRecebidas.find((c: Conversa) => c.id === conversaId)
          : null
        if (solicitada) setAtiva(solicitada)
      }
      if (ativa) {
        const atualizada = conversasRecebidas.find((c: Conversa) => c.id === ativa.id)
        setAtiva(atualizada || null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar atendimento.')
    } finally {
      setCarregando(false)
    }
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
      const resp = await fetch(`/api/integracoes/whatsapp/contatos?${params.toString()}`, { headers })
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
      setAtiva(json.conversa as Conversa)
      await carregarConversas(false)
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
        { headers },
      )
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao carregar mensagens.')
      setMensagens(json.mensagens || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar mensagens.')
    }
  }

  async function carregarSugestaoIA(conversaId: string) {
    try {
      const headers = await headersJson()
      const resp = await fetch(`/api/integracoes/whatsapp/ia?conversaId=${encodeURIComponent(conversaId)}`, { headers, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) return
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
      setEtiquetas(json.etiquetas || [])
      setEtiquetasAtivas(json.etiquetasAtivas || [])
      setNotas(json.notas || [])
      setMensagensRapidas(json.mensagensRapidas || [])
      setHistorico(json.historico || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar recursos internos.')
    }
  }

  useEffect(() => { void carregarConversas() }, [])

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
          const ids = canalFiltro === 'todos'
            ? canais.map(c => c.id)
            : canais.filter(c => c.id === canalFiltro).map(c => c.id)
          const respostas = await Promise.all(ids.map(async canalId => {
            const params = new URLSearchParams({ canalId, busca: q })
            const resp = await fetch(`/api/integracoes/whatsapp/contatos?${params.toString()}`, { headers })
            const json = await resp.json()
            if (!resp.ok) return [] as DiretorioWhatsApp[]
            return ((json.itens || []) as DiretorioWhatsApp[]).map(item => ({ ...item, canalId }))
          }))
          if (ativo) {
            const unicos = new Map<string, DiretorioWhatsApp>()
            for (const item of respostas.flat()) {
              const chave = `${item.canalId || ''}:${item.jid}`
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
    if (!ativa?.id) {
      setMensagens([])
      setEtiquetas([])
      setEtiquetasAtivas([])
      setNotas([])
      setMensagensRapidas([])
      setHistorico([])
      return
    }
    const conversaId = ativa.id
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
    void carregarSugestaoIA(conversaId)
    const timer = setInterval(() => { void carregarSugestaoIA(conversaId) }, 4000)
    return () => clearInterval(timer)
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
        void carregarConversas(false)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atendimento_mensagens' }, p => {
        const mensagem = p.new as Mensagem
        if (mensagem.conversa_id === ativa?.id) void carregarMensagens(ativa.id)
        void carregarConversas(false)
      })
      .subscribe()
    return () => { void supabase.removeChannel(canal) }
  }, [eu?.id, ativa?.id])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.length])

  const filtradas = useMemo(() => {
    const q = busca.toLocaleLowerCase('pt-BR').trim()
    return conversas.filter(c => {
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
    const headers = await headersJson()
    const resp = await fetch('/api/integracoes/whatsapp/conversas', {
      method: 'POST', headers,
      body: JSON.stringify({ acao, conversaId, ...extra }),
    })
    const json = await resp.json()
    if (!resp.ok) {
      setErro(json.error || 'Nao foi possivel alterar o atendimento.')
      return false
    }
    setDestinoId('')
    setSetorTransferencia('')
    setTransferenciaAberta(false)
    await carregarConversas(false)
    if (ativa?.id === conversaId) await carregarApoio(conversaId)
    return true
  }

  async function acaoConversa(acao: string, extra: Record<string, unknown> = {}) {
    if (!ativa) return
    await acaoConversaPorId(ativa.id, acao, extra)
  }

  function podeTransferirConversa(conversa: Conversa) {
    if (eu?.role === 'master') return true
    const acesso = conversa.whatsapp_canal_id
      ? acessos.find(a => a.canal_id === conversa.whatsapp_canal_id)
      : null
    return Boolean(acesso?.transferir)
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
      await carregarConversas(false)
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
        body: JSON.stringify({ conversaId: ativa.id, texto: corpo }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Nao foi possivel enviar.')
      await carregarMensagens(ativa.id)
      await carregarConversas(false)
    } catch (e) {
      setTexto(corpo)
      setErro(e instanceof Error ? e.message : 'Nao foi possivel enviar.')
    } finally {
      setEnviando(false)
    }
  }

  const totais = useMemo(() => {
    const doCanal = conversas.filter(c =>
      canalFiltro === 'todos' || c.whatsapp_canal_id === canalFiltro
    )
    const chats = doCanal.filter(c => Boolean(c.ultima_mensagem_em))
    return {
      todas: chats.length,
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
  }, [conversas, eu?.id, canalFiltro])

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
  const canalAtivo = ativa?.whatsapp_canal_id
    ? canais.find(c=>c.id===ativa.whatsapp_canal_id) || null
    : null
  const canalSelecionado = canalFiltro !== 'todos'
    ? canais.find(c => c.id === canalFiltro) || null
    : null
  const canalPronto = canalAtivo?.gateway_status === 'connected'
  const podeTransferirAtiva = Boolean(
    ativa && (eu?.role === 'master' || acessoCanalAtivo?.transferir),
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
        <header className="flex h-16 items-center justify-between border-b bg-white px-4">
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

        <div className={`grid h-[calc(100dvh-64px)] min-h-0 w-full max-w-full grid-cols-[minmax(0,1fr)] overflow-hidden md:grid-cols-[340px_minmax(0,1fr)] ${painelDireitoRecolhido ? 'xl:grid-cols-[390px_minmax(0,1fr)_48px]' : 'xl:grid-cols-[390px_minmax(0,1fr)_300px]'}`}>
          <aside className={`${ativa ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden border-r`}>
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
                  <p className="text-sm font-bold text-slate-900">Conversas</p>
                  <p className="text-[11px] text-slate-500">Conversas recentes em tempo real</p>
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
                <span className="text-xs font-extrabold text-slate-800">Abertas <span className="text-slate-500">{totais.abertas}</span></span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600"><Tag size={12}/>Filtros</span>
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
              ) : filtradas.length === 0 && contatosBuscaVisiveis.length === 0 && !buscandoContatos ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  {busca.trim().length >= 2 ? 'Nenhum contato ou conversa encontrado.' : 'Nenhuma conversa neste filtro.'}
                </div>
              ) : filtradas.map(c => (
                <div key={c.id} role="button" tabIndex={0}
                  onClick={()=>setAtiva(c)}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setAtiva(c)}}}
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
                      {c.whatsapp_chat_tipo === 'grupo' ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">Grupo</span>
                      ) : c.status === 'finalizado' ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Finalizado</span>
                      ) : c.responsavel_id ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                          {c.responsavel_id===eu?.id ? 'Meu atendimento' : (c.responsavel_nome || 'Com atendente')}
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
                        <button type="button" onClick={async e=>{e.stopPropagation();await acaoConversaPorId(c.id,c.acompanhando?'parar_acompanhar':'acompanhar')}}
                          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${c.acompanhando?'border-amber-300 bg-amber-50 text-amber-800':'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}>
                          {c.acompanhando?'Acompanhando':'Acompanhar'}
                        </button>
                        {podeTransferirConversa(c) && (
                          <button type="button" onClick={e=>{e.stopPropagation();setAtiva(c);setTransferenciaAberta(true)}}
                            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50">
                            Transferir
                          </button>
                        )}
                        <button type="button" onClick={e=>{e.stopPropagation();setAtiva(c);setApoioAberto('etiquetas')}}
                          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">
                          Etiquetas
                        </button>
                        {(!c.responsavel_id || (c.responsavel_id === eu?.id && c.status === 'aguardando')) && (
                          <button type="button" onClick={async e=>{e.stopPropagation();setAtiva(c);await acaoConversaPorId(c.id,'assumir')}}
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
                  </div>
                </div>
              ))}
              {busca.trim().length >= 2 && (buscandoContatos || contatosBuscaVisiveis.length > 0) && (
                <div className="border-t border-slate-200">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Contatos do WhatsApp</span>
                    {buscandoContatos && <span className="text-[10px] text-slate-400">Buscando...</span>}
                  </div>
                  {contatosBuscaVisiveis.map(item => (
                    <button
                      key={`${item.canalId || ''}:${item.jid}`}
                      onClick={() => void iniciarDoDiretorio(item)}
                      className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-left hover:bg-emerald-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                        {item.tipo === 'grupo' ? <Users size={16}/> : item.nome.slice(0,1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.nome}</p>
                        <p className="truncate text-[11px] text-slate-400">
                          {item.tipo === 'grupo'
                            ? `Grupo · ${item.participantes || 0} participantes`
                            : (item.telefone ? telefoneFormatado(item.telefone) : 'Contato salvo no WhatsApp')}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700">Abrir</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className={`${ativa ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-white`}>
            {!ativa ? (
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
                      ? 'Grupo WhatsApp · canal compartilhado'
                      : `${telefoneFormatado(ativa.telefone)} · ${ativa.responsavel_nome || 'Em espera'}`}
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
                <button onClick={()=>void acaoConversa(ativa.acompanhando?'parar_acompanhar':'acompanhar')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${ativa.acompanhando?'bg-cyan-50 text-cyan-700':'bg-white text-slate-600'}`}>
                  {ativa.acompanhando ? <EyeOff size={15}/> : <Eye size={15}/>}
                  {ativa.acompanhando ? 'Parar de acompanhar' : 'Acompanhar'}
                </button>
                {podeAssumirAtiva && (
                  <button onClick={()=>void acaoConversa('assumir')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                    <UserRoundCheck size={15}/>
                    {ativa.responsavel_id ? 'Assumir atendimento' : 'Atender'}
                  </button>
                )}
                {atendimentoMeu && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={15}/> Em atendimento por você
                  </span>
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
              </div>

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
                {mensagens.map(m => {
                  const saida = m.direcao === 'saida'
                  const texto = m.texto === '[reactionMessage]' ? 'Reação no WhatsApp' : m.texto
                  const midia = Boolean(m.media_url)
                  const legendaGenerica =
                    (m.tipo === 'audio' && texto === '🎤 Áudio') ||
                    (m.tipo === 'imagem' && (texto === '📷 Imagem' || texto === '🖼️ Figurinha')) ||
                    (m.tipo === 'video' && texto === '🎥 Vídeo') ||
                    (m.tipo === 'documento' && texto === '📎 Documento')
                  return (
                    <div key={m.id} className={`flex min-w-0 w-full ${saida?'justify-end':'justify-start'}`}>
                      <div className={`min-w-0 max-w-[88%] overflow-hidden rounded-xl px-3 py-2 shadow-sm sm:max-w-[82%] ${saida?'bg-[#d9fdd3]':'bg-white'}`}>
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
                        <p className="mt-1 text-right text-[10px] text-slate-400">{hora(m.created_at)}</p>
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
                {(!ativa.responsavel_id || (ativa.responsavel_id === eu?.id && ativa.status === 'aguardando')) && ativa.status !== 'finalizado' ? (
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

          <aside className={`hidden min-h-0 border-l bg-white xl:flex ${painelDireitoRecolhido ? 'flex-col items-center' : 'flex-col'}`}>
            {painelDireitoRecolhido ? (
              <div className="flex h-full w-full flex-col items-center gap-2 py-3">
                <button
                  onClick={()=>alternarPainelDireitoRecolhido(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg border text-slate-600 hover:bg-slate-50"
                  title="Abrir painel lateral">
                  <ChevronLeft size={18}/>
                </button>
                <div className="my-1 h-px w-7 bg-slate-200"/>
                <button onClick={()=>{setPainelDireito('cliente');alternarPainelDireitoRecolhido(false)}}
                  className="grid h-9 w-9 place-items-center rounded-lg text-blue-700 hover:bg-blue-50" title="Cadastro 360">
                  <UserPlus size={17}/>
                </button>
                <button onClick={()=>{setPainelDireito('agenda');alternarPainelDireitoRecolhido(false)}}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50" title="Agenda">
                  <CalendarDays size={17}/>
                </button>
                <button onClick={()=>{setPainelDireito('notas');alternarPainelDireitoRecolhido(false)}}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50" title="Notas">
                  <StickyNote size={17}/>
                </button>
                <button onClick={()=>{setPainelDireito('historico');alternarPainelDireitoRecolhido(false)}}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50" title="Histórico">
                  <History size={17}/>
                </button>
              </div>
            ) : <>
            <div className="border-b p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 font-bold text-blue-700">
                  {ativa ? (ativa.contato_nome || ativa.telefone).slice(0,1).toUpperCase() : '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{ativa?.contato_nome || 'Contexto do atendimento'}</b>
                  <p className="truncate text-xs text-slate-500">
                    {ativa ? telefoneFormatado(ativa.telefone) : 'Selecione uma conversa'}
                  </p>
                </div>
                <button
                  onClick={()=>alternarPainelDireitoRecolhido(true)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-slate-500 hover:bg-slate-50"
                  title="Recolher painel e ampliar conversa">
                  <ChevronRight size={17}/>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 border-b bg-slate-50 p-2 text-[11px] font-bold">
              <button onClick={()=>setPainelDireito('cliente')}
                className={`rounded-lg px-1.5 py-2 ${painelDireito==='cliente'?'bg-white text-blue-700 shadow-sm':'text-slate-500'}`}>
                Cliente
              </button>
              <button onClick={()=>setPainelDireito('agenda')}
                className={`rounded-lg px-1.5 py-2 ${painelDireito==='agenda'?'bg-white text-blue-700 shadow-sm':'text-slate-500'}`}>
                Agenda
              </button>
              <button onClick={()=>setPainelDireito('notas')}
                className={`rounded-lg px-1.5 py-2 ${painelDireito==='notas'?'bg-white text-blue-700 shadow-sm':'text-slate-500'}`}>
                Notas
              </button>
              <button onClick={()=>setPainelDireito('historico')}
                className={`rounded-lg px-1.5 py-2 ${painelDireito==='historico'?'bg-white text-blue-700 shadow-sm':'text-slate-500'}`}>
                Histórico
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!ativa ? (
                <div className="py-12 text-center text-sm text-slate-400">Selecione uma conversa.</div>
              ) : painelDireito === 'cliente' ? (
                carregandoCliente ? (
                  <div className="py-10 text-center text-sm text-slate-400">Carregando Cliente 360...</div>
                ) : cliente ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Building2 size={17} className="text-blue-600"/>
                        <b className="text-sm text-slate-900">{cliente.nome}</b>
                      </div>
                      <div className="space-y-2 text-xs text-slate-600">
                        {(cliente.whatsapp || cliente.telefone) && (
                          <p><b>Contato:</b> {cliente.whatsapp || cliente.telefone}</p>
                        )}
                        {(cliente.cidade || cliente.bairro) && (
                          <p className="flex items-start gap-1.5">
                            <MapPin size={14} className="mt-0.5 shrink-0"/>
                            {[cliente.bairro,cliente.cidade].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {cliente.endereco && <p>{cliente.endereco}</p>}
                      </div>
                      <Link href={'/clientes/' + cliente.id}
                        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                        Abrir Cliente 360 <ExternalLink size={13}/>
                      </Link>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <BriefcaseBusiness size={16} className="text-slate-500"/>
                        <b className="text-xs uppercase tracking-wide text-slate-600">Obras recentes</b>
                      </div>
                      {obras.length ? (
                        <div className="space-y-2">
                          {obras.map(o=>(
                            <Link key={o.id} href={'/obras/' + o.id}
                              className="block rounded-xl border p-3 hover:bg-slate-50">
                              <p className="truncate text-sm font-semibold text-slate-800">{o.nome || 'Obra'}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{o.status || 'Em andamento'}</p>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                          Nenhuma obra encontrada para este cliente.
                        </p>
                      )}
                    </div>

                    {cliente.observacoes && (
                      <div className="rounded-xl border-l-4 border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <b>Observações do cliente</b>
                        <p className="mt-1 whitespace-pre-wrap">{cliente.observacoes}</p>
                      </div>
                    )}
                  </div>
                ) : ativa.whatsapp_chat_tipo === 'grupo' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-violet-50 p-5">
                      <div className="mb-3 flex items-center gap-2 text-violet-700">
                        <Users size={20}/>
                        <b className="text-sm">Grupo do WhatsApp</b>
                      </div>
                      <p className="font-semibold text-slate-900">{ativa.grupo_nome || ativa.contato_nome || 'Grupo'}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        Este grupo pertence ao número selecionado e não é um Cliente 360. Mensagens e anexos ficam no histórico do grupo.
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                      <Info size={15} className="mb-1"/>
                      Grupos configurados para Orçamento podem criar automaticamente rascunho, tarefa e card no Kanban.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dashed p-4">
                      <div className="text-center">
                        <UserPlus className="mx-auto mb-2 text-slate-400" size={26}/>
                        <b className="text-sm text-slate-800">Como deseja cadastrar este contato?</b>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Nome e WhatsApp seguem preenchidos para o cadastro escolhido.
                        </p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Link href={urlCadastroCliente}
                          className="flex items-center gap-3 rounded-xl border bg-emerald-50/70 p-3 hover:border-emerald-300">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><UserPlus size={17}/></span>
                          <span><b className="block text-xs text-slate-800">Cliente</b><span className="text-[11px] text-slate-500">Cria Cliente 360 e vincula esta conversa.</span></span>
                        </Link>
                        <Link href={urlCadastroColaborador} target="_blank"
                          className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><Users size={17}/></span>
                          <span><b className="block text-xs text-slate-800">Colaborador</b><span className="text-[11px] text-slate-500">Abre o cadastro da equipe.</span></span>
                        </Link>
                        <Link href={urlCadastroFornecedor} target="_blank"
                          className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><BriefcaseBusiness size={17}/></span>
                          <span><b className="block text-xs text-slate-800">Fornecedor</b><span className="text-[11px] text-slate-500">Abre o cadastro comercial.</span></span>
                        </Link>
                        <Link href="/cadastros" target="_blank"
                          className="flex items-center justify-center rounded-xl border border-dashed px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
                          Outros cadastros
                        </Link>
                      </div>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                      <Info size={15} className="mb-1"/>
                      Se cadastrar como cliente, o histórico deste atendimento fica vinculado ao Cliente 360.
                    </div>
                  </div>
                )
              ) : painelDireito === 'agenda' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={17} className="text-blue-600"/>
                    <b className="text-sm text-slate-800">Agenda do atendimento</b>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                    <div className="rounded-xl bg-slate-50 p-2">Hoje</div>
                    <div className="rounded-xl bg-slate-50 p-2">Amanhã</div>
                    <div className="rounded-xl bg-slate-50 p-2">Futuros</div>
                  </div>
                  <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-slate-500">
                    Os agendamentos vinculados ao atendimento aparecerão aqui.
                  </div>
                </div>
              ) : painelDireito === 'notas' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <StickyNote size={17} className="text-amber-600"/>
                    <b className="text-sm text-slate-800">Notas internas</b>
                  </div>
                  <div className="rounded-xl border bg-amber-50 p-3">
                    <textarea value={notaTexto} onChange={e=>setNotaTexto(e.target.value)}
                      rows={3} placeholder="Escreva uma nota para a equipe..."
                      className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-xs outline-none"/>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-800">Nunca é enviada ao cliente.</span>
                      <button disabled={!notaTexto.trim()}
                        onClick={async()=>{
                          const ok=await acaoApoio('nota_criar',{texto:notaTexto.trim()})
                          if(ok)setNotaTexto('')
                        }}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                        Salvar nota
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {notas.map(n=>(
                      <div key={n.id} className="rounded-xl border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-[11px] text-slate-700">{n.usuario_nome || 'Equipe'}</b>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{n.texto}</p>
                      </div>
                    ))}
                    {!notas.length && (
                      <div className="rounded-2xl border border-dashed p-5 text-center text-xs text-slate-500">
                        Nenhuma nota interna nesta conversa.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <History size={17} className="text-blue-600"/>
                    <div>
                      <b className="block text-sm text-slate-800">Histórico do atendimento</b>
                      <span className="text-[10px] text-slate-500">Aberturas, responsáveis, respostas, transferências, baixas e finalizações.</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {historico.filter(e=>!['status_whatsapp','mensagem_enviada_qr'].includes(e.tipo)).map(e=>{
                      const dados=(e.dados||{}) as Record<string,unknown>
                      const nome=e.usuario_nome||'Sistema'
                      let descricao=e.tipo.replaceAll('_',' ')
                      if(e.tipo==='conversa_visualizada')descricao='abriu a conversa'
                      else if(e.tipo==='conversa_assumida')descricao='assumiu o atendimento'
                      else if(e.tipo==='conversa_transferida')descricao=`transferiu o atendimento para ${String(dados.destino_nome||'outro usuário')}`
                      else if(e.tipo==='conversa_direcionada_mencao')descricao=`direcionou para ${String(dados.destino_nome||'outro usuário')}`
                      else if(e.tipo==='conversa_finalizada')descricao='finalizou o atendimento'
                      else if(e.tipo==='conversa_baixada')descricao='deu baixa nas mensagens pendentes'
                      else if(e.tipo==='conversa_acompanhada')descricao='começou a acompanhar'
                      else if(e.tipo==='conversa_acompanhamento_removido')descricao='parou de acompanhar'
                      else if(e.tipo==='mensagem_enfileirada_qr'||e.tipo==='mensagem_enviada')descricao='respondeu uma mensagem'
                      else if(e.tipo==='midia_enfileirada_qr')descricao='enviou um arquivo ou mídia'
                      else if(e.tipo==='mensagem_recebida_qr'||e.tipo==='mensagem_recebida')descricao='nova mensagem recebida'
                      return <div key={e.id} className="rounded-xl border bg-white p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><History size={13}/></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-700"><b>{nome}</b> {descricao}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                    })}
                    {!historico.length&&<div className="rounded-2xl border border-dashed p-5 text-center text-xs text-slate-500">Nenhum evento registrado ainda.</div>}
                  </div>
                </div>
              )}
            </div>
            </>}
          </aside>
        </div>
      </div>

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