'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookHeart, Building2, Loader2, LockKeyhole, MessageCircleHeart, Send, ShieldCheck, SmilePlus, Users } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import BotaoOuvirResposta from '@/components/ai/BotaoOuvirResposta'

type DiarioItem = {
  id: string
  papel: 'usuario' | 'assistente' | 'sistema'
  conteudo: string
  humor_declarado?: number | null
  contexto_json?: Record<string, any>
  created_at: string
}

type Pergunta = {
  id: string
  campanha_id: string
  ordem: number
  texto: string
  tipo: 'texto' | 'escala_1_5' | 'sim_nao' | 'opcoes'
  opcoes_json?: string[]
  obrigatoria: boolean
}

type Campanha = {
  id: string
  titulo: string
  descricao?: string | null
  respondida: boolean
  perguntas: Pergunta[]
}

type Dados = {
  termosVersao: string
  preferencias: {
    termos_versao: string
    termos_aceitos_em: string | null
    termos_revogados_em: string | null
  } | null
  diario: DiarioItem[]
  clima: Campanha[]
}

const HUMORES = [
  { valor: 1, emoji: '😞', label: 'Muito difícil' },
  { valor: 2, emoji: '🙁', label: 'Difícil' },
  { valor: 3, emoji: '😐', label: 'Normal' },
  { valor: 4, emoji: '🙂', label: 'Bom' },
  { valor: 5, emoji: '😄', label: 'Muito bom' },
]

