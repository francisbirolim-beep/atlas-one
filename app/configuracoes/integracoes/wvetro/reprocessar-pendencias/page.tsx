'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Play, RefreshCw, Square } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Pendencia = {
  id: string
  data: string
  erro?: string | null
  tentativas: number
  status: string
  atualizado_em?: string | null
}

type Execucao = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  status: string
  dias_pendentes: number
  itens_processados: number
  tipologias_processadas: number
  componentes_processados: number
  ultima_mensagem?: string | null
}

type Estado = {
  execucao: Execucao
  pendencias: {
    pendentes: number
    resolvidas: number
    proximas: Pendencia[]
  }
}

async function api(method: 'GET' | 'POST', body?: any) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const resp = await fetch('/api/integracoes/wvetro/reprocessar-pendencias', {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha (${resp.status}).`)
  return json
}

export default function ReprocessarPendenciasWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [rodando, setRodando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const rodandoRef = useRef(false)

  useEffect(() => { rodandoRef.current = rodando }, [rodando])

  async function carregar() {
    setErro('')
    const json = await api('GET')
    setEstado({ execucao: json.execucao, pendencias: json.pendencias })
    return json
  }

  useEffect(() => {
    usuarioAtual().then(async usuario => {
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (ehMaster) {
        try { await carregar() } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar pendências.') }
      }
    })
  }, [])

  async function reprocessarUma(data?: string) {
    if (!estado?.execucao?.id) return null
    setOcupado(true)
    setErro('')
    try {
      const json = await api('POST', { execucaoId: estado.execucao.id, ...(data ? { data } : {}) })
      if (json.execucao || json.pendencias) {
        setEstado(atual => atual ? {
          execucao: json.execucao || atual.execucao,
          pendencias: json.pendencias || atual.pendencias,
        } : atual)
      }
      if (json.concluida) setMensagem('Todas as pendências foram reprocessadas com sucesso.')
      else if (json.data) setMensagem(`${json.data} resolvida. Restam ${json.pendencias?.pendentes ?? '...'} pendências.`)
      return json
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao reprocessar pendência.'
      setErro(msg)
      throw e
    } finally {
      setOcupado(false)
    }
  }

  async function loop(execucaoId: string) {
    if (!rodandoRef.current) return
    try {
      const json = await api('POST', { execucaoId })
      setEstado(atual => atual ? {
        execucao: json.execucao || atual.execucao,
        pendencias: json.pendencias || atual.pendencias,
      } : atual)
      if (json.concluida || Number(json.pendencias?.pendentes || 0) === 0) {
        setRodando(false)
        setMensagem('Todas as pendências foram reprocessadas com sucesso.')
        return
      }
      setMensagem(`${json.data} resolvida. Restam ${json.pendencias?.pendentes ?? '...'} pendências.`)
      setTimeout(() => loop(execucaoId), 650)
    } catch (e) {
      setRodando(false)
      setErro(e instanceof Error ? e.message : 'O reprocessamento automático parou em uma pendência com erro.')
      try { await carregar() } catch {}
    }
  }

  function iniciarTodas() {
    if (!estado?.execucao?.id || estado.pendencias.pendentes === 0) return
    setErro('')
    setMensagem('Reprocessamento automático iniciado pela pendência mais antiga.')
    setRodando(true)
    rodandoRef.current = true
    setTimeout(() => loop(estado.execucao.id), 100)
  }

  if (master === false) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">Pendências W.Vetro</h1><p className="mt-2 text-sm text-slate-600">Área restrita ao Master.</p></div></main>

  const total = (estado?.pendencias.pendentes || 0) + (estado?.pendencias.resolvidas || 0)
  const percentual = total ? Math.round(((estado?.pendencias.resolvidas || 0) / total) * 100) : 100

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <Link href="/configuracoes/integracoes/wvetro/base-tecnica" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Base técnica W.Vetro</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Reprocessar pendências da carga histórica</h1>
          <p className="mt-1 text-sm text-slate-600">Processa somente os dias que falharam. Não repete os dias já concluídos da carga histórica.</p>
        </div>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{mensagem}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Execução histórica</p>
              <p className="mt-1 font-semibold text-slate-900">{estado ? `${estado.execucao.periodo_inicio} → ${estado.execucao.periodo_fim}` : 'Carregando...'}</p>
              {estado?.execucao.ultima_mensagem && <p className="mt-1 text-xs text-slate-500">{estado.execucao.ultima_mensagem}</p>}
            </div>
            <button onClick={carregar} disabled={ocupado || rodando} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} /> Atualizar</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs text-amber-700">Pendentes</p><p className="mt-1 text-3xl font-bold text-amber-900">{estado?.pendencias.pendentes ?? '—'}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Resolvidas</p><p className="mt-1 text-3xl font-bold text-emerald-900">{estado?.pendencias.resolvidas ?? '—'}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs text-blue-700">Conclusão das pendências</p><p className="mt-1 text-3xl font-bold text-blue-900">{percentual}%</p></div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{ width: `${percentual}%` }} /></div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!rodando && (estado?.pendencias.pendentes || 0) > 0 && <button onClick={iniciarTodas} disabled={ocupado} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={15} /> Reprocessar todas</button>}
            {rodando && <button onClick={() => setRodando(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"><Square size={14} /> Parar após esta</button>}
            {(rodando || ocupado) && <span className="inline-flex items-center gap-2 px-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Processando W.Vetro...</span>}
            {estado?.pendencias.pendentes === 0 && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17} /> Nenhuma pendência restante</span>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Próximas pendências</h2>
          <p className="mt-1 text-xs text-slate-500">A lista começa pela data mais antiga. Você também pode validar uma data isoladamente antes do lote completo.</p>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {(estado?.pendencias.proximas || []).map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div><p className="text-sm font-semibold text-slate-800">{p.data}</p><p className="mt-1 text-xs text-slate-500">Tentativas: {p.tentativas} · {p.erro || 'Falha registrada na carga histórica.'}</p></div>
                <button onClick={() => reprocessarUma(p.data)} disabled={ocupado || rodando} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Testar esta data</button>
              </div>
            ))}
            {estado && estado.pendencias.proximas.length === 0 && <div className="p-4 text-sm text-slate-500">Sem pendências para exibir.</div>}
          </div>
        </section>
      </div>
    </main>
  )
}
