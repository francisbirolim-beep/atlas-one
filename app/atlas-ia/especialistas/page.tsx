'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, Loader2, Send, ShieldCheck, Sparkles, ThumbsUp } from 'lucide-react'
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
  const fimRef = useRef<HTMLDivElement>(null)

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
  function trocarEspecialista(especialista: AIEspecialista) {
    setSelecionado(especialista.modulo)
    setBolhas([])
    setEntrada('')
    setErro('')
  }

  async function enviar() {
    const pergunta = entrada.trim()
    if (!pergunta || carregando) return
    setEntrada('')
    setErro('')
    setBolhas(prev => [...prev, { papel: 'user', texto: pergunta }])
    setCarregando(true)

    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/ia/especialista', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          modulo: selecionado,
          pergunta,
          sessionId: sessoes[selecionado] || null,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Não foi possível consultar o especialista.')

      if (data.sessionId) {
        setSessoes(prev => ({ ...prev, [selecionado]: data.sessionId }))
      }
      setBolhas(prev => [...prev, {
        papel: 'assistant',
        texto: data.resposta || '',
        interacaoId: data.interacaoId || null,
        fontesPublicas: Array.isArray(data.fontesPublicas) ? data.fontesPublicas : [],
      }])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao falar com o especialista.')
    } finally {
      setCarregando(false)
    }
  }
  async function aprovar(interacaoId: string) {
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/ia/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
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
                className={`w-full rounded-xl border p-3 text-left transition ${selecionado === e.modulo ? 'border-[#182444] bg-[#182444] text-white' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot size={16}/>{e.nome}
                </div>
                <p className={`mt-1 text-xs ${selecionado === e.modulo ? 'text-white/70' : 'text-slate-500'}`}>
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
                    Pergunte sobre esta área. O especialista consulta apenas dados permitidos do Atlas e não altera registros.
                  </p>
                </div>
              )}

              {bolhas.map((b, index) => (
                <div key={index} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${b.papel === 'user' ? 'bg-[#182444] text-white' : 'border bg-slate-50'}`}>
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
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border p-2 focus-within:ring-2 focus-within:ring-slate-200">
              <textarea
                value={entrada}
                onChange={e => setEntrada(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                rows={1}
                placeholder={`Pergunte ao ${atual.nome}...`}
                className="max-h-36 min-h-10 flex-1 resize-none border-0 px-2 py-2 text-sm outline-none"
              />
              <button
                onClick={enviar}
                disabled={carregando || !entrada.trim() || !especialistas.length}
                className="rounded-xl bg-[#182444] p-2.5 text-white disabled:opacity-40"
              >
                <Send size={19}/>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Respostas são assistivas. Cálculos e decisões determinísticas continuam no Motor Atlas/MEE.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}