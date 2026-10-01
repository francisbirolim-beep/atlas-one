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
  auditoria_referencias_pendentes_distintas?: number
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

type HistoricoAtlasCamada = {
  total: number
  somenteHistorico: number
  foraHistorico: number
  comCliente: number
}

type HistoricoAtlasResumo = {
  total?: number
  somenteHistorico?: number
  foraHistorico?: number
  comCliente?: number
  reconciliacaoMaterializacao?: {
    completo: boolean
    comercial: { fonteEsperada: number; materializados: number; deduplicados: number; diferenca: number; completo: boolean }
    financeiro: { fonteEsperada: number; materializados: number; deduplicados: number; diferenca: number; completo: boolean }
    operacional: { fonteEsperada: number; materializados: number; deduplicados: number; diferenca: number; completo: boolean }
    suprimentos: { fonteEsperada: number; materializados: number; deduplicados: number; diferenca: number; completo: boolean }
  }
  coberturaProducaoProjetos?: {
    total: number
    representadosViaLote: number
    comClienteSeguro: number
    semClienteSeguro: number
    lotesCobertos: number
    lotesComProjetos: number
    completo: boolean
    estrategia: string
  }
  camadas?: {
    comercial: HistoricoAtlasCamada
    financeiro: HistoricoAtlasCamada
    operacional: HistoricoAtlasCamada
    suprimentos: HistoricoAtlasCamada
  }
  erro?: string
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

type AuditoriaResumo = {
  total: number
  encontradas: number
  ausentes: number
  pendenciasReais: number
  referenciasPendentesDistintas?: number
  classificacoes: Record<string, number>
}

type AuditoriaCatalogos = {
  resumo: {
    linhas: { total: number; mapeadas: number; pendentes: number }
    cores: {
      total: number
      jaNoAtlas: number
      itensVidro: number
      pendentes: number
      pendentesComUso: number
      pendentesSemUso: number
      candidatasPerfil: number
      acabamentosAcessorio: number
      usoMisto: number
    }
    vidros: {
      total: number
      referenciados: number
      pendentes: number
      aguardandoHomologacao: number
      homologadosCatalogo: number
      vinculadosProdutoAtlas: number
      comCustoReferencia: number
    }
  }
  pendencias: {
    linhas: Array<{
      nome: string
      status: string
      statusMapeamento: string | null
      linhaTecnicaId: string | null
      evidenciaUsoHistorico: boolean
      ocorrenciasHistoricas: number
      documentosHistoricos: number
    }>
    cores: Array<{
      nome: string
      status: string
      evidenciaUsoHistorico: boolean
      ocorrenciasComponentes: number
      documentosHistoricos: number
      ocorrenciasPerfil: number
      ocorrenciasAcessorio: number
      classificacaoUso: 'cor_perfil' | 'acabamento_acessorio' | 'uso_misto' | 'sem_uso'
      sugestoesAtlas: Array<{ id: string; nome: string; score: number }>
    }>
    vidros: Array<{
      nome: string
      status: string
      statusValidacao: string | null
      produtoAtlasId: string | null
      catalogoCustoId: string | null
      catalogoCustoUnitario: number | null
      catalogoUnidade: string | null
      ocorrencias: number
      ncm: string | null
      espessuraMm: number | null
      pesoKgM2: number | null
      custoReferenciaM2: number | null
      custoReferenciaFonte: string | null
      historicoDocumentos: number
      historicoAreaM2: number | null
      historicoAmostrasCusto: number
      historicoCustoM2Min: number | null
      historicoCustoM2Mediana: number | null
      historicoCustoM2Max: number | null
    }>
  }
}

type PlanoPromocaoItem = {
  tipo: string
  total: number
  clienteSeguro: number
  bloqueados: number
  clientePromovidoRevisado: number
  clienteExistenteSeguro: number
  seguroViaCodigoNome: number
  bloqueadoPessoaNaoResolvida: number
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
  identidadeCliente: {
    prioridade: string[]
    codigoNomeValidado: boolean
    paresCodigoNome: number
    paresAmbiguos: number
    regra: string
  }
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
    sem_referencia: 'Sem referência válida',
    preservada_historico_comercial: 'Preservada no histórico comercial',
    preservada_historico_operacional: 'Preservada no histórico operacional',
    preservada_historico_financeiro: 'Preservada no histórico financeiro',
    preservada_no_lote: 'Preservada dentro do lote',
    referencia_historica_sem_snapshot: 'Referência histórica sem snapshot',
    baixa_sem_historico_financeiro: 'Baixa sem histórico financeiro',
    projeto_producao_nao_localizado: 'Projeto de produção não localizado',
    referencia_orcamento_nao_localizada: 'Orçamento não localizado',
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
  const [historicoAtlas, setHistoricoAtlas] = useState<HistoricoAtlasResumo | null>(null)
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
  const [auditoriaResumo, setAuditoriaResumo] = useState<AuditoriaResumo | null>(null)
  const [catalogosCarregando, setCatalogosCarregando] = useState(false)
  const [catalogosAuditoria, setCatalogosAuditoria] = useState<AuditoriaCatalogos | null>(null)

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
        setHistoricoAtlas(json?.historicoAtlas || null)
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

  async function carregarAuditoriaCatalogos() {
    setCatalogosCarregando(true)
    setErro('')
    try {
      const json = await apiPreview(new URLSearchParams({ recurso: 'auditoria-catalogos' }))
      setCatalogosAuditoria({
        resumo: json.resumo,
        pendencias: json.pendencias,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao auditar catálogos W.Vetro.')
    } finally {
      setCatalogosCarregando(false)
    }
  }

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
      setAuditoriaResumo(json?.resumo ? {
        total: Number(json.resumo.total || 0),
        encontradas: Number(json.resumo.encontradas || 0),
        ausentes: Number(json.resumo.ausentes || 0),
        pendenciasReais: Number(json.resumo.pendenciasReais || 0),
        referenciasPendentesDistintas: Number(json.resumo.referenciasPendentesDistintas || 0),
        classificacoes:
          json.resumo.classificacoes && typeof json.resumo.classificacoes === 'object'
            ? json.resumo.classificacoes
            : {},
      } : null)
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

                <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="text-[11px] text-orange-700">Referências distintas para revisar</div>
                    <div className="mt-1 text-xl font-bold text-orange-800">
                      {neon.resumo.auditoria_referencias_pendentes_distintas ?? 0}
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
                  <button
                    onClick={carregarAuditoriaCatalogos}
                    disabled={catalogosCarregando}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50"
                  >
                    {catalogosCarregando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Database size={16} />
                    )}
                    Auditar catálogos
                  </button>
                  <span className="text-xs text-slate-500">
                    Somente leitura. Nenhuma promoção automática é executada.
                  </span>
                </div>
              </section>
            )}

            {catalogosAuditoria && (
              <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database size={19} className="text-blue-700" />
                      <h2 className="font-semibold text-slate-900">Auditoria técnica — linhas, cores e vidros</h2>
                    </div>
                    <p className="mt-1 max-w-4xl text-sm text-slate-600">
                      Comparação somente leitura entre o staging W.Vetro e os cadastros/referências já existentes no Atlas.
                      Nenhum item é promovido automaticamente.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linhas</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{catalogosAuditoria.resumo.linhas.total}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {catalogosAuditoria.resumo.linhas.mapeadas} mapeadas · {catalogosAuditoria.resumo.linhas.pendentes} pendente(s)
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cores / acabamentos</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{catalogosAuditoria.resumo.cores.total}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {catalogosAuditoria.resumo.cores.jaNoAtlas} no Atlas · {catalogosAuditoria.resumo.cores.itensVidro} são vidro · {catalogosAuditoria.resumo.cores.pendentes} revisar
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {catalogosAuditoria.resumo.cores.candidatasPerfil} candidata(s) de perfil · {catalogosAuditoria.resumo.cores.acabamentosAcessorio} acabamento(s) só de acessório · {catalogosAuditoria.resumo.cores.usoMisto} uso misto
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {catalogosAuditoria.resumo.cores.pendentesComUso} com uso histórico · {catalogosAuditoria.resumo.cores.pendentesSemUso} sem uso no recorte
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vidros</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{catalogosAuditoria.resumo.vidros.total}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {catalogosAuditoria.resumo.vidros.referenciados} referenciados · {catalogosAuditoria.resumo.vidros.homologadosCatalogo} homologado(s) · {catalogosAuditoria.resumo.vidros.pendentes} para homologar
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {catalogosAuditoria.resumo.vidros.comCustoReferencia} com amostra histórica de custo/m²
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Linhas para revisar</div>
                    <div className="mt-2 space-y-2">
                      {catalogosAuditoria.pendencias.linhas.map(item => (
                        <div key={item.nome} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <div className="font-semibold">{item.nome}</div>
                          <div className="mt-0.5">{item.statusMapeamento || item.status}</div>
                          <div className="mt-1 text-[11px] text-amber-700/80">
                            {item.evidenciaUsoHistorico
                              ? `${item.ocorrenciasHistoricas} ocorrência(s) em ${item.documentosHistoricos} documento(s)`
                              : 'Sem uso histórico no recorte migrado'}
                          </div>
                        </div>
                      ))}
                      {!catalogosAuditoria.pendencias.linhas.length && (
                        <div className="text-xs text-emerald-700">Nenhuma pendência de linha.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Cores para revisar</div>
                    <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
                      {catalogosAuditoria.pendencias.cores.map(item => {
                        const classificacao = {
                          cor_perfil: ['Candidata a cor de perfil', 'bg-blue-100 text-blue-700'],
                          acabamento_acessorio: ['Acabamento de acessório', 'bg-violet-100 text-violet-700'],
                          uso_misto: ['Uso misto', 'bg-orange-100 text-orange-700'],
                          sem_uso: ['Sem uso histórico', 'bg-slate-100 text-slate-600'],
                        }[item.classificacaoUso] || ['Revisar', 'bg-amber-100 text-amber-700']

                        return (
                          <div key={item.nome} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="font-semibold">{item.nome}</div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${classificacao[1]}`}>
                                {classificacao[0]}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-amber-700/80">
                              {item.evidenciaUsoHistorico
                                ? `${item.ocorrenciasComponentes} ocorrência(s) em ${item.documentosHistoricos} documento(s) · perfil ${item.ocorrenciasPerfil} · acessório ${item.ocorrenciasAcessorio}`
                                : 'Sem uso em perfis/acessórios no recorte migrado'}
                            </div>
                            {item.classificacaoUso === 'acabamento_acessorio' && (
                              <div className="mt-1.5 rounded-md bg-white/70 px-2 py-1 text-[11px] text-violet-700">
                                Não tratar como cor de alumínio automaticamente. Revisar no cadastro do acessório.
                              </div>
                            )}
                            {item.classificacaoUso === 'cor_perfil' && item.sugestoesAtlas.length > 0 && (
                              <div className="mt-1.5 rounded-md bg-white/70 px-2 py-1 text-[11px] text-blue-700">
                                <span className="font-semibold">Sugestão nominal:</span>{' '}
                                {item.sugestoesAtlas.map((s, index) => (
                                  <span key={s.id}>
                                    {index > 0 ? ' · ' : ''}
                                    {s.nome} ({Math.round(s.score * 100)}%)
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.classificacaoUso === 'cor_perfil' && item.sugestoesAtlas.length === 0 && (
                              <div className="mt-1.5 rounded-md bg-white/70 px-2 py-1 text-[11px] text-slate-600">
                                Sem correspondência nominal forte no cadastro Atlas.
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {!catalogosAuditoria.pendencias.cores.length && (
                        <div className="text-xs text-emerald-700">Nenhuma pendência de cor.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Fila de homologação de vidros</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Ordenada pelo uso histórico. Custo/m² abaixo é somente referência da amostra W.Vetro e não vira custo oficial.
                    </div>
                    <div className="mt-2 max-h-[34rem] space-y-2 overflow-auto pr-1">
                      {catalogosAuditoria.pendencias.vidros.map(item => (
                        <div key={item.nome} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold">{item.nome}</div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              {item.ocorrencias} uso(s)
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-amber-800/80">
                            {item.espessuraMm != null && <span>{item.espessuraMm} mm</span>}
                            {item.pesoKgM2 != null && <span>{item.pesoKgM2} kg/m²</span>}
                            {item.ncm && <span>NCM {item.ncm}</span>}
                            <span>{item.statusValidacao || item.status}</span>
                          </div>
                          {(item.historicoDocumentos > 0 || item.historicoAmostrasCusto > 0) && (
                            <div className="mt-1.5 rounded-md border border-amber-100 bg-white/80 px-2 py-1.5 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">Evidência histórica:</span>{' '}
                              {item.historicoDocumentos} documento(s)
                              {item.historicoAreaM2 != null
                                ? ` · ${item.historicoAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`
                                : ''}
                              {item.historicoAmostrasCusto > 0 &&
                                item.historicoCustoM2Mediana != null && (
                                  <>
                                    {' · '}custo/m² min.{' '}
                                    {item.historicoCustoM2Min?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    {' · '}mediana{' '}
                                    <b>
                                      {item.historicoCustoM2Mediana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </b>
                                    {' · '}máx.{' '}
                                    {item.historicoCustoM2Max?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </>
                                )}
                            </div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {item.custoReferenciaM2 != null ? (
                              <span className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800">
                                {item.custoReferenciaFonte === 'mediana_historica_wvetro' ? 'Mediana histórica W.Vetro' : 'Ref. W.Vetro'}: {item.custoReferenciaM2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">Sem amostra de custo válida</span>
                            )}
                            {item.catalogoCustoId ? (
                              <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                Homologado no catálogo Atlas
                              </span>
                            ) : (
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                                Aguardando homologação
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {!catalogosAuditoria.pendencias.vidros.length && (
                        <div className="text-xs text-emerald-700">Todos os vidros estão homologados no catálogo técnico.</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {historicoAtlas && !historicoAtlas.erro && (
              <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database size={19} className="text-blue-700" />
                      <h2 className="font-semibold text-slate-900">
                        Histórico W.Vetro materializado no Atlas
                      </h2>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                      Registros já copiados para as tabelas históricas isoladas do Supabase.
                      Eles permanecem fora dos fluxos operacionais, dos saldos financeiros,
                      do estoque e dos KPIs oficiais do Atlas.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total histórico</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {historicoAtlas.total ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Comercial', historicoAtlas.camadas?.comercial],
                    ['Financeiro', historicoAtlas.camadas?.financeiro],
                    ['Operacional', historicoAtlas.camadas?.operacional],
                    ['Suprimentos', historicoAtlas.camadas?.suprimentos],
                  ].map(([label, camada]) => {
                    const dados = camada as HistoricoAtlasCamada | undefined
                    return (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {String(label)}
                        </div>
                        <div className="mt-1 text-xl font-bold text-slate-900">
                          {dados?.total ?? 0}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {(dados?.comCliente ?? 0) > 0
                            ? `${dados?.comCliente ?? 0} ligado(s) ao Cliente 360`
                            : 'Sem vínculo automático a cadastro operacional'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {historicoAtlas.reconciliacaoMaterializacao && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Integridade da materialização
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {historicoAtlas.reconciliacaoMaterializacao.completo
                            ? 'Cobertura histórica reconciliada'
                            : 'Diferença encontrada na materialização'}
                        </div>
                        <p className="mt-1 max-w-3xl text-xs text-slate-600">
                          Compara as entidades do staging Neon com as tabelas históricas isoladas do Atlas,
                          descontando apenas duplicidades comprovadas.
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          historicoAtlas.reconciliacaoMaterializacao.completo
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {historicoAtlas.reconciliacaoMaterializacao.completo ? '100% reconciliado' : 'Revisar diferenças'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ['Comercial', historicoAtlas.reconciliacaoMaterializacao.comercial],
                        ['Financeiro', historicoAtlas.reconciliacaoMaterializacao.financeiro],
                        ['Operacional', historicoAtlas.reconciliacaoMaterializacao.operacional],
                        ['Suprimentos', historicoAtlas.reconciliacaoMaterializacao.suprimentos],
                      ].map(([label, item]) => {
                        const dados = item as {
                          fonteEsperada: number
                          materializados: number
                          deduplicados: number
                          diferenca: number
                          completo: boolean
                        }
                        return (
                          <div key={String(label)} className="rounded-lg border border-emerald-100 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {String(label)}
                              </span>
                              <span className={dados.completo ? 'text-emerald-600' : 'text-red-600'}>
                                {dados.completo ? 'OK' : 'DIF'}
                              </span>
                            </div>
                            <div className="mt-1 text-lg font-bold text-slate-900">
                              {dados.materializados}/{dados.fonteEsperada}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {dados.deduplicados > 0
                                ? `${dados.deduplicados} duplicidade(s) comprovada(s) descontada(s)`
                                : 'Sem deduplicação necessária'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {historicoAtlas.coberturaProducaoProjetos && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          Projetos de produção
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {historicoAtlas.coberturaProducaoProjetos.representadosViaLote}/
                          {historicoAtlas.coberturaProducaoProjetos.total} preservados via lote histórico
                        </div>
                        <div className="mt-1 max-w-3xl text-xs text-slate-600">
                          {historicoAtlas.coberturaProducaoProjetos.estrategia}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <div>
                          {historicoAtlas.coberturaProducaoProjetos.comClienteSeguro} com cliente seguro
                        </div>
                        <div>
                          {historicoAtlas.coberturaProducaoProjetos.semClienteSeguro} sem cliente seguro
                        </div>
                        <div>
                          {historicoAtlas.coberturaProducaoProjetos.lotesCobertos}/
                          {historicoAtlas.coberturaProducaoProjetos.lotesComProjetos} lotes cobertos
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      (historicoAtlas.foraHistorico ?? 0) === 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {(historicoAtlas.foraHistorico ?? 0) === 0
                      ? '100% isolado como histórico'
                      : `${historicoAtlas.foraHistorico} registro(s) fora do modo histórico`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {historicoAtlas.somenteHistorico ?? 0} registro(s) com somente_historico=true.
                  </span>
                </div>
              </section>
            )}

            {historicoAtlas?.erro && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                O histórico materializado no Atlas não pôde ser resumido: {historicoAtlas.erro}
              </div>
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
                        <th className="px-3 py-2">Seguro via código + nome</th>
                        <th className="px-3 py-2">Pessoa não resolvida</th>
                        <th className="px-3 py-2">Outros bloqueios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planoPromocao.itens.map(item => {
                        const outrosBloqueios =
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
                            <td className="px-3 py-2 text-blue-700">{item.seguroViaCodigoNome}</td>
                            <td className="px-3 py-2 text-amber-700">{item.bloqueadoPessoaNaoResolvida}</td>
                            <td className="px-3 py-2 text-amber-700">{outrosBloqueios}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                  <b>Identidade do cliente no W.Vetro:</b> primeiro usamos CPF/CNPJ único. Quando o
                  documento não existe, o par <b>PessoaCodigo + nome exato</b> pode localizar a pessoa
                  somente dentro do W.Vetro. Foram validados {planoPromocao.identidadeCliente.paresCodigoNome}
                  pares e {planoPromocao.identidadeCliente.paresAmbiguos} ambiguidades. A associação ao
                  Cliente 360 continua dependendo de um vínculo já existente no staging.
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

                {auditoriaResumo && (
                  <>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ['Relações auditadas', auditoriaResumo.total, 'text-slate-900'],
                        ['Encontradas', auditoriaResumo.encontradas, 'text-emerald-700'],
                        ['Ausências brutas', auditoriaResumo.ausentes, 'text-amber-700'],
                        ['Pendências reais', auditoriaResumo.pendenciasReais, auditoriaResumo.pendenciasReais === 0 ? 'text-emerald-700' : 'text-red-700'],
                        ['Referências pendentes', auditoriaResumo.referenciasPendentesDistintas || 0, auditoriaResumo.referenciasPendentesDistintas === 0 ? 'text-emerald-700' : 'text-red-700'],
                      ].map(([label, valor, cls]) => (
                        <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] text-slate-500">{label}</div>
                          <div className={`mt-1 text-xl font-bold ${cls}`}>{valor}</div>
                        </div>
                      ))}
                    </div>

                    {auditoriaResumo.pendenciasReais === 0 && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <b>Auditoria relacional fechada:</b> todas as ausências brutas possuem tratamento
                        determinístico ou evidência histórica preservada. Não há vínculo exigindo revisão humana.
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(auditoriaResumo.classificacoes)
                        .sort((a, b) => b[1] - a[1])
                        .map(([chave, quantidade]) => (
                          <button
                            key={chave}
                            type="button"
                            onClick={() => carregarAuditoria(1, { classificacao: chave })}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            {rotuloAuditoria(chave)} · {quantidade}
                          </button>
                        ))}
                    </div>
                  </>
                )}

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
