'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Clock3, MessageCircle,
  Search, Send, Settings, ShieldCheck, Smartphone, UserRoundCheck,
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
  const [ativa, setAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'minhas' | 'fila' | 'todas'>('minhas')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [canaisConectados, setCanaisConectados] = useState(0)
  const [canaisTotal, setCanaisTotal] = useState(0)
  const [destinoId, setDestinoId] = useState('')
  const [setorTransferencia, setSetorTransferencia] = useState('')
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
      setCanaisConectados(Number(json.canaisConectados || 0))
      setCanaisTotal(Number(json.canaisTotal || 0))
      if (selecionar && !ativa && json.conversas?.[0]) setAtiva(json.conversas[0])
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
      if (!q) return true
      return `${c.contato_nome || ''} ${c.telefone} ${c.responsavel_nome || ''} ${c.setor || ''}`
        .toLocaleLowerCase('pt-BR').includes(q)
    })
  }, [conversas, busca, filtro, eu?.id, eu?.role])

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

  const podeResponder = Boolean(
    ativa && (eu?.role === 'master' || ativa.responsavel_id === eu?.id),
  )
  const canalAtivo = ativa?.whatsapp_canal_id
    ? canais.find(c=>c.id===ativa.whatsapp_canal_id) || null
    : null
  const canalPronto = canalAtivo?.gateway_status === 'connected'

  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-2xl border bg-white shadow-sm">
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

        <div className="grid h-[calc(100dvh-170px)] min-h-[560px] md:grid-cols-[360px_1fr]">
          <aside className="min-h-0 border-r">
            <div className="border-b p-3">
              <div className="flex items-center gap-2 rounded-xl border px-3">
                <Search size={16} className="text-slate-400"/>
                <input value={busca} onChange={e=>setBusca(e.target.value)}
                  placeholder="Cliente, telefone, setor..." className="w-full py-2.5 text-sm outline-none"/>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button onClick={()=>setFiltro('minhas')} className={`rounded-lg px-2 py-2 ${filtro==='minhas'?'bg-white shadow-sm':''}`}>Minhas</button>
                <button onClick={()=>setFiltro('fila')} className={`rounded-lg px-2 py-2 ${filtro==='fila'?'bg-white shadow-sm':''}`}>Em espera</button>
                <button disabled={eu?.role!=='master'} onClick={()=>setFiltro('todas')}
                  className={`rounded-lg px-2 py-2 disabled:opacity-30 ${filtro==='todas'?'bg-white shadow-sm':''}`}>Todas</button>
              </div>
            </div>
            <div className="h-[calc(100%-126px)] overflow-y-auto">
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
                {ativa.responsavel_id && ativa.status !== 'finalizado' && (
                  <button onClick={()=>void acaoConversa('finalizar')}
                    className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold">
                    <CheckCircle2 size={15}/> Finalizar
                  </button>
                )}
              </div>

              {eu?.role === 'master' && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-4 py-2">
                  <ShieldCheck size={15} className="text-slate-500"/>
                  <span className="text-xs font-semibold text-slate-600">Supervisao Master</span>
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
                  <div className="flex items-end gap-2">
                    <textarea value={texto} onChange={e=>setTexto(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void enviar()}
                      }}
                      rows={1} placeholder={canalPronto?'Digite uma mensagem':'Conecte o WhatsApp pelo QR Code'}
                      className="min-h-11 flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
                    <button disabled={!texto.trim()||enviando||!canalPronto}
                      onClick={()=>void enviar()}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40">
                      <Send size={18}/>
                    </button>
                  </div>
                )}
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  O Atlas preserva o historico de mensagens e eventos mesmo apos finalizar o atendimento.
                </p>
              </div>
            </>}
          </section>
        </div>
      </div>
    </main>
  )
}