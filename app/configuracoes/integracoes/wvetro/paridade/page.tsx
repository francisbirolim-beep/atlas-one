'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, CheckCircle2, CircleAlert, Loader2, Play, RotateCcw, ShieldCheck, Square, XCircle } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Variavel = { chave: string; label: string; opcoes: string[] }
type Referencia = {
  id: string
  linha_raw: string
  modelo_raw: string
  tipologiaAtlasLabel: string | null
  componentes: { total: number; perfis: number; acessorios: number; vidros: number }
  casosIndividuais: number
  formula: null | {
    id: string
    status: string
    ativo: boolean
    versao: number
    configuracaoLabel: string | null
    variaveis: Variavel[]
  }
  nivel: 'sem_formula' | 'formula_validada' | 'formula_em_validacao'
}

type PerfilComparado = {
  codigo: string
  descricao: string
  eixo: string | null
  quantidadeAtlas: number
  corteAtlasMm: number
  encontradoWVetro: boolean
  ocorrenciasWVetro: number
  medidaHistoricaMinMm: number | null
  medidaHistoricaMaxMm: number | null
  corteDentroFaixaHistorica: boolean | null
  casoEncontrado?: boolean
  medidasCasoMm?: number[]
  quantidadesCaso?: number[]
  corteBateCaso?: boolean | null
  quantidadeBateCaso?: boolean | null
}

type AcessorioComparado = {
  codigo: string
  descricao: string
  statusFormula: string
  valorAtlas: number | null
  calculo: string
  erro: string | null
  encontradoWVetro: boolean
  ocorrenciasWVetro: number
  quantidadeHistoricaMin: number | null
  quantidadeHistoricaMax: number | null
  quantidadeDentroFaixaHistorica: boolean | null
  casoEncontrado?: boolean
  quantidadesCaso?: number[]
  quantidadeBateCaso?: boolean | null
}

type Comparacao = {
  referencia: { linha_raw: string; modelo_raw: string }
  formula: null | {
    id: string
    status: string
    versao: number
    configuracaoLabel: string | null
    variaveis: Variavel[]
  }
  entrada: { largura: number; altura: number; opcoes: Record<string, string>; folhas?: number }
  cobertura?: {
    perfisCalculados: number
    perfisComEvidencia: number
    acessoriosDefinidos: number
    acessoriosCalculados: number
    acessoriosComEvidencia: number
    componentesHistoricos: number
    perfisNoCaso?: number
    perfisCorteBatendo?: number
    acessoriosNoCaso?: number
    acessoriosQuantidadeBatendo?: number
  }
  casoComparavel?: null | {
    id: string
    fonte: string
    documentoChave: string
    itemIndice: number
    dataReferencia: string | null
    itemCodigo: string | null
    itemNome: string | null
    largura: number | null
    altura: number | null
    variaveisObservadas?: Record<string, unknown> | null
    opcoesCompativeis?: { compatíveis: number; conflitos: number }
    calculadoBateNoCaso: boolean
  }
  perfis?: PerfilComparado[]
  acessorios?: AcessorioComparado[]
  vidro?: {
    quantidadeAtlas: number
    larguraAtlasMm: number | null
    alturaAtlasMm: number | null
    casoEncontrado?: boolean
    bateCaso?: boolean | null
    observados?: Array<{
      codigo: string
      larguraMm: number | null
      alturaMm: number | null
      quantidade: number | null
      especificacao: string
    }>
    referenciasWVetro: Array<{
      nome: string | null
      ocorrencias: number
      quantidadeMin: number | null
      quantidadeMax: number | null
      medidaMin: number | null
      medidaMax: number | null
    }>
  }
  mensagem?: string
  aviso?: string
}

type ExecucaoParidade = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  cursor_data: string
  status: 'em_andamento' | 'concluida' | 'erro' | 'cancelada'
  dias_processados: number
  dias_pendentes: number
  itens_processados: number
  casos_processados: number
  tipologias_processadas: number
  ultima_mensagem?: string | null
  erro?: string | null
}