export default function AtlasPessoasPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [compartilharTexto, setCompartilharTexto] = useState('')
  const [modoIdentidade, setModoIdentidade] = useState<'anonimo_gestao' | 'identificado'>('anonimo_gestao')
  const [desejaContato, setDesejaContato] = useState(false)
  const [respostas, setRespostas] = useState<Record<string, string | number>>({})

  const termosAtivos = Boolean(
    dados?.preferencias?.termos_aceitos_em &&
    !dados?.preferencias?.termos_revogados_em &&
    dados?.preferencias?.termos_versao === dados?.termosVersao,
  )

  const mensagensChat = useMemo(
    () => (dados?.diario || [])
      .filter(item => item.contexto_json?.tipo === 'diario_chat')
      .slice()
      .reverse(),
    [dados],
  )

  async function api(body?: any) {
    const token = await tokenAtual()
    const r = await fetch('/api/ia/pessoas', {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token || ''}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Não foi possível concluir.')
    return j
  }

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      setDados(await api())
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  async function executar(body: any, depois?: () => void) {
    setOcupado(true)
    setErro('')
    try {
      const resultado = await api(body)
      if (resultado.sessionId) setSessionId(resultado.sessionId)
      depois?.()
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Não foi possível concluir.')
    } finally {
      setOcupado(false)
    }
  }

  async function enviarDiario() {
    const texto = mensagem.trim()
    if (!texto || ocupado) return
    setMensagem('')
    await executar({ acao: 'diario_chat', mensagem: texto, sessionId }, undefined)
  }

  async function responderPesquisa(campanha: Campanha) {
    const lista = campanha.perguntas
      .map(p => {
        const valor = respostas[p.id]
        if (valor === undefined || valor === '') return null
        if (p.tipo === 'escala_1_5') return { perguntaId: p.id, numero: Number(valor) }
        return { perguntaId: p.id, texto: String(valor) }
      })
      .filter(Boolean)
    await executar({
      acao: 'responder_clima',
      campanhaId: campanha.id,
      modoIdentidade,
      respostas: lista,
    })
  }

  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="font-semibold">Atlas Pessoas</h1>
            <p className="text-xs text-slate-500">Diário privado, clima e voz do colaborador</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        {!termosAtivos ? (
          <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck /></div>
            <h2 className="text-xl font-semibold">Privacidade primeiro</h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p>Seu diário é privado por padrão e não aparece no painel do gestor.</p>
              <p>Quando quiser compartilhar algo com a empresa, você escolhe se envia com seu nome ou anônimo para a gestão.</p>
              <p>O Atlas não usa esta área para criar perfil psicológico, nota de desempenho ou decisão automática sobre você.</p>
            </div>
            <button
              disabled={ocupado}
              onClick={() => executar({ acao: 'aceitar_termos', compartilharMetricasAgregadas: true })}
              className="mt-5 rounded-xl bg-[#182444] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Li e quero usar o Atlas Pessoas
            </button>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-50 p-2 text-amber-700"><SmilePlus size={20} /></div>
                  <div>
                    <h2 className="font-semibold">Como está seu dia?</h2>
                    <p className="text-xs text-slate-500">Esse check-in fica no seu espaço privado.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {HUMORES.map(h => (
                    <button
                      key={h.valor}
                      disabled={ocupado}
                      onClick={() => executar({ acao: 'checkin', humor: h.valor })}
                      className="rounded-xl border p-3 text-center hover:bg-slate-50 disabled:opacity-50"
                      title={h.label}
                    >
                      <div className="text-2xl">{h.emoji}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{h.label}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border bg-white shadow-sm">
                <div className="border-b p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-violet-50 p-2 text-violet-700"><MessageCircleHeart size={20} /></div>
                    <div>
                      <h2 className="font-semibold">Conversa privada</h2>
                      <p className="text-xs text-slate-500">Converse com a IA sem alimentar memória corporativa ou painel de gestão.</p>
                    </div>
                  </div>
                </div>
                <div className="max-h-[460px] space-y-3 overflow-y-auto p-5">
                  {mensagensChat.length === 0 && (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      Você pode conversar sobre organização, dúvidas gerais, comunicação ou como foi seu dia.
                    </div>
                  )}
                  {mensagensChat.map(item => (
                    <div key={item.id} className={item.papel === 'usuario' ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ' + (item.papel === 'usuario' ? 'bg-[#182444] text-white' : 'border bg-white')}>
                        {item.conteudo}
                        {item.papel === 'assistente' && <div className="mt-2 border-t pt-1.5"><BotaoOuvirResposta texto={item.conteudo}/></div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t p-4">
                  <textarea
                    value={mensagem}
                    onChange={e => setMensagem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviarDiario() } }}
                    rows={2}
                    placeholder="Escreva aqui..."
                    className="min-h-12 flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <button disabled={ocupado || !mensagem.trim()} onClick={() => void enviarDiario()} className="self-end rounded-xl bg-[#182444] p-3 text-white disabled:opacity-40"><Send size={18} /></button>
                </div>
              </section>

              {(dados?.clima || []).filter(c => !c.respondida).map(campanha => (
                <section key={campanha.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-sky-50 p-2 text-sky-700"><Users size={20} /></div>
                    <div>
                      <h2 className="font-semibold">{campanha.titulo}</h2>
                      {campanha.descricao && <p className="text-xs text-slate-500">{campanha.descricao}</p>}
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {campanha.perguntas.map(p => (
                      <div key={p.id}>
                        <label className="mb-1 block text-sm font-medium">{p.texto}{p.obrigatoria ? ' *' : ''}</label>
                        {p.tipo === 'escala_1_5' ? (
                          <div className="flex gap-2">
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => setRespostas(r => ({ ...r, [p.id]: n }))} className={'h-10 w-10 rounded-lg border text-sm ' + (respostas[p.id] === n ? 'bg-[#182444] text-white' : 'bg-white')}>{n}</button>
                            ))}
                          </div>
                        ) : p.tipo === 'sim_nao' ? (
                          <select value={String(respostas[p.id] ?? '')} onChange={e => setRespostas(r => ({ ...r, [p.id]: e.target.value }))} className="w-full rounded-xl border p-2 text-sm">
                            <option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option>
                          </select>
                        ) : (
                          <textarea value={String(respostas[p.id] ?? '')} onChange={e => setRespostas(r => ({ ...r, [p.id]: e.target.value }))} rows={3} className="w-full rounded-xl border p-2 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select value={modoIdentidade} onChange={e => setModoIdentidade(e.target.value as any)} className="rounded-xl border px-3 py-2 text-sm">
                      <option value="anonimo_gestao">Anônimo para a gestão</option>
                      <option value="identificado">Com meu nome</option>
                    </select>
                    <button disabled={ocupado} onClick={() => void responderPesquisa(campanha)} className="rounded-xl bg-[#182444] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Enviar respostas</button>
                  </div>
                </section>
              ))}
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Building2 size={20} /></div>
                  <div>
                    <h2 className="font-semibold">Compartilhar com a empresa</h2>
                    <p className="text-xs text-slate-500">Só entra na gestão quando você envia por aqui.</p>
                  </div>
                </div>
                <textarea value={compartilharTexto} onChange={e => setCompartilharTexto(e.target.value)} rows={6} placeholder="Sugestão, dificuldade, reclamação ou ideia..." className="mt-4 w-full rounded-xl border p-3 text-sm" />
                <select value={modoIdentidade} onChange={e => setModoIdentidade(e.target.value as any)} className="mt-3 w-full rounded-xl border px-3 py-2 text-sm">
                  <option value="anonimo_gestao">Enviar anônimo para a gestão</option>
                  <option value="identificado">Enviar com meu nome</option>
                </select>
                {modoIdentidade === 'identificado' && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={desejaContato} onChange={e => setDesejaContato(e.target.checked)} />
                    Quero que alguém da empresa entre em contato comigo
                  </label>
                )}
                <button
                  disabled={ocupado || !compartilharTexto.trim()}
                  onClick={() => executar({
                    acao: 'compartilhar',
                    texto: compartilharTexto,
                    modoIdentidade,
                    desejaContato,
                  }, () => {
                    setCompartilharTexto('')
                    setDesejaContato(false)
                  })}
                  className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Compartilhar
                </button>
              </section>

              <section className="rounded-2xl border bg-white p-5 text-sm shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700"><LockKeyhole size={20} /></div>
                  <div>
                    <h2 className="font-semibold">O que é privado?</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">O diário e a conversa privada não aparecem para o gestor. Só o conteúdo enviado voluntariamente em “Compartilhar com a empresa” ou em pesquisas entra na visão gerencial.</p>
                  </div>
                </div>
                <button disabled={ocupado} onClick={() => executar({ acao: 'revogar_termos' })} className="mt-4 text-xs font-medium text-slate-500 underline">Revogar participação neste módulo</button>
              </section>

              <section className="rounded-2xl border bg-white p-5 text-sm shadow-sm">
                <div className="flex items-center gap-2 font-semibold"><BookHeart size={18} /> Uso responsável</div>
                <p className="mt-2 text-xs leading-5 text-slate-500">A IA ajuda com conversa e organização, mas não substitui atendimento profissional de saúde. Em situação urgente, procure ajuda humana e serviço de emergência.</p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}