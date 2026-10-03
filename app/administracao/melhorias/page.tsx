'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Melhoria = {
  id: string
  numero: number
  tipo: 'bug' | 'melhoria' | 'ideia'
  titulo: string
  descricao: string
  tela?: string | null
  area?: string | null
  resultado_atual?: string | null
  resultado_esperado?: string | null
  impacto?: string | null
  urgencia: string
  status: string
  risco: string
  exige_aprovacao: boolean
  justificativa_risco?: string | null
  analise_ia?: any
  aprovacao_status: string
  criado_por_nome?: string | null
  observacoes_admin?: string | null
  relatos_count?: number
  created_at: string
  updated_at: string
  eventos?: any[]
}

const STATUS: Record<string, string> = {
  novo: 'Novo',
  ia_analisando: 'IA analisando',
  informacao_necessaria: 'Informação necessária',
  solucao_proposta: 'Solução proposta',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  em_desenvolvimento: 'Em desenvolvimento',
  teste: 'Em teste',
  pronto_publicar: 'Pronto para publicar',
  publicado: 'Publicado',
  rejeitado: 'Rejeitado',
}

const RISCO: Record<string, string> = {
  nao_avaliado: 'Não avaliado',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
}

function dataHora(valor: string) {
  if (!valor) return ''
  return new Date(valor).toLocaleString('pt-BR')
}
export default function MelhoriasAtlasPage() {
  const [itens, setItens] = useState<Melhoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const usuario = await usuarioAtual()
      if (!usuario || usuario.role !== 'master') {
        throw new Error('Esta central é exclusiva do usuário Master.')
      }
      const token = await tokenAtual()
      const r = await fetch('/api/ia/melhorias', {
        headers: { Authorization: 'Bearer ' + (token || '') },
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível carregar as melhorias.')
      setItens(j.melhorias || [])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar melhorias.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function atualizar(id: string, alteracao: Record<string, unknown>) {
    setSalvando(id)
    setErro('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/ia/melhorias/' + id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify(alteracao),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível atualizar.')
      setItens(prev => prev.map(item => item.id === id ? { ...item, ...j.melhoria } : item))
    } catch (e: any) {
      setErro(e?.message || 'Erro ao atualizar melhoria.')
    } finally {
      setSalvando(null)
    }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter(item => {
      if (filtroStatus !== 'todos' && item.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false
      if (!termo) return true
      return [
        item.titulo,
        item.descricao,
        item.tela,
        item.area,
        item.criado_por_nome,
      ].some(v => String(v || '').toLowerCase().includes(termo))
    })
  }, [itens, filtroStatus, filtroTipo, busca])

  const resumo = useMemo(() => ({
    total: itens.length,
    aguardando: itens.filter(i => i.status === 'aguardando_aprovacao').length,
    desenvolvimento: itens.filter(i => ['aprovado', 'em_desenvolvimento', 'teste', 'pronto_publicar'].includes(i.status)).length,
    publicados: itens.filter(i => i.status === 'publicado').length,
  }), [itens])
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/administracao" className="mt-0.5 rounded-xl border bg-white p-2 text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={18}/>
          </Link>
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
              <Sparkles size={13}/> Melhoria contínua
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Melhorias Atlas</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Bugs, melhorias e ideias relatados pelos usuários no Atlas IA. A triagem organiza risco e necessidade de aprovação antes do desenvolvimento.
            </p>
          </div>
        </div>
        <button
          onClick={() => void carregar()}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={carregando ? 'animate-spin' : ''}/> Atualizar
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard titulo="Total" valor={resumo.total} icone={<Lightbulb size={18}/>}/>
        <ResumoCard titulo="Aguardando aprovação" valor={resumo.aguardando} icone={<Clock3 size={18}/>}/>
        <ResumoCard titulo="Em andamento" valor={resumo.desenvolvimento} icone={<ShieldCheck size={18}/>}/>
        <ResumoCard titulo="Publicados" valor={resumo.publicados} icone={<CheckCircle2 size={18}/>}/>
      </div>

      <div className="mb-4 grid gap-2 rounded-2xl border bg-white p-3 shadow-sm md:grid-cols-[1fr_210px_190px]">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por título, tela, área ou usuário..."
          className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="todos">Todos os tipos</option>
          <option value="bug">Bug / defeito</option>
          <option value="melhoria">Melhoria</option>
          <option value="ideia">Ideia</option>
        </select>
      </div>

      {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {carregando ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 size={18} className="animate-spin"/> Carregando melhorias...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
          Nenhuma melhoria encontrada com estes filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(item => {
            const expandido = aberto === item.id
            const ocupado = salvando === item.id
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : item.id)}
                  className="w-full p-4 text-left hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{item.numero}</span>
                        <TipoBadge tipo={item.tipo}/>
                        <RiscoBadge risco={item.risco}/>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{STATUS[item.status] || item.status}</span>
                        {Number(item.relatos_count || 1) > 1 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {item.relatos_count} relatos
                          </span>
                        )}
                      </div>
                      <h2 className="font-semibold text-slate-900">{item.titulo}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.descricao}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-400">
                      <div>{item.criado_por_nome || 'Usuário'}</div>
                      <div>{dataHora(item.created_at)}</div>
                    </div>
                  </div>
                </button>
                {expandido && (
                  <div className="border-t bg-slate-50/60 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="space-y-4">
                        <Bloco titulo="Relato">
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{item.descricao}</p>
                        </Bloco>

                        {(item.tela || item.area) && (
                          <Bloco titulo="Onde acontece">
                            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                              {item.area && <span><b>Área:</b> {item.area}</span>}
                              {item.tela && <span><b>Tela:</b> {item.tela}</span>}
                            </div>
                          </Bloco>
                        )}

                        {(item.resultado_atual || item.resultado_esperado) && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Bloco titulo="Hoje">
                              <p className="whitespace-pre-wrap text-sm text-slate-600">{item.resultado_atual || 'Não informado.'}</p>
                            </Bloco>
                            <Bloco titulo="Esperado">
                              <p className="whitespace-pre-wrap text-sm text-slate-600">{item.resultado_esperado || 'Não informado.'}</p>
                            </Bloco>
                          </div>
                        )}

                        <Bloco titulo="Triagem da IA">
                          <div className="space-y-2 text-sm text-slate-600">
                            <p><b>Risco:</b> {RISCO[item.risco] || item.risco}</p>
                            <p><b>Fluxo:</b> {item.exige_aprovacao ? 'Exige aprovação antes do desenvolvimento.' : 'Baixo risco: pode ser preparado; publicação ainda exige validação.'}</p>
                            {item.justificativa_risco && <p><b>Motivo:</b> {item.justificativa_risco}</p>}
                            {item.analise_ia?.recomendacao && <p><b>Recomendação:</b> {item.analise_ia.recomendacao}</p>}
                            {item.impacto && <p><b>Impacto informado:</b> {item.impacto}</p>}
                          </div>
                        </Bloco>

                        {item.eventos && item.eventos.length > 0 && (
                          <Bloco titulo="Histórico">
                            <div className="space-y-2">
                              {item.eventos.slice(0, 6).map((evento: any) => (
                                <div key={evento.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-xs text-slate-500 last:border-0">
                                  <span><b>{evento.usuario_nome || 'Sistema'}</b> · {evento.evento}</span>
                                  <span>{dataHora(evento.created_at)}</span>
                                </div>
                              ))}
                            </div>
                          </Bloco>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border bg-white p-4">
                          <h3 className="text-sm font-semibold text-slate-900">Decisão</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Aprovar libera o item para desenvolvimento. Publicar continua sendo uma etapa separada.
                          </p>
                          <div className="mt-3 grid gap-2">
                            <button
                              disabled={ocupado}
                              onClick={() => void atualizar(item.id, { aprovacao_status: 'aprovado' })}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 size={16}/> Aprovar para desenvolvimento
                            </button>
                            <button
                              disabled={ocupado}
                              onClick={() => void atualizar(item.id, { aprovacao_status: 'rejeitado' })}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              <XCircle size={16}/> Rejeitar
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-white p-4">
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
                          <select
                            value={item.status}
                            disabled={ocupado}
                            onChange={e => void atualizar(item.id, { status: e.target.value })}
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                          >
                            {Object.entries(STATUS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                          </select>

                          <label className="mb-1 mt-3 block text-xs font-semibold text-slate-600">Risco</label>
                          <select
                            value={item.risco}
                            disabled={ocupado}
                            onChange={e => void atualizar(item.id, { risco: e.target.value })}
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                          >
                            {Object.entries(RISCO).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                          </select>
                        </div>

                        <ObservacaoAdmin item={item} ocupado={ocupado} onSalvar={texto => atualizar(item.id, { observacoes_admin: texto })}/>

                        {ocupado && (
                          <div className="flex items-center justify-center gap-2 rounded-xl bg-white p-3 text-xs text-slate-500">
                            <Loader2 size={14} className="animate-spin"/> Salvando...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
function ResumoCard({ titulo, valor, icone }: { titulo: string; valor: number; icone: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{titulo}</span>
        <span className="text-slate-400">{icone}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{valor}</div>
    </div>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === 'bug') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><Bug size={11}/> Bug</span>
  }
  if (tipo === 'ideia') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Lightbulb size={11}/> Ideia</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"><Sparkles size={11}/> Melhoria</span>
}

function RiscoBadge({ risco }: { risco: string }) {
  const classe = risco === 'critico'
    ? 'bg-red-100 text-red-800'
    : risco === 'alto'
      ? 'bg-orange-100 text-orange-800'
      : risco === 'medio'
        ? 'bg-amber-100 text-amber-800'
        : risco === 'baixo'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-100 text-slate-600'
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ' + classe}>
      <AlertTriangle size={11}/>{RISCO[risco] || risco}
    </span>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h3>
      {children}
    </div>
  )
}

function ObservacaoAdmin({
  item,
  ocupado,
  onSalvar,
}: {
  item: Melhoria
  ocupado: boolean
  onSalvar: (texto: string) => Promise<void>
}) {
  const [textoObs, setTextoObs] = useState(item.observacoes_admin || '')

  useEffect(() => {
    setTextoObs(item.observacoes_admin || '')
  }, [item.observacoes_admin])

  return (
    <div className="rounded-2xl border bg-white p-4">
      <label className="mb-2 block text-xs font-semibold text-slate-600">Observação do Master</label>
      <textarea
        value={textoObs}
        onChange={e => setTextoObs(e.target.value)}
        rows={4}
        placeholder="Análise, orientação para desenvolvimento, motivo da decisão..."
        className="w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
      />
      <button
        disabled={ocupado || textoObs === (item.observacoes_admin || '')}
        onClick={() => void onSalvar(textoObs)}
        className="mt-2 w-full rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        Salvar observação
      </button>
    </div>
  )
}