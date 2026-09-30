'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type RecursoMapa = {
  recurso: string
  grupo: string
  endpoint: string
  prioridade: 'maxima' | 'alta' | 'media' | 'baixa'
  status: 'preparado_leitura' | 'parcial' | 'planejado'
  loteMaxDias: number | null
  destinosAtlas: string[]
  chaveExterna: string[]
  estrategia: string
}

type PessoaReconciliada = {
  chaveExterna: string
  pessoaId: string | null
  pessoaCodigo: string | null
  nome: string
  cpfCnpj: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  cidade: string | null
  status:
    | 'vinculado_seguro'
    | 'sugestao_forte'
    | 'revisao'
    | 'divergente'
    | 'novo'
    | 'ignorado_nao_cliente'
  clienteAtlasId: string | null
  clienteAtlasNome: string | null
  metodo: string | null
  motivos: string[]
}

type Reconciliacao = {
  regra: string
  totais: Record<PessoaReconciliada['status'], number>
  itens: PessoaReconciliada[]
  truncado: boolean
}

async function apiPreview(params: URLSearchParams) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente.')
  const resp = await fetch(
    `/api/integracoes/wvetro/migracao-operacional/preview?${params.toString()}`,
    {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha na integração (${resp.status}).`)
  return json
}

function badgePrioridade(prioridade: RecursoMapa['prioridade']) {
  const cls =
    prioridade === 'maxima'
      ? 'bg-red-50 text-red-700 border-red-200'
      : prioridade === 'alta'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : prioridade === 'media'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${cls}`}>
      {prioridade}
    </span>
  )
}

function badgePessoa(status: PessoaReconciliada['status']) {
  const mapa: Record<PessoaReconciliada['status'], [string, string]> = {
    vinculado_seguro: ['Vínculo seguro', 'bg-emerald-50 text-emerald-700'],
    sugestao_forte: ['Sugestão forte', 'bg-blue-50 text-blue-700'],
    revisao: ['Revisar', 'bg-amber-50 text-amber-700'],
    divergente: ['Divergente', 'bg-red-50 text-red-700'],
    novo: ['Novo', 'bg-violet-50 text-violet-700'],
    ignorado_nao_cliente: ['Não cliente', 'bg-slate-100 text-slate-600'],
  }
  const [label, cls] = mapa[status]
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>
}

