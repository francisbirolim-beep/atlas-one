'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Bug, CheckCircle2, ExternalLink, Lightbulb, Loader2,
  Paperclip, RefreshCcw, Search, ShieldAlert, Sparkles, Volume2, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Melhoria = {
  id: string
  numero: number
  criado_por_nome: string | null
  tipo: 'bug' | 'melhoria' | 'ideia'
  titulo: string
  descricao: string
  tela: string | null
  area: string | null
  resultado_atual: string | null
  resultado_esperado: string | null
  impacto: string | null
  urgencia: 'baixa' | 'media' | 'alta' | 'critica'
  status: string
  risco: 'nao_avaliado' | 'baixo' | 'medio' | 'alto' | 'critico'
  exige_aprovacao: boolean
  justificativa_risco: string | null
  analise_ia: { recomendacao?: string; classificado_em?: string } | null
  aprovacao_status: string
  aprovado_por_nome: string | null
  aprovado_em: string | null
  observacoes_admin: string | null
  relatos_count: number
  created_at: string
  anexo_nome: string | null
  anexo_url: string | null
  audio_url: string | null
}

const STATUS = [
  ['novo', 'Novo'],
  ['ia_analisando', 'IA analisando'],
  ['informacao_necessaria', 'Informação necessária'],
  ['solucao_proposta', 'Solução proposta'],
  ['aguardando_aprovacao', 'Aguardando aprovação'],
  ['aprovado', 'Aprovado'],
  ['em_desenvolvimento', 'Desenvolvimento'],
  ['teste', 'Teste'],
  ['pronto_publicar', 'Pronto para publicar'],
  ['publicado', 'Publicado'],
  ['rejeitado', 'Rejeitado'],
] as const

function labelStatus(valor: string) {
  return STATUS.find(([id]) => id === valor)?.[1] || valor
}

function classeRisco(risco: string) {
  if (risco === 'critico') return 'bg-red-100 text-red-800'
  if (risco === 'alto') return 'bg-orange-100 text-orange-800'
  if (risco === 'medio') return 'bg-amber-100 text-amber-800'
  if (risco === 'baixo') return 'bg-emerald-100 text-emerald-800'
  return 'bg-slate-100 text-slate-600'
}

