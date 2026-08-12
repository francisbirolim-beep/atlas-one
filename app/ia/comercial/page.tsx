'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Check, Lightbulb, Send, ThumbsDown, ThumbsUp, UserRound, WandSparkles } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Mensagem = {
  id: string
  papel: 'usuario' | 'ia'
  texto: string
  interacaoId?: string | null
  feedback?: 'aprovado' | 'corrigido' | 'rejeitado'
}

const SUGESTOES = [
  'Quais orçamentos recentes parecem precisar de acompanhamento?',
  'Me ajude a identificar informações que faltam nos pedidos recentes.',
  'Quais produtos cadastrados podem ajudar neste orçamento?',
  'Resuma os orçamentos quentes recentes para eu priorizar hoje.',
]

export default function AssistenteComercialPage() {
  const [nome, setNome] = useState('')
  const [pergunta, setPergunta] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fimRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    usuarioAtual().then(u => setNome(u?.nome || ''))
  }, [])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando])

  async function enviar(textoDireto?: string) {
    const texto = (textoDireto ?? pergunta).trim()
    if (!texto || enviando) return
    setErro('')
    setPergunta('')
    const idLocal = `u-${Date.now()}`
    setMensagens(prev => [...prev, { id: idLocal, papel: 'usuario', texto }])
    setEnviando(true)

    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no Atlas.')
      const resp = await fetch('/api/ia/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pergunta: texto }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível consultar a IA.')
      setMensagens(prev => [
        ...prev,
        {
          id: `ia-${Date.now()}`,
          papel: 'ia',
          texto: json.resposta,
          interacaoId: json.interacaoId,
        },
      ])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao consultar a IA')
    } finally {
      setEnviando(false)
    }
  }

  async function feedback(msg: Mensagem, avaliacao: 'aprovado' | 'rejeitado' | 'corrigido') {
    if (!msg.interacaoId) return
    let correcao = ''
    if (avaliacao === 'corrigido') {
      correcao = window.prompt('Como deveria ser a resposta? Escreva a correção que a IA deve aprender:')?.trim() || ''
      if (!correcao) return
    }
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada')
      const resp = await fetch('/api/ia/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interacaoId: msg.interacaoId, avaliacao, correcao }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Falha ao salvar feedback')
      setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: avaliacao } : m))
    } catch (e: any) {
      setErro(e?.message || 'Falha ao ensinar a IA')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link href="/" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Voltar">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white">
            <WandSparkles size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-800">Assistente Comercial</h1>
            <p className="text-xs text-slate-400">IA do Atlas · aprende com feedback humano</p>
          </div>
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline">Somente sugestões</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          <div className="mb-1 flex items-center gap-2 font-semibold"><Lightbulb size={16} /> Memória supervisionada ativa</div>
          <p className="text-xs leading-relaxed text-emerald-800">
            O assistente consulta dados do Atlas e registra as conversas. Quando você aprova ou corrige uma resposta, esse feedback passa a orientar respostas futuras. A IA não altera orçamento, preço, medida ou produção sozinha.
          </p>
        </div>

        {mensagens.length === 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-navyLight text-brand-navy"><Bot size={22} /></div>
              <div>
                <h2 className="font-semibold text-slate-800">{nome ? `Olá, ${nome}.` : 'Olá.'} O que você quer analisar?</h2>
                <p className="mt-1 text-sm text-slate-500">Posso consultar pedidos recentes, produtos, tipologias e padrões já aprovados no Atlas.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => enviar(s)} className="rounded-2xl border border-slate-200 p-3 text-left text-sm text-slate-600 transition hover:border-brand-navy hover:bg-brand-navyLight">
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-4">
          {mensagens.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.papel === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              {msg.papel === 'ia' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white"><Bot size={16} /></div>}
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${msg.papel === 'usuario' ? 'bg-brand-navy text-white' : 'border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
                <p className="whitespace-pre-wrap">{msg.texto}</p>
                {msg.papel === 'ia' && msg.interacaoId && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                    {msg.feedback ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check size={12} /> Feedback salvo: {msg.feedback}</span>
                    ) : (
                      <>
                        <button onClick={() => feedback(msg, 'aprovado')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><ThumbsUp size={12} /> Está certo</button>
                        <button onClick={() => feedback(msg, 'corrigido')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-amber-50 hover:text-amber-600"><UserRound size={12} /> Ensinar correção</button>
                        <button onClick={() => feedback(msg, 'rejeitado')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"><ThumbsDown size={12} /> Não ajudou</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {enviando && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-navy text-white"><Bot size={16} /></div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Analisando os dados do Atlas...</div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{erro}</div>}
      </main>

      <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4 md:bottom-5 md:left-56">
        <div className="mx-auto flex max-w-3xl gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <textarea
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder="Pergunte sobre clientes, pedidos, produtos, prioridades..."
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl px-3 py-3 text-sm outline-none"
          />
          <button onClick={() => enviar()} disabled={enviando || !pergunta.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white transition hover:bg-brand-navyDark disabled:opacity-40" aria-label="Enviar">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
