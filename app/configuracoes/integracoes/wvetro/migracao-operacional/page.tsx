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

type NeonStagingResumo = {
  orcamentos?: number
  clientes_cl?: number
  producao_projeto?: number
  execucoes_concluidas?: number
  clientes_vinculados?: number
  sugestoes_fortes?: number
  sugestoes_revisao?: number
  clientes_novos?: number
  clientes_divergentes?: number
  auditoria_relacoes?: number
  auditoria_encontradas?: number
  auditoria_ausentes?: number
  auditoria_pendencias_reais?: number
  ultima_captura?: string | null
  erro?: string
}

type NeonStagingInfo = {
  provedor: 'neon'
  configurado: boolean
  env: string
  host: string | null
  database: string | null
  teste?: { ok?: boolean; schemaPronto?: boolean; database?: string | null; error?: string } | null
  resumo?: NeonStagingResumo | null
}

type AuditoriaRelacao = {
  origemRecurso: string
  origemChave: string
  tipoRelacao: string
  destinoRecurso: string
  destinoChave: string
  referencia: string | null
  encontrado: boolean
  confianca: string
  regra: string
  classificacao: string
  explicacao: string
  requerAtencao: boolean
}

type AuditoriaOpcoes = {
  origens: string[]
  relacoes: string[]
  confiancas: string[]
  classificacoes: string[]
}

type PlanoPromocaoItem = {
  tipo: string
  total: number
  clienteSeguro: number
  bloqueados: number
  clientePromovidoRevisado: number
  clienteExistenteSeguro: number
  bloqueadoSemDocumento: number
  bloqueadoSemPessoaCl: number
  bloqueadoDocAmbiguo: number
  bloqueadoSugestao: number
  bloqueadoClienteNovo: number
  bloqueadoSemVinculo: number
}