type PendenciasParidade = {
  total: number
  proximas: Array<{ id: string; data: string; erro: string; tentativas: number }>
}

function dataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function api(params: URLSearchParams) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada.')
  const resp = await fetch(`/api/integracoes/wvetro/paridade?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha na comparação (${resp.status}).`)
  return json
}

async function apiPost(body: Record<string, unknown>) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada.')
  const resp = await fetch('/api/integracoes/wvetro/paridade', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha na captura de paridade (${resp.status}).`)
  return json
}

function fmtMm(v: number | null) {
  if (v === null || v === undefined) return '—'
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mm`
}

function fmtQtd(v: number | null) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

function faixa(min: number | null, max: number | null, unidade = '') {
  if (min === null && max === null) return '—'
  const a = min ?? max
  const b = max ?? min
  if (a === b) return `${fmtQtd(a)}${unidade}`
  return `${fmtQtd(a)} a ${fmtQtd(b)}${unidade}`
}

function statusFormula(status?: string | null) {
  if (status === 'validada') return { texto: 'Fórmula validada', classe: 'bg-emerald-100 text-emerald-800' }
  if (status === 'em_validacao') return { texto: 'Em validação', classe: 'bg-amber-100 text-amber-800' }
  return { texto: 'Sem fórmula', classe: 'bg-slate-100 text-slate-600' }
}

function Indicador({ valor }: { valor: boolean | null }) {
  if (valor === true) return <span title="Dentro da faixa histórica"><CheckCircle2 size={17} className="text-emerald-600" /></span>
  if (valor === false) return <span title="Fora da faixa histórica"><CircleAlert size={17} className="text-amber-600" /></span>
  return <span className="text-slate-400">—</span>
}

