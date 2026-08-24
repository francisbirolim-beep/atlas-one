'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Database, Image as ImageIcon, Loader2, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Resumo = {
  catalogoAtlas: { perfisWvetro: number; acessoriosWvetro: number; produtosComFoto: number }
  referencias: { linhas: number; tipologias: number; tipologiasMapeadas: number; perfisHistoricos: number; acessoriosHistoricos: number; vidros: number; vidrosComImagem: number }
  apiProdutos: { snapshots: number; comImagem: number; comLinha: number; erros: number }
}

class ErroAuditoriaApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

async function api(body?: any) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente.')
  const resp = await fetch('/api/integracoes/wvetro/auditoria', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new ErroAuditoriaApi(resp.status, json.error || `Falha na auditoria (${resp.status}).`)
  return json
}

function iso(d: Date) { return d.toISOString().slice(0, 10) }
function adicionarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return iso(d)
}
function menor(a: string, b: string) { return a < b ? a : b }

export default function AuditoriaWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [inicio, setInicio] = useState('2023-01-01')
  const [fim, setFim] = useState(() => iso(new Date()))
  const [rodando, setRodando] = useState(false)
  const [etapa, setEtapa] = useState('')
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [descoberta, setDescoberta] = useState<any>(null)
  const parar = useRef(false)

  async function carregarResumo() {
    try {
      const json = await api()
      setResumo(json.resumo || null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar auditoria.')
    }
  }

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(u => {
      if (!ativo) return
      setMaster(u?.role === 'master')
      if (u?.role === 'master') carregarResumo()
    })
    return () => { ativo = false }
  }, [])

  async function executar() {
    if (rodando) return
    parar.current = false
    setRodando(true)
    setErro('')
    setProgresso(0)
    setEtapa('Conferindo linhas e catálogo geral...')
    try {
      const inicial = await api({ acao: 'iniciar', periodoInicio: inicio, periodoFim: fim })
      const execucaoId = inicial.execucao.id as string
      setDescoberta(inicial.descobertaCatalogo)

      const periodos: Array<{ inicio: string; fim: string }> = []
      let cursor = inicio
      while (cursor <= fim) {
        const loteFim = menor(adicionarDias(cursor, 6), fim)
        periodos.push({ inicio: cursor, fim: loteFim })
        cursor = adicionarDias(loteFim, 1)
      }

      for (let i = 0; i < periodos.length; i++) {
        if (parar.current) throw new Error('Auditoria pausada pelo usuário. Os dados já auditados foram preservados.')
        const p = periodos[i]
        setEtapa(`Histórico W.Vetro ${p.inicio} até ${p.fim} (${i + 1}/${periodos.length}) · lotes de até 7 dias`)
        await api({ acao: 'periodo', execucaoId, inicio: p.inicio, fim: p.fim })
        setProgresso(Math.round(((i + 1) / Math.max(1, periodos.length)) * 35))
      }

      let offset = 0
      let total = 1
      while (offset < total) {
        if (parar.current) throw new Error('Auditoria pausada pelo usuário. Os dados já auditados foram preservados.')
        setEtapa(`Catálogo: Linha, dados e URL de cada produto (${offset}/${total === 1 ? '...' : total})`)
        const json = await api({ acao: 'produtos', offset, limite: 3 })
        const r = json.resultado
        total = Number(r.total || 0)
        offset = Number(r.proximoOffset || offset + 3)
        setProgresso(total ? 35 + Math.round(Math.min(1, offset / total) * 40) : 75)
        if (!r.processados) break
      }

      let offsetImagem = 0
      let totalImagem = 1
      while (offsetImagem < totalImagem) {
        if (parar.current) throw new Error('Auditoria pausada pelo usuário. Os dados já auditados foram preservados.')
        setEtapa(`Copiando imagens W.Vetro para o Atlas (${offsetImagem}/${totalImagem === 1 ? '...' : totalImagem})`)
        const json = await api({ acao: 'imagens', offset: offsetImagem, limite: 3 })
        const r = json.resultado
        totalImagem = Number(r.total || 0)
        offsetImagem = Number(r.proximoOffset || offsetImagem + 3)
        setProgresso(totalImagem ? 75 + Math.round(Math.min(1, offsetImagem / totalImagem) * 23) : 98)
        if (!r.processados) break
      }

      setEtapa('Fechando conferência, reconstruindo variáveis e calculando totais...')
      const final = await api({ acao: 'finalizar', execucaoId })
      setResumo(final.resumo)
      setProgresso(100)
      setEtapa('Auditoria concluída.')
    } catch (e) {
      if (e instanceof ErroAuditoriaApi && e.status === 504) {
        setErro('Mesmo um lote curto excedeu o tempo do servidor (504). Não reinicie: o Atlas precisa reduzir esse intervalo específico antes de continuar.')
      } else {
        setErro(e instanceof Error ? e.message : 'Falha na auditoria completa.')
      }
    } finally {
      setRodando(false)
      await carregarResumo()
    }
  }

  if (master === false) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6"><h1 className="text-xl font-semibold">Auditoria W.Vetro</h1><p className="mt-2 text-sm text-slate-600">Área restrita ao usuário Master.</p></div></main>

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/configuracoes/integracoes/wvetro" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={16}/> Integração W.Vetro</Link>
            <h1 className="text-2xl font-bold text-slate-900">Auditoria completa W.Vetro → Atlas</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Confere Linhas, Tipologias, Perfis, Acessórios, Vidros e imagens. O histórico é processado em lotes de até 7 dias para evitar timeout. A referência W.Vetro é preservada; receitas validadas do Atlas nunca são substituídas automaticamente.</p>
          </div>
          <ShieldCheck className="text-emerald-600" size={28}/>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-600">Histórico desde<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} disabled={rodando} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
            <label className="text-sm text-slate-600">Até<input type="date" value={fim} onChange={e => setFim(e.target.value)} disabled={rodando} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
            <div className="flex items-end gap-2">
              <button onClick={executar} disabled={rodando || master !== true} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{rodando ? <Loader2 size={16} className="animate-spin"/> : <PlayCircle size={16}/>} {rodando ? 'Auditando...' : 'Executar auditoria completa'}</button>
              {rodando && <button onClick={() => { parar.current = true; setEtapa('Pausando após o lote atual...') }} className="rounded-lg border border-slate-300 p-2.5 text-slate-700" title="Pausar"><PauseCircle size={18}/></button>}
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900 transition-all" style={{ width: `${progresso}%` }}/></div>
          {etapa && <p className="mt-2 text-sm text-slate-600">{etapa} {progresso > 0 && <strong>{progresso}%</strong>}</p>}
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        </section>

        {descoberta && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Descoberta do catálogo:</strong> Perfis API: {descoberta.perfis?.quantidadeApi ?? 0} · novos importados: {descoberta.perfis?.importados ?? 0}. Acessórios API: {descoberta.acessorios?.quantidadeApi ?? 0} · novos importados: {descoberta.acessorios?.importados ?? 0}.</section>}

        {resumo && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card titulo="Perfis W.Vetro" valor={resumo.catalogoAtlas.perfisWvetro} detalhe="Cadastro Atlas" />
              <Card titulo="Acessórios W.Vetro" valor={resumo.catalogoAtlas.acessoriosWvetro} detalhe="Cadastro Atlas" />
              <Card titulo="Tipologias referência" valor={resumo.referencias.tipologias} detalhe={`${resumo.referencias.tipologiasMapeadas} já mapeadas`} />
              <Card titulo="Linhas referência" valor={resumo.referencias.linhas} detalhe="Todas as fontes W.Vetro" />
            </section>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card titulo="Perfis usados no histórico" valor={resumo.referencias.perfisHistoricos} detalhe="Códigos únicos observados" />
              <Card titulo="Acessórios usados no histórico" valor={resumo.referencias.acessoriosHistoricos} detalhe="Códigos únicos observados" />
              <Card titulo="Vidros referência" valor={resumo.referencias.vidros} detalhe={`${resumo.referencias.vidrosComImagem} com imagem de origem`} />
              <Card titulo="Produtos com imagem W.Vetro" valor={resumo.apiProdutos.comImagem} detalhe={`${resumo.apiProdutos.snapshots} consultados na API`} icone="imagem" />
            </section>
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18}/> Regra de validação preservada</div><p className="mt-1">W.Vetro fornece a referência. Fórmula, composição, custo técnico e configuração já validados no Atlas têm prioridade e não são sobrescritos.</p></section>
          </>
        )}
      </div>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone }: { titulo: string; valor: number; detalhe: string; icone?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{titulo}</span>{icone === 'imagem' ? <ImageIcon size={17} className="text-slate-400"/> : <Database size={17} className="text-slate-400"/>}</div><div className="mt-1 text-2xl font-bold text-slate-900">{valor.toLocaleString('pt-BR')}</div><div className="mt-1 text-xs text-slate-500">{detalhe}</div></div>
}