type PlanoPromocao = {
  ok: boolean
  modo: 'dry-run'
  resumo: {
    total: number
    clienteSeguro: number
    bloqueados: number
    vendas: { total: number; clienteSeguro: number; bloqueados: number }
    orcamentos: { total: number; clienteSeguro: number; bloqueados: number }
  }
  itens: PlanoPromocaoItem[]
  duplicacoesPedidoOrcamento: number
  politica: {
    prontoSignifica: string
    pedidoPrevalece: string
    historicoSemWorkflow: boolean
    fluxoVendaNormalPermitido: boolean
    motivoFluxoVendaNormalBloqueado: string
  }
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

function rotuloAuditoria(classificacao: string) {
  const mapa: Record<string, string> = {
    confirmada: 'Confirmada',
    informativa: 'Informativa',
    reconstruivel_baixa: 'Reconstruível pela baixa',
    sem_referencia: 'Sem referência válida',
    resolvida_por_pedido: 'Resolvida por pedido',
    resolvida_por_lote: 'Resolvida pelo lote',
    pendente_revisao: 'Pendente de revisão',
  }
  return mapa[classificacao] || classificacao
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
  const [neon, setNeon] = useState<NeonStagingInfo | null>(null)
  const [erro, setErro] = useState('')
  const [analisandoPessoas, setAnalisandoPessoas] = useState(false)
  const [reconciliacao, setReconciliacao] = useState<Reconciliacao | null>(null)
  const [planoPromocao, setPlanoPromocao] = useState<PlanoPromocao | null>(null)
  const [filaAberta, setFilaAberta] = useState(false)
  const [filaCarregando, setFilaCarregando] = useState(false)
  const [filaItens, setFilaItens] = useState<PessoaReconciliada[]>([])
  const [filaFiltro, setFilaFiltro] = useState('todos')
  const [filaBusca, setFilaBusca] = useState('')
  const [filaPagina, setFilaPagina] = useState(1)
  const [filaPaginas, setFilaPaginas] = useState(1)
  const [filaTotal, setFilaTotal] = useState(0)
  const [auditoriaAberta, setAuditoriaAberta] = useState(false)
  const [auditoriaCarregando, setAuditoriaCarregando] = useState(false)
  const [auditoriaItens, setAuditoriaItens] = useState<AuditoriaRelacao[]>([])
  const [auditoriaOpcoes, setAuditoriaOpcoes] = useState<AuditoriaOpcoes>({
    origens: [],
    relacoes: [],
    confiancas: [],
    classificacoes: [],
  })
  const [auditoriaOrigem, setAuditoriaOrigem] = useState('todos')
  const [auditoriaRelacao, setAuditoriaRelacao] = useState('todos')
  const [auditoriaSituacao, setAuditoriaSituacao] = useState('todos')
  const [auditoriaConfianca, setAuditoriaConfianca] = useState('todos')
  const [auditoriaClassificacao, setAuditoriaClassificacao] = useState('todos')
  const [auditoriaBusca, setAuditoriaBusca] = useState('')
  const [auditoriaPagina, setAuditoriaPagina] = useState(1)
  const [auditoriaPaginas, setAuditoriaPaginas] = useState(1)
  const [auditoriaTotal, setAuditoriaTotal] = useState(0)

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
        const [json, plano] = await Promise.all([
          apiPreview(new URLSearchParams({ recurso: 'mapa' })),
          apiPreview(new URLSearchParams({ recurso: 'plano-promocao' })),
        ])
        if (!ativo) return
        setRecursos(Array.isArray(json.recursos) ? json.recursos : [])
        setPronto(!!json?.configuracao?.pronto)
        setNeon(json?.staging || null)
        setPlanoPromocao(plano?.ok ? plano as PlanoPromocao : null)
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

  async function carregarAuditoria(
    pagina = 1,
    overrides?: Partial<{
      origem: string
      relacao: string
      situacao: string
      confianca: string
      classificacao: string
      busca: string
    }>,
  ) {
    setAuditoriaCarregando(true)
    setErro('')

    const origem = overrides?.origem ?? auditoriaOrigem
    const relacao = overrides?.relacao ?? auditoriaRelacao
    const situacao = overrides?.situacao ?? auditoriaSituacao
    const confianca = overrides?.confianca ?? auditoriaConfianca
    const classificacao = overrides?.classificacao ?? auditoriaClassificacao
    const busca = overrides?.busca ?? auditoriaBusca

    try {
      const params = new URLSearchParams({
        recurso: 'auditoria-relacoes',
        origem,
        relacao,
        situacao,
        confianca,
        classificacao,
        pagina: String(pagina),
        limite: '50',
      })
      if (busca.trim()) params.set('busca', busca.trim())

      const json = await apiPreview(params)
      setAuditoriaAberta(true)
      setAuditoriaOrigem(origem)
      setAuditoriaRelacao(relacao)
      setAuditoriaSituacao(situacao)
      setAuditoriaConfianca(confianca)
      setAuditoriaClassificacao(classificacao)
      setAuditoriaBusca(busca)
      setAuditoriaPagina(Number(json.pagina || pagina))
      setAuditoriaPaginas(Number(json.paginas || 1))
      setAuditoriaTotal(Number(json.total || 0))
      setAuditoriaItens(Array.isArray(json.itens) ? json.itens : [])
      setAuditoriaOpcoes({
        origens: Array.isArray(json?.opcoes?.origens) ? json.opcoes.origens : [],
        relacoes: Array.isArray(json?.opcoes?.relacoes) ? json.opcoes.relacoes : [],
        confiancas: Array.isArray(json?.opcoes?.confiancas) ? json.opcoes.confiancas : [],
        classificacoes: Array.isArray(json?.opcoes?.classificacoes) ? json.opcoes.classificacoes : [],
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar auditoria de relações.')
    } finally {
      setAuditoriaCarregando(false)
    }
  }

  async function carregarFilaStaging(
    status = filaFiltro,
    pagina = 1,
    busca = filaBusca,
  ) {
    setFilaCarregando(true)
    setErro('')

    try {
      const params = new URLSearchParams({
        recurso: 'staging-clientes',
        status,
        pagina: String(pagina),
        limite: '50',
      })
      if (busca.trim()) params.set('busca', busca.trim())

      const json = await apiPreview(params)
      setFilaAberta(true)
      setFilaFiltro(status)
      setFilaPagina(Number(json.pagina || pagina))
      setFilaPaginas(Number(json.paginas || 1))
      setFilaTotal(Number(json.total || 0))
      setFilaItens(Array.isArray(json.itens) ? json.itens : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar fila persistida do staging.')
    } finally {
      setFilaCarregando(false)
    }
  }

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
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                {neon?.configurado ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600" />
                )}
                <div className="mt-3 text-xs text-slate-500">Staging Neon</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {neon?.configurado ? 'Conexão configurada' : 'Aguardando DATABASE_URL'}
                </div>
                {neon?.host && <div className="mt-1 truncate text-[10px] text-slate-400">{neon.host}</div>}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div className="mt-3 text-xs text-slate-500">Modo atual</div>
                <div className="mt-1 text-lg font-bold text-slate-900">Somente leitura / dry-run</div>
              </div>
            </section>

            {neon?.resumo && !neon.resumo.erro && (
              <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database size={19} className="text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Staging Neon — carga persistida</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Dados já capturados do W.Vetro e mantidos isolados. Nenhum item abaixo foi
                      promovido automaticamente para as tabelas oficiais do Atlas.
                    </p>
                  </div>
                  {neon.resumo.ultima_captura && (
                    <div className="text-right text-[11px] text-slate-500">
                      Última captura
                      <div className="mt-0.5 font-medium text-slate-700">
                        {new Date(neon.resumo.ultima_captura).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ['Orçamentos', neon.resumo.orcamentos ?? 0],
                    ['Clientes CL', neon.resumo.clientes_cl ?? 0],
                    ['Produção', neon.resumo.producao_projeto ?? 0],
                    ['Execuções concluídas', neon.resumo.execucoes_concluidas ?? 0],
                  ].map(([label, total]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] text-slate-500">{label}</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{total}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reconciliação dos clientes CL
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      ['Vinculados', neon.resumo.clientes_vinculados ?? 0, 'text-emerald-700'],
                      ['Sugestões fortes', neon.resumo.sugestoes_fortes ?? 0, 'text-blue-700'],
                      ['Revisar', neon.resumo.sugestoes_revisao ?? 0, 'text-amber-700'],
                      ['Novos', neon.resumo.clientes_novos ?? 0, 'text-violet-700'],
                      ['Divergentes', neon.resumo.clientes_divergentes ?? 0, 'text-red-700'],
                    ].map(([label, total, cls]) => (
                      <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-[11px] text-slate-500">{label}</div>
                        <div className={`mt-1 text-xl font-bold ${cls}`}>{total}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Relações auditadas</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {neon.resumo.auditoria_relacoes ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[11px] text-emerald-700">Relações encontradas</div>
                    <div className="mt-1 text-xl font-bold text-emerald-800">
                      {neon.resumo.auditoria_encontradas ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] text-amber-700">Ausências brutas</div>
                    <div className="mt-1 text-xl font-bold text-amber-800">
                      {neon.resumo.auditoria_ausentes ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-[11px] text-red-700">Pendências reais</div>
                    <div className="mt-1 text-xl font-bold text-red-800">
                      {neon.resumo.auditoria_pendencias_reais ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => carregarFilaStaging('todos', 1, '')}
                    disabled={filaCarregando}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {filaCarregando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Users size={16} />
                    )}
                    Abrir fila de clientes
                  </button>
                  <button
                    onClick={() => carregarAuditoria(1, { origem: 'todos', relacao: 'todos', situacao: 'todos', confianca: 'todos', classificacao: 'todos', busca: '' })}
                    disabled={auditoriaCarregando}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {auditoriaCarregando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Abrir auditoria de relações
                  </button>
                  <span className="text-xs text-slate-500">
                    Somente leitura. Nenhuma promoção automática é executada.
                  </span>
                </div>
              </section>
            )}

            {planoPromocao && (
              <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={19} className="text-indigo-700" />
                      <h2 className="font-semibold text-slate-900">Prontidão para migração — dry-run</h2>
                    </div>
                    <p className="mt-1 max-w-4xl text-sm text-slate-600">
                      Consolida o histórico comercial do W.Vetro sem gravar no Atlas oficial. “Cliente seguro”
                      significa apenas que o registro já consegue apontar para um Cliente 360 sem ambiguidade.
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    Sem gravação no Atlas
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Históricos únicos</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{planoPromocao.resumo.total}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[11px] text-emerald-700">Com cliente seguro</div>
                    <div className="mt-1 text-xl font-bold text-emerald-800">
                      {planoPromocao.resumo.clienteSeguro}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] text-amber-700">Bloqueados por cliente</div>
                    <div className="mt-1 text-xl font-bold text-amber-800">
                      {planoPromocao.resumo.bloqueados}
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="text-[11px] text-blue-700">Pedido/orçamento consolidados</div>
                    <div className="mt-1 text-xl font-bold text-blue-800">
                      {planoPromocao.duplicacoesPedidoOrcamento}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendas históricas</div>
                    <div className="mt-2 flex items-end gap-4">
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{planoPromocao.resumo.vendas.total}</div>
                        <div className="text-[11px] text-slate-500">total único</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-700">{planoPromocao.resumo.vendas.clienteSeguro}</div>
                        <div className="text-[11px] text-slate-500">cliente seguro</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-700">{planoPromocao.resumo.vendas.bloqueados}</div>
                        <div className="text-[11px] text-slate-500">bloqueadas</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orçamentos históricos</div>
                    <div className="mt-2 flex items-end gap-4">
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{planoPromocao.resumo.orcamentos.total}</div>
                        <div className="text-[11px] text-slate-500">total único</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-700">{planoPromocao.resumo.orcamentos.clienteSeguro}</div>
                        <div className="text-[11px] text-slate-500">cliente seguro</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-700">{planoPromocao.resumo.orcamentos.bloqueados}</div>
                        <div className="text-[11px] text-slate-500">bloqueados</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-100 text-left text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Fonte histórica</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Cliente seguro</th>
                        <th className="px-3 py-2">Já promovido/revisado</th>
                        <th className="px-3 py-2">Cliente Atlas existente</th>
                        <th className="px-3 py-2">Sem documento</th>
                        <th className="px-3 py-2">Outros bloqueios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planoPromocao.itens.map(item => {
                        const outrosBloqueios =
                          item.bloqueadoSemPessoaCl +
                          item.bloqueadoDocAmbiguo +
                          item.bloqueadoSugestao +
                          item.bloqueadoClienteNovo +
                          item.bloqueadoSemVinculo
                        return (
                          <tr key={item.tipo} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-800">{item.tipo}</td>
                            <td className="px-3 py-2">{item.total}</td>
                            <td className="px-3 py-2 font-semibold text-emerald-700">{item.clienteSeguro}</td>
                            <td className="px-3 py-2">{item.clientePromovidoRevisado}</td>
                            <td className="px-3 py-2">{item.clienteExistenteSeguro}</td>
                            <td className="px-3 py-2 text-amber-700">{item.bloqueadoSemDocumento}</td>
                            <td className="px-3 py-2 text-amber-700">{outrosBloqueios}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-800">
                  <b>Gate de segurança:</b> histórico W.Vetro não pode usar o fluxo normal “Confirmar venda”.
                  Esse fluxo dispara Financeiro, Kanban, workflow e Engenharia. A promoção futura deverá usar
                  um modo histórico isolado, idempotente e sem reabrir operação antiga.
                </div>
              </section>
            )}

            {neon?.resumo?.erro && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                O staging está conectado, mas o resumo persistido não pôde ser carregado: {neon.resumo.erro}
              </div>
            )}

            {auditoriaAberta && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={19} className="text-slate-700" />
                      <h2 className="font-semibold text-slate-900">Auditoria de relações W.Vetro</h2>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                      Confere vínculos entre produção, lotes, instalações, títulos, baixas, pedidos e
                      orçamentos. As ausências são classificadas para separar casos informativos ou
                      reconstruíveis das pendências que realmente exigem revisão. Nada é promovido automaticamente.
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">{auditoriaTotal} relação(ões)</div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={auditoriaOrigem}
                    onChange={e => carregarAuditoria(1, { origem: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="todos">Todos os módulos</option>
                    {auditoriaOpcoes.origens.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={auditoriaRelacao}
                    onChange={e => carregarAuditoria(1, { relacao: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="todos">Todas as relações</option>
                    {auditoriaOpcoes.relacoes.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={auditoriaSituacao}
                    onChange={e => carregarAuditoria(1, { situacao: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="encontradas">Somente encontradas</option>
                    <option value="ausentes">Somente ausências brutas</option>
                    <option value="atencao">Somente pendências reais</option>
                  </select>
                  <select
                    value={auditoriaConfianca}
                    onChange={e => carregarAuditoria(1, { confianca: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="todos">Todos os níveis</option>
                    {auditoriaOpcoes.confiancas.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={auditoriaClassificacao}
                    onChange={e => carregarAuditoria(1, { classificacao: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="todos">Todos os tratamentos</option>
                    {auditoriaOpcoes.classificacoes.map(item => (
                      <option key={item} value={item}>{rotuloAuditoria(item)}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={auditoriaBusca}
                    onChange={e => setAuditoriaBusca(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') carregarAuditoria(1, { busca: auditoriaBusca })
                    }}
                    placeholder="Buscar chave, referência, relação ou regra"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => carregarAuditoria(1, { busca: auditoriaBusca })}
                    disabled={auditoriaCarregando}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {auditoriaCarregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Buscar
                  </button>
                </div>

                <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="bg-slate-100 text-left text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Origem</th>
                        <th className="px-3 py-2">Relação</th>
                        <th className="px-3 py-2">Referência</th>
                        <th className="px-3 py-2">Destino</th>
                        <th className="px-3 py-2">Situação</th>
                        <th className="px-3 py-2">Tratamento</th>
                        <th className="px-3 py-2">Confiança</th>
                        <th className="px-3 py-2">Regra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoriaItens.map((item, index) => (
                        <tr
                          key={`${item.origemChave}:${item.tipoRelacao}:${item.referencia || index}`}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{item.origemRecurso}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-400">{item.origemChave}</div>
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">{item.tipoRelacao}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.referencia || '—'}</td>
                          <td className="px-3 py-2">
                            <div className="text-xs font-medium text-slate-700">{item.destinoRecurso}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-400">{item.destinoChave}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              item.encontrado
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {item.encontrado ? 'Encontrada' : 'Ausente'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              item.requerAtencao
                                ? 'bg-red-50 text-red-700'
                                : item.classificacao === 'confirmada'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                            }`}>
                              {rotuloAuditoria(item.classificacao)}
                            </span>
                            <div className="mt-1 max-w-[280px] text-[11px] leading-4 text-slate-500">
                              {item.explicacao}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{item.confianca}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{item.regra}</td>
                        </tr>
                      ))}
                      {!auditoriaCarregando && auditoriaItens.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                            Nenhuma relação encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Página {auditoriaPagina} de {auditoriaPaginas}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => carregarAuditoria(Math.max(1, auditoriaPagina - 1))}
                      disabled={auditoriaCarregando || auditoriaPagina <= 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => carregarAuditoria(Math.min(auditoriaPaginas, auditoriaPagina + 1))}
                      disabled={auditoriaCarregando || auditoriaPagina >= auditoriaPaginas}
                      className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </section>
            )}

            {filaAberta && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">Fila persistida de clientes W.Vetro</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Leitura do Neon staging. Use os filtros para conferir os vínculos e candidatos antes
                      de qualquer promoção para o Cliente 360.
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">{filaTotal} registro(s)</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ['todos', 'Todos'],
                    ['vinculado_seguro', 'Vinculados'],
                    ['sugestao_forte', 'Sugestões fortes'],
                    ['revisao', 'Revisar'],
                    ['novo', 'Novos'],
                    ['divergente', 'Divergentes'],
                  ].map(([valor, label]) => (
                    <button
                      key={valor}
                      onClick={() => carregarFilaStaging(valor, 1)}
                      disabled={filaCarregando}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        filaFiltro === valor
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={filaBusca}
                    onChange={e => setFilaBusca(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') carregarFilaStaging(filaFiltro, 1, filaBusca)
                    }}
                    placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou cidade"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => carregarFilaStaging(filaFiltro, 1, filaBusca)}
                    disabled={filaCarregando}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {filaCarregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Buscar
                  </button>
                </div>

                <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="bg-slate-100 text-left text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Cliente W.Vetro</th>
                        <th className="px-3 py-2">CPF/CNPJ</th>
                        <th className="px-3 py-2">Contato</th>
                        <th className="px-3 py-2">Cidade</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Cliente Atlas</th>
                        <th className="px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filaItens.map(item => (
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
                          <td className="px-3 py-2 font-medium">{item.clienteAtlasNome || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {item.motivos.length ? item.motivos.join(' ') : '—'}
                          </td>
                        </tr>
                      ))}
                      {!filaCarregando && filaItens.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Página {filaPagina} de {filaPaginas}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => carregarFilaStaging(filaFiltro, Math.max(1, filaPagina - 1))}
                      disabled={filaCarregando || filaPagina <= 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => carregarFilaStaging(filaFiltro, Math.min(filaPaginas, filaPagina + 1))}
                      disabled={filaCarregando || filaPagina >= filaPaginas}
                      className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </section>
            )}

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
              estado será somente a conexão do staging Neon e aplicação do schema isolado; depois disso a
              captura continuará separada do Cliente 360 até conferência.
            </section>
          </>
        )}
      </div>
    </main>
  )
}
