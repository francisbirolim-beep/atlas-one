'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Database, Image as ImageIcon, Loader2, PackageSearch, Play, RefreshCw, RotateCcw, Square, Wrench } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Resumo = {
  componentesPorTipologia: number
  componentesMapeados: number
  produtosComCustoWvetro: number
  produtosWvetroComFoto: number
  tipologiasReferencia: number
}

type Execucao = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  cursor_data: string
  status: 'em_andamento' | 'concluida' | 'erro' | 'cancelada'
  dias_processados: number
  itens_processados: number
  tipologias_processadas: number
  componentes_processados: number
  ultima_mensagem?: string | null
  erro?: string | null
}

async function api(method: 'GET' | 'POST', body?: any) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const resp = await fetch('/api/integracoes/wvetro/base-tecnica', {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha (${resp.status}).`)
  return json
}

function dataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BaseTecnicaWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [execucao, setExecucao] = useState<Execucao | null>(null)
  const [inicio, setInicio] = useState('2024-01-01')
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [ocupado, setOcupado] = useState('')
  const [auto, setAuto] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const autoRef = useRef(false)
  const retryRef = useRef<{ cursor: string; tentativas: number }>({ cursor: '', tentativas: 0 })

  async function carregar() {
    setErro('')
    const json = await api('GET')
    setResumo(json.resumo || null)
    setExecucao(json.execucao || null)
  }

  useEffect(() => {
    usuarioAtual().then(async usuario => {
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (ehMaster) {
        try { await carregar() } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar.') }
      }
    })
  }, [])

  useEffect(() => { autoRef.current = auto }, [auto])

  const percentual = useMemo(() => {
    if (!execucao) return 0
    const a = new Date(`${execucao.periodo_inicio}T12:00:00`).getTime()
    const b = new Date(`${execucao.periodo_fim}T12:00:00`).getTime()
    const total = Math.max(1, Math.round((b - a) / 86400000) + 1)
    return Math.min(100, Math.round((Number(execucao.dias_processados || 0) / total) * 100))
  }, [execucao])

  async function acao(nome: string, body: any, texto?: string) {
    setOcupado(nome); setErro(''); setMensagem('')
    try {
      const json = await api('POST', body)
      if (json.resumo) setResumo(json.resumo)
      if (json.execucao) setExecucao(json.execucao)
      setMensagem(texto || json?.execucao?.ultima_mensagem || 'Concluído.')
      return json
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na operação.'
      setErro(msg)
      throw e
    } finally { setOcupado('') }
  }

  async function iniciarHistorico() {
    const json = await acao('historico', { acao: 'iniciar_historico', inicio, fim }, 'Carga histórica preparada.')
    retryRef.current = { cursor: '', tentativas: 0 }
    if (json.execucao) { setAuto(true); setTimeout(() => continuarAutomatico(json.execucao), 150) }
  }

  async function continuarAutomatico(atual?: Execucao) {
    const alvo = atual || execucao
    if (!alvo || alvo.status !== 'em_andamento' || !autoRef.current) return
    try {
      const json = await acao('historico', { acao: 'continuar_historico', execucaoId: alvo.id })
      const nova = json.execucao as Execucao
      if (nova) setExecucao(nova)
      if (nova?.cursor_data !== alvo.cursor_data) retryRef.current = { cursor: nova?.cursor_data || '', tentativas: 0 }
      if (!json.concluida && nova?.status === 'em_andamento' && autoRef.current) {
        setTimeout(() => continuarAutomatico(nova), 400)
      } else if (json.concluida) {
        setAuto(false)
        setMensagem('Carga histórica concluída.')
      }
    } catch {
      if (!autoRef.current) return
      try {
        const estado = await api('GET')
        const falha = estado.execucao as Execucao | null
        if (!falha || falha.id !== alvo.id || falha.status !== 'erro') {
          setAuto(false)
          return
        }
        setExecucao(falha)
        const anterior = retryRef.current.cursor === falha.cursor_data ? retryRef.current.tentativas : 0
        const tentativas = anterior + 1
        retryRef.current = { cursor: falha.cursor_data, tentativas }
        if (tentativas > 5) {
          setAuto(false)
          setErro(`O dia ${falha.cursor_data} falhou 5 vezes. O checkpoint foi preservado para análise sem perder o restante já importado.`)
          return
        }
        setErro('')
        setMensagem(`Falha temporária em ${falha.cursor_data}. Nova tentativa automática ${tentativas}/5 em 3 segundos.`)
        setTimeout(async () => {
          if (!autoRef.current) return
          try {
            const retomada = await api('POST', { acao: 'retomar_historico', execucaoId: falha.id })
            const execRetomada = retomada.execucao as Execucao
            if (execRetomada) setExecucao(execRetomada)
            setErro('')
            setTimeout(() => continuarAutomatico(execRetomada), 500)
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Falha ao retomar automaticamente.')
            setTimeout(() => continuarAutomatico(falha), 3000)
          }
        }, 3000)
      } catch (e) {
        setAuto(false)
        setErro(e instanceof Error ? e.message : 'Falha ao consultar o checkpoint da carga.')
      }
    }
  }

  async function retomar() {
    if (!execucao) return
    retryRef.current = { cursor: execucao.cursor_data, tentativas: 0 }
    const json = await acao('historico', { acao: 'retomar_historico', execucaoId: execucao.id }, 'Execução retomada.')
    if (json.execucao) { setAuto(true); setTimeout(() => continuarAutomatico(json.execucao), 150) }
  }

  async function cancelar() {
    if (!execucao) return
    setAuto(false)
    await acao('historico', { acao: 'cancelar_historico', execucaoId: execucao.id }, 'Carga cancelada. O que já foi importado permanece preservado.')
  }

  if (master === false) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">Base técnica W.Vetro</h1><p className="mt-2 text-sm text-slate-600">Área restrita ao Master.</p></div></main>

  const cards = [
    ['Tipologias referência', resumo?.tipologiasReferencia || 0, PackageSearch],
    ['BOM por tipologia', resumo?.componentesPorTipologia || 0, Wrench],
    ['Componentes mapeados', resumo?.componentesMapeados || 0, CheckCircle2],
    ['Produtos com custo W.Vetro', resumo?.produtosComCustoWvetro || 0, Database],
    ['Produtos com imagem', resumo?.produtosWvetroComFoto || 0, ImageIcon],
  ] as const

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link href="/configuracoes/integracoes/wvetro" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Integração W.Vetro</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Base técnica completa W.Vetro → Atlas</h1>
          <p className="mt-1 text-sm text-slate-600">Carga auditável de tipologias, perfis, acessórios, vidros, códigos, imagens, custos, posições, cortes e composição observada. A engenharia oficial do Atlas continua separada até validação.</p>
        </div>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensagem}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(([label, total, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={18} className="text-blue-700" /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{total}</p></div>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">1. Preparar catálogos e vínculos</h2><p className="mt-1 text-xs text-slate-500">Ações seguras e idempotentes. Podem ser repetidas.</p></div><button onClick={carregar} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"><RefreshCw size={14} /> Atualizar resumo</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button onClick={() => acao('catalogo', { acao: 'catalogo_esquadrias' }, 'Catálogo de esquadrias/tipologias consultado.')} disabled={!!ocupado} className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 disabled:opacity-50"><b className="text-sm text-slate-800">Puxar esquadrias + imagens</b><p className="mt-1 text-xs text-slate-500">Consulta o tipo E do W.Vetro e tenta vincular imagem à tipologia.</p></button>
            <button onClick={() => acao('mapear', { acao: 'mapear_componentes' }, 'Códigos exatos reconciliados com os produtos Atlas.')} disabled={!!ocupado} className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 disabled:opacity-50"><b className="text-sm text-slate-800">Reconciliar códigos</b><p className="mt-1 text-xs text-slate-500">Vincula somente perfil/acessório com correspondência única e exata.</p></button>
            <button onClick={() => acao('custos', { acao: 'sincronizar_custos' }, 'Custos observados sincronizados nos campos W.Vetro.')} disabled={!!ocupado} className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 disabled:opacity-50"><b className="text-sm text-slate-800">Sincronizar custos</b><p className="mt-1 text-xs text-slate-500">Atualiza custo mínimo, máximo e último sem sobrescrever o custo oficial Atlas.</p></button>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">2. Reconstruir composição por tipologia</h2>
          <p className="mt-1 text-sm text-slate-600">Lê pedidos e orçamentos dia a dia para manter o vínculo real Linha + Modelo → perfis + acessórios + vidros + custos. O checkpoint permite continuar de onde parou.</p>
          {!execucao || ['concluida','cancelada'].includes(execucao.status) ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-medium text-slate-600">Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-600">Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <div className="flex items-end"><button onClick={iniciarHistorico} disabled={!!ocupado || auto} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Play size={15} /> Iniciar carga</button></div>
            </div>
          ) : null}

          {execucao && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{execucao.periodo_inicio} → {execucao.periodo_fim}</p><p className="mt-1 text-xs text-slate-500">Próximo dia: {execucao.cursor_data} · Status: {execucao.status}</p></div><span className="text-sm font-bold text-blue-700">{percentual}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{ width: `${percentual}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs"><div>Dias: <b>{execucao.dias_processados}</b></div><div>Itens: <b>{execucao.itens_processados}</b></div><div>Tipologias: <b>{execucao.tipologias_processadas}</b></div><div>Componentes: <b>{execucao.componentes_processados}</b></div></div>
              {execucao.ultima_mensagem && <p className="mt-3 text-xs text-slate-600">{execucao.ultima_mensagem}</p>}
              {execucao.erro && <p className="mt-2 text-xs text-red-700">{execucao.erro}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {execucao.status === 'em_andamento' && !auto && <button onClick={() => { retryRef.current = { cursor: execucao.cursor_data, tentativas: 0 }; setAuto(true); setTimeout(() => continuarAutomatico(execucao), 100) }} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white"><Play size={14} /> Continuar automático</button>}
                {execucao.status === 'erro' && <button onClick={retomar} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"><RotateCcw size={14} /> Retomar do mesmo dia</button>}
                {auto && <button onClick={() => setAuto(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"><Square size={13} /> Pausar após este dia</button>}
                {execucao.status === 'em_andamento' && <button onClick={cancelar} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Cancelar carga</button>}
                {ocupado === 'historico' && <span className="inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Processando W.Vetro...</span>}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <b>Regra de segurança:</b> a composição histórica W.Vetro entra como referência auditável. Ela passa a orientar o orçamento e a criação das fórmulas, mas só vira receita oficial de engenharia quando estiver validada para aquela tipologia e variáveis.
        </section>
      </div>
    </main>
  )
}
