'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Clock3,
  ExternalLink, Info, MapPin, MessageCircle, Mic, Paperclip, Search,
  Send, Settings, ShieldCheck, Smartphone, StickyNote, Tag, UserPlus,
  UserRoundCheck,
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
  status: string
  responsavel_id?: string | null
  responsavel_nome?: string | null
  setor?: string | null
  ultimo_preview?: string | null
  nao_lidas?: number | null
  ultima_mensagem_em?: string | null
}
type Mensagem = {
  id: string
  conversa_id: string
  direcao: 'entrada' | 'saida'
  tipo: string
  texto?: string | null
  media_url?: string | null
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
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'minhas' | 'fila' | 'todas' | 'nao_lidas'>('minhas')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [canaisConectados, setCanaisConectados] = useState(0)
  const [canaisTotal, setCanaisTotal] = useState(0)
  const [destinoId, setDestinoId] = useState('')
  const [setorTransferencia, setSetorTransferencia] = useState('')
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [obras, setObras] = useState<ObraResumo[]>([])
  const [carregandoCliente, setCarregandoCliente] = useState(false)
  const [painelDireito, setPainelDireito] = useState<'cliente' | 'agenda' | 'notas'>('cliente')
  const fimRef = useRef<HTMLDivElement | null>(null)

  async function carregarConversas(selecionar = true) {
    try {
      const headers = await headersJson()
      const resp = await fetch('/api/integracoes/whatsapp/conversas', { headers })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao carregar conversas.')
      setEu(json.usuario)
      setConversas(json.conversas || [])
      setUsuarios(json.usuarios || [])
      setCanais(json.canais || [])
      setAcessos(json.acessos || [])
      setCanaisConectados(Number(json.canaisConectados || 0))
      setCanaisTotal(Number(json.canaisTotal || 0))
      if (selecionar && !ativa && json.conversas?.[0]) {
        const conversaId = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('conversaId')
          : null
        const solicitada = conversaId
          ? (json.conversas || []).find((c: Conversa) => c.id === conversaId)
          : null
        setAtiva(solicitada || json.conversas[0])
      }
      if (ativa) {
        const atualizada = (json.conversas || []).find((c: Conversa) => c.id === ativa.id)
        if (atualizada) setAtiva(atualizada)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar atendimento.')
    } finally {
      setCarregando(false)
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

  useEffect(() => { void carregarConversas() }, [])
  useEffect(() => {
    if (!ativa?.id) { setMensagens([]); return }
    void carregarMensagens(ativa.id)
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
      if (filtro === 'fila' && c.responsavel_id) return false
      if (filtro === 'minhas' && c.responsavel_id !== eu?.id) return false
      if (filtro === 'todas' && eu?.role !== 'master') return false
      if (filtro === 'nao_lidas' && !c.nao_lidas) return false
      if (canalFiltro !== 'todos' && c.whatsapp_canal_id !== canalFiltro) return false
      if (!q) return true
      return `${c.contato_nome || ''} ${c.telefone} ${c.responsavel_nome || ''} ${c.setor || ''}`
        .toLocaleLowerCase('pt-BR').includes(q)
    })
  }, [conversas, busca, filtro, canalFiltro, eu?.id, eu?.role])

  async function acaoConversa(acao: string, extra: Record<string, unknown> = {}) {
    if (!ativa) return
    setErro('')
    const headers = await headersJson()
    const resp = await fetch('/api/integracoes/whatsapp/conversas', {
      method: 'POST', headers,
      body: JSON.stringify({ acao, conversaId: ativa.id, ...extra }),
    })
    const json = await resp.json()
    if (!resp.ok) { setErro(json.error || 'Nao foi possivel alterar o atendimento.'); return }
    setDestinoId('')
    setSetorTransferencia('')
    await carregarConversas(false)
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

  const totais = useMemo(() => ({
    todas: conversas.length,
    fila: conversas.filter(c => !c.responsavel_id).length,
    minhas: conversas.filter(c => c.responsavel_id === eu?.id).length,
    naoLidas: conversas.reduce((acc, c) => acc + Number(c.nao_lidas || 0), 0),
  }), [conversas, eu?.id])

  const podeResponder = Boolean(
    ativa && (eu?.role === 'master' || ativa.responsavel_id === eu?.id),
  )
  const canalAtivo = ativa?.whatsapp_canal_id
    ? canais.find(c=>c.id===ativa.whatsapp_canal_id) || null
    : null
  const canalPronto = canalAtivo?.gateway_status === 'connected'
  const acessoCanalAtivo = ativa?.whatsapp_canal_id
    ? acessos.find(a => a.canal_id === ativa.whatsapp_canal_id) || null
    : null
  const podeTransferirAtiva = Boolean(
    ativa && (eu?.role === 'master' || acessoCanalAtivo?.transferir),
  )

  return (
    <main className="min-h-screen bg-slate-100 p-0 md:p-4">
      <div className="mx-auto max-w-[1720px] overflow-hidden border bg-white shadow-sm md:rounded-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link>
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={20}/>
                <h1 className="font-bold text-slate-900">WhatsApp Atlas</h1>
              </div>
              <p className="text-xs text-slate-500">Multicanal · principal +55 (17) 99635-5667</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:inline-flex">
              {canaisConectados}/{canaisTotal} canais conectados
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

        <div className="grid h-[calc(100dvh-130px)] min-h-[620px] md:grid-cols-[340px_1fr] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="flex min-h-0 flex-col border-r">
            <div className="border-b p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Conversas</p>
                  <p className="text-[11px] text-slate-500">Fila e canais em tempo real</p>
                </div>
                <select value={canalFiltro} onChange={e=>setCanalFiltro(e.target.value)}
                  className="max-w-[170px] rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
                  <option value="todos">Todos os canais</option>
                  {canais.map(c=><option key={c.id} value={c.id}>{c.nome}{c.principal?' · Principal':''}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3">
                <Search size={16} className="text-slate-400"/>
                <input value={busca} onChange={e=>setBusca(e.target.value)}
                  placeholder="Buscar conversas..." className="w-full bg-transparent py-2.5 text-sm outline-none"/>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button onClick={()=>setFiltro('minhas')} className={`rounded-lg px-2 py-2 ${filtro==='minhas'?'bg-white shadow-sm':''}`}>
                  Minhas {totais.minhas || ''}
                </button>
                <button onClick={()=>setFiltro('fila')} className={`rounded-lg px-2 py-2 ${filtro==='fila'?'bg-white shadow-sm':''}`}>
                  Aguardando {totais.fila || ''}
                </button>
                <button onClick={()=>setFiltro('nao_lidas')} className={`rounded-lg px-2 py-2 ${filtro==='nao_lidas'?'bg-white shadow-sm':''}`}>
                  Não lidas {totais.naoLidas || ''}
                </button>
                <button disabled={eu?.role!=='master'} onClick={()=>setFiltro('todas')}
                  className={`rounded-lg px-2 py-2 disabled:opacity-30 ${filtro==='todas'?'bg-white shadow-sm':''}`}>
                  Todas {eu?.role==='master' ? totais.todas : ''}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {carregando ? (
                <div className="p-8 text-center text-sm text-slate-400">Carregando atendimentos...</div>
              ) : filtradas.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">Nenhuma conversa neste filtro.</div>
              ) : filtradas.map(c => (
                <button key={c.id} onClick={()=>setAtiva(c)}
                  className={`flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-slate-50 ${ativa?.id===c.id?'bg-emerald-50':''}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                    {(c.contato_nome || c.telefone).slice(0,1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="truncate text-sm">{c.contato_nome || telefoneFormatado(c.telefone)}</b>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">{hora(c.ultima_mensagem_em)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{c.ultimo_preview || 'Conversa WhatsApp'}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className={`rounded-full px-2 py-0.5 ${c.responsavel_id?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-700'}`}>
                        {c.responsavel_nome || 'Aguardando atendente'}
                      </span>
                      {c.setor && <span className="truncate text-slate-400">{c.setor}</span>}
                      {c.whatsapp_canal_id && (
                        <span className="truncate text-emerald-700">
                          {canais.find(x=>x.id===c.whatsapp_canal_id)?.nome || c.whatsapp_numero || 'WhatsApp'}
                        </span>
                      )}
                      {!!c.nao_lidas && <span className="ml-auto rounded-full bg-emerald-600 px-1.5 py-0.5 font-bold text-white">{c.nao_lidas}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col bg-[#efeae2]">
            {!ativa ? (
              <div className="grid h-full place-items-center text-center text-slate-500">
                <div><MessageCircle className="mx-auto mb-3" size={42}/><p>Selecione um atendimento.</p></div>
              </div>
            ) : <>
              <div className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{ativa.contato_nome || telefoneFormatado(ativa.telefone)}</b>
                  <p className="text-xs text-slate-500">
                    {telefoneFormatado(ativa.telefone)} · {ativa.responsavel_nome || 'Em espera'}
                    {ativa.setor ? ` · ${ativa.setor}` : ''}
                  </p>
                  {canalAtivo&&(
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                      Via {canalAtivo.nome}{canalAtivo.numero_declarado ? ` · ${telefoneFormatado(canalAtivo.numero_declarado)}` : ''}
                    </p>
                  )}
                </div>
                {ativa.cliente_id && (
                  <Link href={`/clientes/${ativa.cliente_id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                    Cliente 360
                  </Link>
                )}
                {!ativa.responsavel_id && (
                  <button onClick={()=>void acaoConversa('assumir')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                    <UserRoundCheck size={15}/> Assumir
                  </button>
                )}
                {ativa.responsavel_id && ativa.status !== 'finalizado' &&
                  (eu?.role === 'master' || ativa.responsavel_id === eu?.id) && (
                  <button onClick={()=>void acaoConversa('finalizar')}
                    className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold">
                    <CheckCircle2 size={15}/> Finalizar
                  </button>
                )}
              </div>

              {podeTransferirAtiva && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-4 py-2">
                  <ShieldCheck size={15} className="text-slate-500"/>
                  <span className="text-xs font-semibold text-slate-600">
                    {eu?.role === 'master' ? 'Supervisão Master' : 'Permissão de transferência'}
                  </span>
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
                    Transferir
                  </button>
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {mensagens.map(m => {
                  const saida = m.direcao === 'saida'
                  return (
                    <div key={m.id} className={`flex ${saida?'justify-end':'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${saida?'bg-[#d9fdd3]':'bg-white'}`}>
                        {saida && m.usuario_nome && <p className="mb-1 text-[10px] font-bold text-emerald-700">{m.usuario_nome}</p>}
                        {m.texto && <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{m.texto}</p>}
                        {!m.texto && <p className="text-sm text-slate-500">[{m.tipo}]</p>}
                        <p className="mt-1 text-right text-[10px] text-slate-400">{hora(m.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={fimRef}/>
              </div>

              <div className="border-t bg-white p-3">
                {!ativa.responsavel_id ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    <Clock3 size={16}/> Esta conversa esta na fila. Assuma para responder.
                  </div>
                ) : !podeResponder ? (
                  <div className="rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-600">
                    Atendimento de {ativa.responsavel_nome}. O Master pode acompanhar em tempo real.
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-1 text-slate-500">
                      <button disabled className="rounded-lg p-2 opacity-40" title="Envio de anexos entra na próxima etapa">
                        <Paperclip size={18}/>
                      </button>
                      <button disabled className="rounded-lg p-2 opacity-40" title="Etiquetas serão persistidas na próxima etapa">
                        <Tag size={18}/>
                      </button>
                      <span className="ml-auto text-[10px] text-slate-400">Enter envia · Shift+Enter quebra linha</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <textarea value={texto} onChange={e=>setTexto(e.target.value)}
                        onKeyDown={e=>{
                          if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void enviar()}
                        }}
                        rows={1} placeholder={canalPronto?'Digite uma mensagem':'Conecte o WhatsApp pelo QR Code'}
                        className="min-h-11 flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
                      <button disabled className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white text-slate-400 opacity-50" title="Áudio entra na próxima etapa">
                        <Mic size={18}/>
                      </button>
                      <button disabled={!texto.trim()||enviando||!canalPronto}
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

          <aside className="hidden min-h-0 flex-col border-l bg-white xl:flex">
            <div className="border-b p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 font-bold text-blue-700">
                  {ativa ? (ativa.contato_nome || ativa.telefone).slice(0,1).toUpperCase() : '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{ativa?.contato_nome || 'Contexto do atendimento'}</b>
                  <p className="truncate text-xs text-slate-500">
                    {ativa ? telefoneFormatado(ativa.telefone) : 'Selecione uma conversa'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b p-2 text-xs font-bold">
              <button onClick={()=>setPainelDireito('cliente')}
                className={`rounded-lg px-2 py-2 ${painelDireito==='cliente'?'bg-blue-50 text-blue-700':'text-slate-500'}`}>
                Cliente 360
              </button>
              <button onClick={()=>setPainelDireito('agenda')}
                className={`rounded-lg px-2 py-2 ${painelDireito==='agenda'?'bg-blue-50 text-blue-700':'text-slate-500'}`}>
                Agenda
              </button>
              <button onClick={()=>setPainelDireito('notas')}
                className={`rounded-lg px-2 py-2 ${painelDireito==='notas'?'bg-blue-50 text-blue-700':'text-slate-500'}`}>
                Notas
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
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dashed p-5 text-center">
                      <UserPlus className="mx-auto mb-3 text-slate-400" size={28}/>
                      <b className="text-sm text-slate-800">Contato ainda não vinculado</b>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        O Atlas tenta localizar o Cliente 360 automaticamente pelo telefone.
                      </p>
                      <Link href={'/clientes/novo?origem=whatsapp&nome=' + encodeURIComponent(ativa.contato_nome || '') + '&whatsapp=' + encodeURIComponent(ativa.telefone) + '&conversaId=' + encodeURIComponent(ativa.id)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
                        <UserPlus size={14}/> Cadastrar Cliente 360
                      </Link>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                      <Info size={15} className="mb-1"/>
                      Depois do vínculo, o histórico deste atendimento continua associado ao cliente.
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
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <StickyNote size={17} className="text-amber-600"/>
                    <b className="text-sm text-slate-800">Notas internas</b>
                  </div>
                  <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-slate-500">
                    Notas e guias internos ficarão visíveis só para a equipe, nunca para o cliente.
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}