function classeUrgencia(urgencia: string) {
  if (urgencia === 'critica') return 'bg-red-100 text-red-800'
  if (urgencia === 'alta') return 'bg-orange-100 text-orange-800'
  if (urgencia === 'media') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

export default function MelhoriasAtlasPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [itens, setItens] = useState<Melhoria[]>([])
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('abertos')
  const [nota, setNota] = useState('')

  const selecionado = itens.find(i => i.id === selecionadoId) || null

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const [u, token] = await Promise.all([usuarioAtual(), tokenAtual()])
      setUsuario(u)
      if (!u || u.role !== 'master') {
        setItens([])
        return
      }

      const r = await fetch('/api/ia/melhorias', {
        headers: { Authorization: 'Bearer ' + (token || '') },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível carregar as melhorias.')

      const lista = Array.isArray(j.itens) ? j.itens : []
      setItens(lista)
      setSelecionadoId(atual => atual || lista[0]?.id || null)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar Melhorias Atlas.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  useEffect(() => {
    setNota(selecionado?.observacoes_admin || '')
  }, [selecionadoId, selecionado?.observacoes_admin])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter(item => {
      if (filtroStatus === 'abertos' && ['publicado', 'rejeitado'].includes(item.status)) return false
      if (filtroStatus !== 'todos' && filtroStatus !== 'abertos' && item.status !== filtroStatus) return false
      if (!termo) return true
      return [
        item.titulo, item.descricao, item.criado_por_nome, item.area,
        String(item.numero), item.tipo, item.status,
      ].some(v => String(v || '').toLowerCase().includes(termo))
    })
  }, [itens, busca, filtroStatus])

  const totais = useMemo(() => ({
    abertos: itens.filter(i => !['publicado', 'rejeitado'].includes(i.status)).length,
    aguardando: itens.filter(i => i.status === 'aguardando_aprovacao').length,
    evolucao: itens.filter(i =>
      ['aprovado', 'em_desenvolvimento', 'teste', 'pronto_publicar'].includes(i.status)
    ).length,
    publicados: itens.filter(i => i.status === 'publicado').length,
  }), [itens])

  async function atualizar(id: string, patch: Record<string, any>) {
    setSalvando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/ia/melhorias', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({ id, ...patch }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível atualizar.')
      setItens(prev => prev.map(i => i.id === id ? j.item : i))
    } catch (e: any) {
      setErro(e?.message || 'Erro ao atualizar melhoria.')
    } finally {
      setSalvando(false)
    }
  }

  if (!carregando && usuario && usuario.role !== 'master') {
    return <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 text-amber-600" size={34}/>
        <h1 className="text-xl font-semibold">Melhorias Atlas</h1>
        <p className="mt-2 text-sm text-slate-500">
          A administração das melhorias é exclusiva do usuário Master.
        </p>
        <Link href="/atlas-ia" className="mt-5 inline-flex rounded-xl bg-[#182444] px-4 py-2 text-sm font-semibold text-white">
          Voltar ao Atlas IA
        </Link>
      </div>
    </main>
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft size={20}/>
          </Link>
          <div>
            <h1 className="font-semibold">Melhorias Atlas</h1>
            <p className="text-xs text-slate-500">
              Defeitos, sugestões, análise da IA, aprovação e acompanhamento.
            </p>
          </div>
        </div>
        <button
          onClick={() => void carregar()}
          disabled={carregando}
          className="rounded-xl border p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          title="Atualizar"
        >
          <RefreshCcw size={18} className={carregando ? 'animate-spin' : ''}/>
        </button>
      </div>
    </header>

    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-slate-500">Abertos</p><b className="text-2xl">{totais.abertos}</b>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-slate-500">Aguardando aprovação</p><b className="text-2xl">{totais.aguardando}</b>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-slate-500">Em evolução</p><b className="text-2xl">{totais.evolucao}</b>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-slate-500">Publicados</p><b className="text-2xl">{totais.publicados}</b>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={17} className="text-slate-400"/>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar número, título, usuário ou área..."
            className="w-full border-0 py-2.5 text-sm outline-none"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="rounded-xl border bg-white px-3 py-2.5 text-sm"
        >
          <option value="abertos">Abertos</option>
          <option value="todos">Todos</option>
          {STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      {erro && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {carregando && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
        <Loader2 size={18} className="animate-spin"/> Carregando melhorias...
      </div>}

      {!carregando && <div className="grid gap-4 lg:grid-cols-[390px_1fr]">
        <section className="max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto rounded-2xl border bg-white p-3">
          {filtrados.length === 0 && <div className="p-8 text-center text-sm text-slate-400">
            Nenhuma solicitação neste filtro.
          </div>}
          {filtrados.map(item => {
            const ativo = item.id === selecionadoId
            return <button
              key={item.id}
              onClick={() => setSelecionadoId(item.id)}
              className={'w-full rounded-xl border p-3 text-left transition ' +
                (ativo ? 'border-[#182444] bg-slate-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">#{item.numero}</span>
                <span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + classeRisco(item.risco)}>
                  Risco {item.risco.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                {item.tipo === 'bug'
                  ? <Bug size={16} className="mt-0.5 shrink-0 text-red-600"/>
                  : <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-600"/>}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold">{item.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.criado_por_nome || 'Usuário'} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                  {labelStatus(item.status)}
                </span>
                <span className={'rounded-full px-2 py-0.5 text-[10px] ' + classeUrgencia(item.urgencia)}>
                  Urgência {item.urgencia}
                </span>
                {item.relatos_count > 1 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                  {item.relatos_count} relatos
                </span>}
              </div>
            </button>
          })}
        </section>

        <section className="min-h-[560px] rounded-2xl border bg-white">
          {!selecionado && <div className="flex min-h-[560px] items-center justify-center p-8 text-center text-sm text-slate-400">
            Selecione uma melhoria para analisar.
          </div>}

          {selecionado && <div>
            <div className="border-b p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>#{selecionado.numero}</span><span>·</span>
                    <span>{selecionado.tipo.toUpperCase()}</span><span>·</span>
                    <span>{selecionado.relatos_count} relato(s)</span>
                  </div>
                  <h2 className="mt-1 text-xl font-semibold">{selecionado.titulo}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Enviado por {selecionado.criado_por_nome || 'Usuário'} em {new Date(selecionado.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <select
                  value={selecionado.status}
                  onChange={e => void atualizar(selecionado.id, { status: e.target.value })}
                  disabled={salvando}
                  className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
                >
                  {STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-400">Risco</p>
                  <select
                    value={selecionado.risco}
                    onChange={e => void atualizar(selecionado.id, { risco: e.target.value })}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                  >
                    {['nao_avaliado', 'baixo', 'medio', 'alto', 'critico'].map(v =>
                      <option key={v} value={v}>{v.replace('_', ' ')}</option>
                    )}
                  </select>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-400">Urgência</p>
                  <select
                    value={selecionado.urgencia}
                    onChange={e => void atualizar(selecionado.id, { urgencia: e.target.value })}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                  >
                    {['baixa', 'media', 'alta', 'critica'].map(v =>
                      <option key={v} value={v}>{v}</option>
                    )}
                  </select>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-400">Aprovação</p>
                  <p className="mt-1 text-sm font-semibold">{selecionado.aprovacao_status}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Relato do usuário</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  {selecionado.descricao}
                </p>
                {selecionado.tela && <p className="mt-2 break-all text-xs text-slate-500">
                  Tela: {selecionado.tela}
                </p>}
              </div>

              {(selecionado.anexo_url || selecionado.audio_url) && <div>
                <h3 className="mb-2 text-sm font-semibold">Anexos</h3>
                <div className="flex flex-wrap gap-2">
                  {selecionado.anexo_url && <a
                    href={selecionado.anexo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                  >
                    <Paperclip size={14}/>{selecionado.anexo_nome || 'Abrir anexo'}<ExternalLink size={12}/>
                  </a>}
                  {selecionado.audio_url && <div className="rounded-xl border p-2">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Volume2 size={13}/> Áudio do relato
                    </div>
                    <audio controls src={selecionado.audio_url} className="h-8 max-w-full"/>
                  </div>}
                </div>
              </div>}

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-indigo-900">
                  <Sparkles size={17}/> Análise da IA
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase text-indigo-400">Impacto</p>
                    <p className="mt-1 text-sm text-indigo-950">{selecionado.impacto || 'Não informado.'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-indigo-400">Área</p>
                    <p className="mt-1 text-sm text-indigo-950">{selecionado.area || 'Não identificada.'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-indigo-400">Resultado atual</p>
                    <p className="mt-1 text-sm text-indigo-950">{selecionado.resultado_atual || 'Não se aplica.'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-indigo-400">Resultado esperado</p>
                    <p className="mt-1 text-sm text-indigo-950">{selecionado.resultado_esperado || 'Não informado.'}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-indigo-100 pt-3">
                  <p className="text-[11px] uppercase text-indigo-400">Risco / recomendação</p>
                  <p className="mt-1 text-sm text-indigo-950">
                    {selecionado.justificativa_risco || 'Sem justificativa.'}
                  </p>
                  {selecionado.analise_ia?.recomendacao && <p className="mt-2 text-sm font-medium text-indigo-950">
                    {selecionado.analise_ia.recomendacao}
                  </p>}
                </div>
              </div>

              {selecionado.aprovacao_status === 'pendente' && <div className="flex flex-wrap gap-2 rounded-2xl border bg-slate-50 p-4">
                <button
                  disabled={salvando}
                  onClick={() => void atualizar(selecionado.id, { status: 'aprovado' })}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <CheckCircle2 size={17}/> Aprovar para desenvolvimento
                </button>
                <button
                  disabled={salvando}
                  onClick={() => void atualizar(selecionado.id, { status: 'rejeitado' })}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
                >
                  <XCircle size={17}/> Rejeitar
                </button>
                <p className="w-full text-xs text-slate-500">
                  Aprovar não publica nada. Apenas libera a solicitação para desenvolvimento e testes.
                </p>
              </div>}

              <div>
                <h3 className="text-sm font-semibold">Observações administrativas</h3>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={4}
                  placeholder="Decisão, contexto, orientação para desenvolvimento, motivo de rejeição..."
                  className="mt-2 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
                <button
                  disabled={salvando}
                  onClick={() => void atualizar(selecionado.id, { observacoes_admin: nota })}
                  className="mt-2 rounded-xl bg-[#182444] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {salvando ? 'Salvando...' : 'Salvar observações'}
                </button>
              </div>

              {selecionado.aprovado_por_nome && <p className="text-xs text-slate-400">
                Decisão por {selecionado.aprovado_por_nome}
                {selecionado.aprovado_em
                  ? ' em ' + new Date(selecionado.aprovado_em).toLocaleString('pt-BR')
                  : ''}
              </p>}
            </div>
          </div>}
        </section>
      </div>}
    </div>
  </main>
}