export default function ParidadeWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [referencias, setReferencias] = useState<Referencia[]>([])
  const [referenciaId, setReferenciaId] = useState('')
  const [largura, setLargura] = useState('1500')
  const [altura, setAltura] = useState('2200')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [comparacao, setComparacao] = useState<Comparacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [comparando, setComparando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [inicio, setInicio] = useState('2024-01-01')
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [execucao, setExecucao] = useState<ExecucaoParidade | null>(null)
  const [pendenciasParidade, setPendenciasParidade] = useState<PendenciasParidade>({ total: 0, proximas: [] })
  const [casosTotal, setCasosTotal] = useState(0)
  const [schemaParidadePronto, setSchemaParidadePronto] = useState(false)
  const [auto, setAuto] = useState(false)
  const [capturando, setCapturando] = useState(false)
  const autoRef = useRef(false)
  const retryRef = useRef<{ cursor: string; tentativas: number }>({ cursor: '', tentativas: 0 })

  const selecionada = useMemo(
    () => referencias.find(r => r.id === referenciaId) || null,
    [referencias, referenciaId],
  )

  const percentualCarga = useMemo(() => {
    if (!execucao) return 0
    const a = new Date(`${execucao.periodo_inicio}T12:00:00`).getTime()
    const b = new Date(`${execucao.periodo_fim}T12:00:00`).getTime()
    const total = Math.max(1, Math.round((b - a) / 86400000) + 1)
    return Math.min(100, Math.round((Number(execucao.dias_processados || 0) / total) * 100))
  }, [execucao])

  useEffect(() => { autoRef.current = auto }, [auto])

  useEffect(() => {
    let ativo = true
    async function iniciar() {
      const usuario = await usuarioAtual()
      if (!ativo) return
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (!ehMaster) {
        setCarregando(false)
        return
      }
      try {
        const json = await api(new URLSearchParams({ filtro: 'correr' }))
        const refs = Array.isArray(json.referencias) ? json.referencias as Referencia[] : []
        if (!ativo) return
        setReferencias(refs)
        setExecucao((json.execucao || null) as ExecucaoParidade | null)
        setPendenciasParidade((json.pendencias || { total: 0, proximas: [] }) as PendenciasParidade)
        setCasosTotal(Number(json.casosIndividuais || 0))
        setSchemaParidadePronto(Boolean(json.schemaParidadePronto))
        const piloto = refs.find(r => /suprema/i.test(r.linha_raw) && /porta.*02 folhas/i.test(r.modelo_raw))
          || refs.find(r => r.formula?.status === 'validada')
          || refs[0]
        if (piloto) setReferenciaId(piloto.id)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar referências.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void iniciar()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    setComparacao(null)
    const vars = selecionada?.formula?.variaveis || []
    setOpcoes(Object.fromEntries(vars.map(v => [v.chave, v.opcoes[0] || ''])))
    if (selecionada && /03 folhas/i.test(selecionada.modelo_raw)) {
      setLargura('2500')
      setAltura('2100')
    } else {
      setLargura('1500')
      setAltura('2200')
    }
  }, [referenciaId, selecionada?.id])

  function aplicarEstadoCaptura(json: any) {
    if (json?.execucao) setExecucao(json.execucao as ExecucaoParidade)
    if (json?.pendencias) setPendenciasParidade(json.pendencias as PendenciasParidade)
    if (json?.casosIndividuais !== undefined) setCasosTotal(Number(json.casosIndividuais || 0))
    if (json?.schemaParidadePronto !== undefined) setSchemaParidadePronto(Boolean(json.schemaParidadePronto))
  }

  async function recarregarParidade() {
    const json = await api(new URLSearchParams({ filtro: 'correr' }))
    if (Array.isArray(json.referencias)) setReferencias(json.referencias as Referencia[])
    aplicarEstadoCaptura(json)
  }

  async function iniciarCaptura() {
    setErro('')
    setMensagem('')
    setCapturando(true)
    try {
      const json = await apiPost({ acao: 'iniciar_historico', inicio, fim })
      aplicarEstadoCaptura(json)
      const nova = json.execucao as ExecucaoParidade
      retryRef.current = { cursor: nova?.cursor_data || '', tentativas: 0 }
      autoRef.current = true
      setAuto(true)
      setMensagem('Captura preparada. O Atlas vai percorrer o período dia a dia sem alterar os agregados antigos.')
      if (nova) setTimeout(() => void continuarAutomatico(nova), 150)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao iniciar captura.')
    } finally {
      setCapturando(false)
    }
  }

  async function continuarAutomatico(alvo: ExecucaoParidade) {
    if (!autoRef.current || alvo.status !== 'em_andamento') return
    setCapturando(true)
    try {
      const json = await apiPost({ acao: 'continuar_historico', execucaoId: alvo.id })
      aplicarEstadoCaptura(json)
      const nova = json.execucao as ExecucaoParidade
      if (nova?.cursor_data !== alvo.cursor_data) {
        retryRef.current = { cursor: nova?.cursor_data || '', tentativas: 0 }
      }
      if (!json.concluida && nova?.status === 'em_andamento' && autoRef.current) {
        setTimeout(() => void continuarAutomatico(nova), 180)
      } else {
        autoRef.current = false
        setAuto(false)
        setMensagem(json?.pendencias?.total
          ? `Captura principal concluída. Restam ${json.pendencias.total} dia(s) para reprocessar.`
          : 'Captura de casos individuais concluída.')
        await recarregarParidade()
      }
    } catch (e) {
      const cursor = alvo.cursor_data
      const anterior = retryRef.current.cursor === cursor ? retryRef.current.tentativas : 0
      const tentativas = anterior + 1
      retryRef.current = { cursor, tentativas }
      if (tentativas > 5 || !autoRef.current) {
        autoRef.current = false
        setAuto(false)
        setErro(e instanceof Error ? e.message : 'A captura automática foi interrompida.')
      } else {
        setMensagem(`Falha de comunicação em ${cursor}. Nova tentativa automática ${tentativas}/5.`)
        setTimeout(() => void continuarAutomatico(alvo), 3000)
      }
    } finally {
      setCapturando(false)
    }
  }

  function pausarCaptura() {
    autoRef.current = false
    setAuto(false)
    setMensagem('Captura pausada. O checkpoint foi preservado.')
  }

  async function continuarCaptura() {
    if (!execucao || execucao.status !== 'em_andamento') return
    retryRef.current = { cursor: execucao.cursor_data, tentativas: 0 }
    autoRef.current = true
    setAuto(true)
    setMensagem('Captura retomada a partir do checkpoint.')
    await continuarAutomatico(execucao)
  }

  async function cancelarCaptura() {
    if (!execucao) return
    autoRef.current = false
    setAuto(false)
    setCapturando(true)
    try {
      const json = await apiPost({ acao: 'cancelar_historico', execucaoId: execucao.id })
      aplicarEstadoCaptura(json)
      setMensagem('Captura cancelada. Os casos já gravados permanecem preservados.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cancelar captura.')
    } finally {
      setCapturando(false)
    }
  }

  async function retomarCapturaComErro() {
    if (!execucao) return
    setCapturando(true)
    try {
      const json = await apiPost({ acao: 'retomar_historico', execucaoId: execucao.id })
      aplicarEstadoCaptura(json)
      const nova = json.execucao as ExecucaoParidade
      autoRef.current = true
      setAuto(true)
      if (nova) setTimeout(() => void continuarAutomatico(nova), 150)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao retomar captura.')
    } finally {
      setCapturando(false)
    }
  }

  async function reprocessarPendencias() {
    if (!execucao || pendenciasParidade.total <= 0) return
    setErro('')
    setCapturando(true)
    try {
      let restantes = pendenciasParidade.total
      while (restantes > 0) {
        const json = await apiPost({ acao: 'reprocessar_pendencia', execucaoId: execucao.id })
        aplicarEstadoCaptura(json)
        restantes = Number(json?.pendencias?.total || 0)
      }
      setMensagem('Todas as pendências da captura foram reprocessadas.')
      await recarregarParidade()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao reprocessar pendências.')
    } finally {
      setCapturando(false)
    }
  }

  async function comparar() {
    if (!selecionada) return
    setComparando(true)
    setErro('')
    setComparacao(null)
    try {
      const params = new URLSearchParams({
        referenciaId: selecionada.id,
        largura,
        altura,
        opcoes: JSON.stringify(opcoes),
      })
      const json = await api(params)
      setComparacao(json.comparacao || null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível comparar.')
    } finally {
      setComparando(false)
    }
  }

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-bold text-slate-900">Paridade W.Vetro × Atlas</h1>
          <p className="mt-2 text-sm text-slate-600">Área restrita ao usuário Master.</p>
          <Link href="/configuracoes/integracoes/wvetro" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16} /> Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/configuracoes/integracoes/wvetro" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={16} /> Integração W.Vetro</Link>
            <h1 className="text-2xl font-bold text-slate-950">Paridade W.Vetro × Atlas</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Compara o motor técnico do Atlas com a evidência histórica do W.Vetro. A captura grava apenas casos isolados de auditoria; não altera fórmulas, receitas, custos nem cadastros operacionais.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck className="text-emerald-700" size={24} /></div>
        </header>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <strong>Regra de validação:</strong> faixa histórica serve como evidência, mas somente um caso individual do W.Vetro permite comparar o mesmo tamanho componente a componente. O selo verde exige perfil, corte, quantidade, acessórios calculados e vidro compatíveis no caso selecionado.
        </section>

        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensagem}</div>}

        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          {!schemaParidadePronto && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Estrutura de casos individuais ainda não aplicada ao banco. O comparador por evidência agregada funciona normalmente; a captura histórica fica bloqueada até a migration ser homologada.
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Captura histórica de casos individuais</h2>
              <p className="mt-1 max-w-3xl text-xs text-slate-500">Reconsulta pedidos e orçamentos W.Vetro dia a dia e grava somente os itens individuais usados na paridade. Não soma novamente BOM, custos nem ocorrências da carga técnica antiga.</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right">
              <div className="text-xs text-emerald-700">Casos individuais</div>
              <div className="text-2xl font-bold text-emerald-900">{casosTotal.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          {schemaParidadePronto && (!execucao || ['concluida', 'cancelada'].includes(execucao.status)) && !auto && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-medium text-slate-600">Início
                <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Fim
                <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="flex items-end">
                <button onClick={() => void iniciarCaptura()} disabled={capturando} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
                  <Play size={15} /> Iniciar captura
                </button>
              </div>
            </div>
          )}

          {schemaParidadePronto && execucao && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{execucao.periodo_inicio} → {execucao.periodo_fim}</p>
                  <p className="mt-1 text-xs text-slate-500">Checkpoint: {execucao.cursor_data} · Status: {execucao.status}</p>
                </div>
                <span className="text-sm font-bold text-emerald-700">{percentualCarga}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${percentualCarga}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                <div>Dias: <b>{execucao.dias_processados || 0}</b></div>
                <div>Itens: <b>{execucao.itens_processados || 0}</b></div>
                <div>Casos: <b>{execucao.casos_processados || 0}</b></div>
                <div>Tipologias: <b>{execucao.tipologias_processadas || 0}</b></div>
                <div>Pendências: <b>{pendenciasParidade.total}</b></div>
              </div>
              {execucao.ultima_mensagem && <p className="mt-3 text-xs text-slate-600">{execucao.ultima_mensagem}</p>}
              {execucao.erro && <p className="mt-2 text-xs text-red-700">{execucao.erro}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {execucao.status === 'em_andamento' && !auto && <button onClick={() => void continuarCaptura()} disabled={capturando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Play size={14} /> Continuar</button>}
                {auto && <button onClick={pausarCaptura} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"><Square size={13} /> Pausar após este dia</button>}
                {execucao.status === 'erro' && <button onClick={() => void retomarCapturaComErro()} disabled={capturando} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"><RotateCcw size={14} /> Retomar checkpoint</button>}
                {execucao.status === 'em_andamento' && <button onClick={() => void cancelarCaptura()} disabled={capturando} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Cancelar</button>}
                {pendenciasParidade.total > 0 && !auto && <button onClick={() => void reprocessarPendencias()} disabled={capturando} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"><RotateCcw size={14} /> Reprocessar {pendenciasParidade.total} pendência(s)</button>}
                {capturando && <span className="inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Processando...</span>}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Calculator size={19} /><h2 className="font-bold text-slate-900">Caso de teste</h2></div>
          {carregando ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Carregando referências...</div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <label className="text-sm text-slate-600 lg:col-span-2">Tipologia
                <select value={referenciaId} onChange={e => setReferenciaId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900">
                  {referencias.map(r => <option key={r.id} value={r.id}>{r.linha_raw} · {r.modelo_raw}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-600">Largura (mm)
                <input inputMode="numeric" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm text-slate-600">Altura (mm)
                <input inputMode="numeric" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
            </div>
          )}

          {selecionada && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Atlas</div><div className="mt-1 text-sm font-semibold text-slate-800">{selecionada.tipologiaAtlasLabel || 'Não vinculada'}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Evidências agregadas</div><div className="mt-1 text-lg font-bold text-slate-900">{selecionada.componentes.total}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Casos individuais</div><div className="mt-1 text-lg font-bold text-slate-900">{selecionada.casosIndividuais || 0}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Perfis / acessórios / vidros</div><div className="mt-1 text-sm font-semibold text-slate-800">{selecionada.componentes.perfis} / {selecionada.componentes.acessorios} / {selecionada.componentes.vidros}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Motor Atlas</div><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusFormula(selecionada.formula?.status).classe}`}>{statusFormula(selecionada.formula?.status).texto}</span></div>
            </div>
          )}

          {!!selecionada?.formula?.variaveis?.length && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {selecionada.formula.variaveis.map(v => (
                <label key={v.chave} className="text-sm text-slate-600">{v.label}
                  <select value={opcoes[v.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [v.chave]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900">
                    {v.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          <button onClick={() => void comparar()} disabled={comparando || !selecionada || !selecionada.formula} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {comparando ? <Loader2 className="animate-spin" size={16} /> : <Calculator size={16} />}
            {comparando ? 'Comparando...' : selecionada?.formula ? 'Comparar com W.Vetro' : 'Sem fórmula Atlas para comparar'}
          </button>
        </section>

        {comparacao?.mensagem && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{comparacao.mensagem}</section>}

        {comparacao?.casoComparavel && (
          <section className={`rounded-2xl border p-5 ${comparacao.casoComparavel.calculadoBateNoCaso ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Caso individual com a mesma medida</div>
                <div className="mt-1 font-semibold text-slate-950">
                  {comparacao.casoComparavel.fonte === 'orcamento' ? 'Orçamento' : 'Pedido'} {comparacao.casoComparavel.documentoChave}
                  {comparacao.casoComparavel.dataReferencia ? ` · ${comparacao.casoComparavel.dataReferencia}` : ''}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {fmtMm(comparacao.casoComparavel.largura)} × {fmtMm(comparacao.casoComparavel.altura)} · item {comparacao.casoComparavel.itemIndice + 1}
                </div>
                {(comparacao.casoComparavel.itemCodigo || comparacao.casoComparavel.itemNome) && (
                  <div className="mt-2 text-xs text-slate-700">
                    {comparacao.casoComparavel.itemCodigo && <span className="font-mono font-semibold">{comparacao.casoComparavel.itemCodigo}</span>}
                    {comparacao.casoComparavel.itemCodigo && comparacao.casoComparavel.itemNome ? ' · ' : ''}
                    {comparacao.casoComparavel.itemNome || ''}
                  </div>
                )}
                {!!comparacao.casoComparavel.variaveisObservadas && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(comparacao.casoComparavel.variaveisObservadas)
                      .filter(([chave, valor]) => !['assinatura_perfis', 'item_codigo'].includes(chave) && valor !== null && valor !== '' && !Array.isArray(valor))
                      .slice(0, 10)
                      .map(([chave, valor]) => (
                        <span key={chave} className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[10px] font-medium text-blue-900">
                          {chave.replaceAll('_', ' ')}: {String(valor)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${comparacao.casoComparavel.calculadoBateNoCaso ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                  {comparacao.casoComparavel.calculadoBateNoCaso ? 'Componentes calculados batendo' : 'Comparação exata disponível'}
                </span>
                {comparacao.casoComparavel.opcoesCompativeis && (
                  <span className="text-[10px] text-slate-500">
                    opções: {comparacao.casoComparavel.opcoesCompativeis.compatíveis} compatível(is) · {comparacao.casoComparavel.opcoesCompativeis.conflitos} conflito(s)
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {comparacao?.cobertura && (
          <>
            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-8">
              {[
                ['Perfis calculados', comparacao.cobertura.perfisCalculados],
                ['Perfis com evidência', comparacao.cobertura.perfisComEvidencia],
                ['Acessórios definidos', comparacao.cobertura.acessoriosDefinidos],
                ['Acessórios calculados', comparacao.cobertura.acessoriosCalculados],
                ['Acessórios com evidência', comparacao.cobertura.acessoriosComEvidencia],
                ['Componentes históricos', comparacao.cobertura.componentesHistoricos],
                ['Cortes batendo no caso', comparacao.cobertura.perfisCorteBatendo ?? 0],
                ['Acessórios batendo no caso', comparacao.cobertura.acessoriosQuantidadeBatendo ?? 0],
              ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-950">{value}</div></div>)}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Perfis e cortes</h2><p className="mt-1 text-xs text-slate-500">O indicador compara o corte calculado pelo Atlas com a faixa de medidas já observada no histórico W.Vetro.</p></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Código</th><th>Descrição</th><th className="text-right">Qtd.</th>
                      <th className="text-right">Atlas</th><th className="text-right">Faixa histórica</th>
                      <th className="text-right">Caso exato</th><th className="px-4 text-center">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(comparacao.perfis || []).map((p, i) => (
                      <tr key={`${p.codigo}-${p.eixo}-${i}`}>
                        <td className="px-4 py-3 font-mono font-semibold">{p.codigo}</td>
                        <td>{p.descricao || '—'} <span className="text-xs text-slate-400">{p.eixo || ''}</span></td>
                        <td className="text-right">{p.quantidadeAtlas}</td>
                        <td className="text-right font-semibold">{fmtMm(p.corteAtlasMm)}</td>
                        <td className="text-right">{p.medidaHistoricaMinMm === null && p.medidaHistoricaMaxMm === null ? '—' : `${fmtMm(p.medidaHistoricaMinMm)} a ${fmtMm(p.medidaHistoricaMaxMm)}`}</td>
                        <td className="text-right">{p.medidasCasoMm?.length ? p.medidasCasoMm.map(fmtMm).join(' / ') : '—'}</td>
                        <td className="px-4"><div className="flex justify-center">{p.casoEncontrado ? <Indicador valor={p.corteBateCaso ?? null} /> : p.encontradoWVetro ? <Indicador valor={p.corteDentroFaixaHistorica} /> : <XCircle size={17} className="text-red-500" />}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Acessórios</h2><p className="mt-1 text-xs text-slate-500">Itens sem fórmula continuam como referência; o Atlas não inventa quantidade.</p></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Código</th><th>Descrição</th><th className="text-right">Atlas</th><th className="text-right">Faixa histórica</th><th className="text-right">Caso exato</th><th>Status</th><th className="px-4 text-center">Resultado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(comparacao.acessorios || []).map((a, i) => (
                      <tr key={`${a.codigo}-${i}`}>
                        <td className="px-4 py-3 font-mono font-semibold">{a.codigo}</td>
                        <td><div>{a.descricao || '—'}</div><div className="max-w-md text-[11px] text-slate-400">{a.calculo}</div>{a.erro && <div className="text-[11px] text-red-600">{a.erro}</div>}</td>
                        <td className="text-right font-semibold">{fmtQtd(a.valorAtlas)}</td>
                        <td className="text-right">{faixa(a.quantidadeHistoricaMin, a.quantidadeHistoricaMax)}</td>
                        <td className="text-right">{a.quantidadesCaso?.length ? a.quantidadesCaso.map(fmtQtd).join(' / ') : '—'}</td>
                        <td><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{a.statusFormula}</span></td>
                        <td className="px-4"><div className="flex justify-center">{a.casoEncontrado ? <Indicador valor={a.quantidadeBateCaso ?? null} /> : a.encontradoWVetro ? <Indicador valor={a.quantidadeDentroFaixaHistorica} /> : <XCircle size={17} className="text-red-500" />}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">Vidro</h2>
                {comparacao.vidro?.casoEncontrado && <Indicador valor={comparacao.vidro.bateCaso ?? null} />}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Quantidade Atlas</div><div className="mt-1 text-lg font-bold">{comparacao.vidro?.quantidadeAtlas || '—'}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Largura calculada</div><div className="mt-1 text-lg font-bold">{fmtMm(comparacao.vidro?.larguraAtlasMm ?? null)}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Altura calculada</div><div className="mt-1 text-lg font-bold">{fmtMm(comparacao.vidro?.alturaAtlasMm ?? null)}</div></div>
              </div>
              {!!comparacao.vidro?.observados?.length && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">
                  Caso exato W.Vetro: {comparacao.vidro.observados.map(v => `${v.especificacao || v.codigo || 'Vidro'} · ${fmtQtd(v.quantidade)} un · ${fmtMm(v.larguraMm)} × ${fmtMm(v.alturaMm)}`).join(' | ')}
                </div>
              )}
              {!!comparacao.vidro?.referenciasWVetro?.length && <div className="mt-3 text-xs text-slate-500">Histórico agregado W.Vetro: {comparacao.vidro.referenciasWVetro.map(v => `${v.nome || 'Vidro'} · qtd. ${faixa(v.quantidadeMin, v.quantidadeMax)}`).join(' | ')}</div>}
            </section>

            {comparacao.aviso && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mr-2 inline" size={17} />{comparacao.aviso}</div>}
          </>
        )}
      </div>
    </main>
  )
}