export default function MigracaoOperacionalWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recursos, setRecursos] = useState<RecursoMapa[]>([])
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [analisandoPessoas, setAnalisandoPessoas] = useState(false)
  const [reconciliacao, setReconciliacao] = useState<Reconciliacao | null>(null)

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
        const json = await apiPreview(new URLSearchParams({ recurso: 'mapa' }))
        if (!ativo) return
        setRecursos(Array.isArray(json.recursos) ? json.recursos : [])
        setPronto(!!json?.configuracao?.pronto)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o mapa.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    iniciar()
    return () => {
      ativo = false
    }
  }, [])

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, RecursoMapa[]>()
    for (const item of recursos) {
      const lista = mapa.get(item.grupo) || []
      lista.push(item)
      mapa.set(item.grupo, lista)
    }
    return Array.from(mapa.entries())
  }, [recursos])

  async function analisarPessoas() {
    setAnalisandoPessoas(true)
    setErro('')
    setReconciliacao(null)

    try {
      const json = await apiPreview(
        new URLSearchParams({ recurso: 'pessoas', reconciliar: '1' }),
      )
      setReconciliacao(json.reconciliacao || null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao reconciliar Pessoas.')
    } finally {
      setAnalisandoPessoas(false)
    }
  }

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Migração operacional W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Área restrita ao usuário Master.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <Link
            href="/configuracoes/integracoes/wvetro"
            className="inline-flex items-center gap-2 text-sm text-slate-600"
          >
            <ArrowLeft size={16} /> Integração W.Vetro
          </Link>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Migração operacional W.Vetro → Atlas</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Conferência, reconciliação e preparação do staging. Nesta tela nada é promovido para
                Cliente 360, Financeiro, Compras, Estoque ou Produção.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
              <ShieldCheck size={26} />
            </div>
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-5 text-sm text-slate-500">
            <Loader2 size={17} className="animate-spin" /> Carregando mapa operacional...
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Database size={18} className="text-blue-700" />
                <div className="mt-3 text-xs text-slate-500">Recursos mapeados</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{recursos.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {pronto ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600" />
                )}
                <div className="mt-3 text-xs text-slate-500">API W.Vetro</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {pronto ? 'Credenciais configuradas' : 'Configuração incompleta'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div className="mt-3 text-xs text-slate-500">Modo atual</div>
                <div className="mt-1 text-lg font-bold text-slate-900">Somente leitura / dry-run</div>
              </div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users size={19} className="text-blue-700" />
                    <h2 className="font-semibold text-slate-900">1. Pessoas → Cliente 360</h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Compara Pessoas do W.Vetro com os clientes atuais. CPF/CNPJ exato e único é o único
                    vínculo seguro automático nesta fase.
                  </p>
                </div>
                <button
                  onClick={analisarPessoas}
                  disabled={analisandoPessoas || !pronto}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {analisandoPessoas ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {analisandoPessoas ? 'Analisando...' : 'Analisar Pessoas'}
                </button>
              </div>

              {reconciliacao && (
                <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Vínculo seguro', reconciliacao.totais.vinculado_seguro],
                      ['Sugestão forte', reconciliacao.totais.sugestao_forte],
                      ['Revisar', reconciliacao.totais.revisao],
                      ['Divergente', reconciliacao.totais.divergente],
                      ['Novo', reconciliacao.totais.novo],
                      ['Não cliente', reconciliacao.totais.ignorado_nao_cliente],
                    ].map(([label, total]) => (
                      <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{label}</div>
                        <div className="mt-1 text-xl font-bold text-slate-900">{total}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[1050px] text-sm">
                      <thead className="bg-slate-100 text-left text-xs text-slate-600">
                        <tr>
                          <th className="px-3 py-2">W.Vetro</th>
                          <th className="px-3 py-2">CPF/CNPJ</th>
                          <th className="px-3 py-2">Contato</th>
                          <th className="px-3 py-2">Cidade</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Cliente Atlas</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliacao.itens.map(item => (
                          <tr key={item.chaveExterna} className="border-t border-slate-100 align-top">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{item.nome || 'Sem nome'}</div>
                              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                                {item.chaveExterna}
                              </div>
                            </td>
                            <td className="px-3 py-2">{item.cpfCnpj || '—'}</td>
                            <td className="px-3 py-2 text-xs">
                              <div>{item.celular || item.telefone || '—'}</div>
                              <div className="text-slate-500">{item.email || ''}</div>
                            </td>
                            <td className="px-3 py-2">{item.cidade || '—'}</td>
                            <td className="px-3 py-2">{badgePessoa(item.status)}</td>
                            <td className="px-3 py-2 font-medium">
                              {item.clienteAtlasNome || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {item.motivos.join(' ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {reconciliacao.truncado && (
                    <p className="mt-2 text-xs text-slate-500">
                      A prévia mostra no máximo 100 registros; os totais consideram toda a resposta.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="font-semibold text-slate-900">Mapa completo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Cada bloco abaixo informa a fonte W.Vetro, o destino Atlas e a regra de migração.
                </p>
              </div>

              {porGrupo.map(([grupo, itens]) => (
                <div key={grupo} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900">{grupo}</h3>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {itens.map(item => (
                      <div key={item.recurso} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800">{item.recurso}</div>
                            <div className="mt-1 font-mono text-[11px] text-slate-500">{item.endpoint}</div>
                          </div>
                          {badgePrioridade(item.prioridade)}
                        </div>
                        <div className="mt-3 text-xs text-slate-600">
                          <b>Destino:</b> {item.destinosAtlas.join(', ')}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          <b>Chave:</b> {item.chaveExterna.join(', ')}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{item.estrategia}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <b>Gate atual:</b> nenhum dado é promovido para tabelas oficiais. A próxima mudança de
              estado será somente a criação do staging em ambiente Supabase isolado; depois disso a
              captura continuará separada do Cliente 360 até conferência.
            </section>
          </>
        )}
      </div>
    </main>
  )
}
