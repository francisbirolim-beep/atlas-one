import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import {
  mapaWVetroPorRecurso,
  WVETRO_MIGRACAO_OPERACIONAL_MAPA,
  WVetroOperacionalRecurso,
} from '@/lib/wvetroOperacionalMap'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { neonStaging, statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'
import {
  consultarRecursoOperacionalWVetro,
  WVetroOperacionalConsultaParams,
} from '@/lib/wvetroOperacionalConsultaServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE_AMOSTRA = 20

function colecaoPrincipal(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null

  const obj = payload as Record<string, unknown>
  const chaves = [
    'ListPedidos',
    'SDTTitulos',
    'sdtMovimentoEstoque',
    'sdtContas',
    'sdtPlanoContas',
    'sdtExtrato',
    'sdtMetas',
  ]

  for (const chave of chaves) {
    const valor = obj[chave]
    if (Array.isArray(valor)) return valor
  }

  return null
}

function montarPreview(payload: unknown) {
  const colecao = colecaoPrincipal(payload)
  if (!colecao) {
    return {
      total: payload == null ? 0 : 1,
      amostra: payload,
      truncado: false,
    }
  }

  return {
    total: colecao.length,
    amostra: colecao.slice(0, LIMITE_AMOSTRA),
    truncado: colecao.length > LIMITE_AMOSTRA,
  }
}

function param(req: NextRequest, nome: string) {
  const valor = req.nextUrl.searchParams.get(nome)
  return valor == null ? undefined : valor.trim() || undefined
}

function inteiro(req: NextRequest, nome: string) {
  const valor = param(req, nome)
  if (valor === undefined) return undefined
  const numero = Number(valor)
  return Number.isInteger(numero) ? numero : undefined
}

function booleano(req: NextRequest, nome: string) {
  const valor = param(req, nome)
  if (valor === undefined) return undefined
  if (valor.toLowerCase() === 'true') return true
  if (valor.toLowerCase() === 'false') return false
  return undefined
}

function paramsDaUrl(req: NextRequest): WVetroOperacionalConsultaParams {
  return {
    inicio: param(req, 'inicio'),
    fim: param(req, 'fim'),
    pessoaId: param(req, 'pessoaId'),
    tipoPessoa: param(req, 'tipoPessoa'),
    vendedorId: param(req, 'vendedorId'),
    linhaId: param(req, 'linhaId'),
    ano: inteiro(req, 'ano'),
    mes: inteiro(req, 'mes'),
    id: param(req, 'id'),
    nfId: param(req, 'nfId'),
    tipo: param(req, 'tipo'),
    produtoCodigo: param(req, 'produtoCodigo'),
    corNome: param(req, 'corNome'),
    tituloTipo: param(req, 'tituloTipo'),
    contaNro: param(req, 'contaNro'),
    loteNro: param(req, 'loteNro'),
    programacaoNro: param(req, 'programacaoNro'),
    produzido: booleano(req, 'produzido'),
  }
}

type AuditoriaNormalizada = {
  origemRecurso: string
  origemChave: string
  tipoRelacao: string
  destinoRecurso: string
  destinoChave: string
  referencia: string | null
  encontrado: boolean
  confianca: string
  regra: string
}

type EvidenciasAuditoria = {
  numerosHistoricoComercial: Set<string>
  numerosHistoricoOperacional: Set<string>
  titulosHistoricoFinanceiro: Set<string>
  tituloOrcamentoHistoricoFinanceiro: Set<string>
  projetosPresentesNosLotes: Set<string>
}

async function carregarEvidenciasAuditoria(
  empresaId: string,
  sql: ReturnType<typeof neonStaging>,
): Promise<EvidenciasAuditoria> {
  const [comercial, operacional, financeiro, projetosLote] = await Promise.all([
    supabaseAdmin
      .from('wvetro_historico_comercial')
      .select('numero_wvetro')
      .eq('empresa_id', empresaId)
      .eq('somente_historico', true)
      .not('numero_wvetro', 'is', null),
    supabaseAdmin
      .from('wvetro_historico_operacional')
      .select('orcamentos_wvetro')
      .eq('empresa_id', empresaId)
      .eq('somente_historico', true),
    supabaseAdmin
      .from('wvetro_historico_financeiro')
      .select('titulo_id_wvetro,orcamento_wvetro')
      .eq('empresa_id', empresaId)
      .eq('somente_historico', true)
      .not('titulo_id_wvetro', 'is', null),
    sql`
      select distinct
        (l.payload->>'id') || ':' || (p->>'id') as referencia
      from wvetro_migracao.raw_canonico l
      cross join lateral jsonb_array_elements(coalesce(l.payload->'projetos','[]'::jsonb)) p
      where l.recurso='lotes_producao'
        and nullif(l.payload->>'id','') is not null
        and nullif(p->>'id','') is not null
    `,
  ])

  if (comercial.error) throw new Error(`Falha ao consultar histórico comercial W.Vetro: ${comercial.error.message}`)
  if (operacional.error) throw new Error(`Falha ao consultar histórico operacional W.Vetro: ${operacional.error.message}`)
  if (financeiro.error) throw new Error(`Falha ao consultar histórico financeiro W.Vetro: ${financeiro.error.message}`)

  return {
    numerosHistoricoComercial: new Set(
      (comercial.data || []).map((item: any) => String(item.numero_wvetro || '').trim()).filter(Boolean),
    ),
    numerosHistoricoOperacional: new Set(
      (operacional.data || [])
        .flatMap((item: any) => Array.isArray(item.orcamentos_wvetro) ? item.orcamentos_wvetro : [])
        .map((item: unknown) => String(item || '').trim())
        .filter(Boolean),
    ),
    titulosHistoricoFinanceiro: new Set(
      (financeiro.data || []).map((item: any) => String(item.titulo_id_wvetro || '').trim()).filter(Boolean),
    ),
    tituloOrcamentoHistoricoFinanceiro: new Set(
      (financeiro.data || [])
        .map((item: any) => {
          const tituloId = String(item.titulo_id_wvetro || '').trim()
          const orcamento = String(item.orcamento_wvetro || '').trim()
          return tituloId && orcamento ? `${tituloId}:${orcamento}` : ''
        })
        .filter(Boolean),
    ),
    projetosPresentesNosLotes: new Set(
      (projetosLote || []).map((item: any) => String(item.referencia || '').trim()).filter(Boolean),
    ),
  }
}

function classificarAuditoria(normalizados: AuditoriaNormalizada[], evidencias: EvidenciasAuditoria) {
  const classificados = normalizados.map(item => {
    let classificacao = 'pendente_revisao'
    let explicacao = 'Referência não encontrada nas evidências disponíveis.'
    let requerAtencao = true

    if (item.encontrado) {
      classificacao = 'confirmada'
      explicacao = 'Relação encontrada diretamente no staging.'
      requerAtencao = false
    } else if (item.origemRecurso === 'pedidos' && item.tipoRelacao === 'numero_compartilhado') {
      classificacao = 'informativa'
      explicacao = 'Número compartilhado entre pedido e orçamento é observacional e não é usado como chave automática.'
      requerAtencao = false
    } else if (item.referencia === '0') {
      classificacao = 'sem_referencia'
      explicacao = 'A origem declarou referência zero; não existe vínculo externo válido.'
      requerAtencao = false
    } else if (item.origemRecurso === 'titulos_baixados' && item.tipoRelacao === 'titulo_mesmo_id') {
      if (item.referencia && evidencias.titulosHistoricoFinanceiro.has(item.referencia)) {
        classificacao = 'preservada_historico_financeiro'
        explicacao = 'A baixa não possui título atual correspondente, mas está preservada no histórico financeiro isolado.'
        requerAtencao = false
      } else {
        classificacao = 'baixa_sem_historico_financeiro'
        explicacao = 'A baixa não possui título atual correspondente nem registro no histórico financeiro isolado.'
      }
    } else if (item.origemRecurso === 'instalacoes' && item.tipoRelacao === 'projeto_producao') {
      if (item.referencia && evidencias.projetosPresentesNosLotes.has(item.referencia)) {
        classificacao = 'preservada_no_lote'
        explicacao = 'O projeto não veio no endpoint producao_projeto, mas existe dentro do lote de produção correspondente.'
        requerAtencao = false
      } else {
        classificacao = 'projeto_producao_nao_localizado'
        explicacao = 'O projeto não foi localizado nem no endpoint producao_projeto nem dentro do lote.'
      }
    } else if (item.destinoRecurso === 'orcamentos' && item.referencia) {
      if (evidencias.numerosHistoricoComercial.has(item.referencia)) {
        classificacao = 'preservada_historico_comercial'
        explicacao = 'O snapshot não está no staging atual, mas o número existe no histórico comercial isolado do Atlas.'
        requerAtencao = false
      } else if (evidencias.numerosHistoricoOperacional.has(item.referencia)) {
        classificacao = 'preservada_historico_operacional'
        explicacao = 'O snapshot do orçamento não foi localizado, mas o número está preservado de forma consistente em lote/instalação histórica do W.Vetro.'
        requerAtencao = false
      } else if (
        item.origemRecurso === 'titulos' &&
        item.origemChave.startsWith('titulo:') &&
        evidencias.tituloOrcamentoHistoricoFinanceiro.has(
          `${item.origemChave.replace(/^titulo:/, '')}:${item.referencia}`,
        )
      ) {
        classificacao = 'referencia_historica_sem_snapshot'
        explicacao = 'A referência ao orçamento está preservada no título financeiro histórico, mas o snapshot do orçamento não foi disponibilizado nas capturas concluídas do W.Vetro.'
        requerAtencao = false
      } else {
        classificacao = 'referencia_orcamento_nao_localizada'
        explicacao = 'O número de orçamento não foi localizado no staging nem nos históricos comercial, operacional ou financeiro do Atlas.'
      }
    }

    return { ...item, classificacao, explicacao, requerAtencao }
  })

  const referenciasPendentesDistintas = new Set(
    classificados
      .filter(item => item.requerAtencao && item.referencia)
      .map(item => item.referencia as string),
  ).size

  return { classificados, referenciasPendentesDistintas }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  const configuracao = statusConfiguracaoWVetro()
  const neon = statusNeonStaging()
  const recurso = String(req.nextUrl.searchParams.get('recurso') || 'mapa').trim()

  if (recurso === 'plano-promocao') {
    if (!neon.configurado) {
      return NextResponse.json({ error: 'Staging Neon não configurado.' }, { status: 503 })
    }

    try {
      const sql = neonStaging()
      const rows = await sql`
        with orcs as (
          select
            chave_externa_canonica as chave,
            payload->>'Nro' as nro,
            payload->>'Situacao' as situacao,
            regexp_replace(coalesce(payload->>'ClienteCNPJ',''),'\\D','','g') as doc,
            payload->>'ClienteCodigo' as codigo,
            upper(regexp_replace(trim(coalesce(payload->>'ClienteNome','')),'\\s+',' ','g')) as nome,
            coalesce(nullif(payload->>'Total',''),nullif(payload->>'ValorBruto',''),'0')::numeric as total,
            jsonb_array_length(coalesce(payload->'Itens','[]'::jsonb)) as itens,
            coalesce(payload->>'DtVenda','') as dt_venda
          from wvetro_migracao.raw_canonico
          where recurso='orcamentos'
        ),
        peds as (
          select
            chave_externa_canonica as chave,
            payload->>'Nro' as nro,
            regexp_replace(coalesce(payload->>'ClienteCNPJ',''),'\\D','','g') as doc,
            payload->>'ClienteCodigo' as codigo,
            upper(regexp_replace(trim(coalesce(payload->>'ClienteNome','')),'\\s+',' ','g')) as nome,
            coalesce(nullif(payload->>'Total',''),nullif(payload->>'ValorBruto',''),'0')::numeric as total,
            jsonb_array_length(coalesce(payload->'Itens','[]'::jsonb)) as itens,
            coalesce(payload->>'DtVenda','') as dt_venda
          from wvetro_migracao.raw_canonico
          where recurso='pedidos'
        ),
        comerciais as (
          select 'orcamento_historico'::text as tipo,o.chave,o.doc,o.codigo,o.nome
          from orcs o
          where o.situacao='O'

          union all

          select 'venda_historica_orcamento'::text,o.chave,o.doc,o.codigo,o.nome
          from orcs o
          where o.situacao in ('V','F')
            and not exists (
              select 1
              from peds p
              where p.nro=o.nro
                and p.nome=o.nome
                and abs(p.total-o.total)<0.01
                and p.itens=o.itens
                and p.dt_venda=o.dt_venda
                and (
                  (p.doc<>'' and o.doc<>'' and p.doc=o.doc)
                  or (p.doc='' and o.doc='')
                )
            )

          union all

          select 'venda_historica_pedido'::text,p.chave,p.doc,p.codigo,p.nome
          from peds p
        ),
        pessoas as (
          select
            chave_externa_canonica as pessoa_chave,
            regexp_replace(coalesce(payload->>'PessoaCPFCNPJ',''),'\\D','','g') as doc,
            payload->>'PessoaCodigo' as codigo,
            upper(regexp_replace(trim(coalesce(
              nullif(payload->>'PessoaRazaoSocial',''),
              nullif(payload->>'PessoaFantasia',''),
              nullif(payload->>'PessoaResponsavel',''),
              ''
            )),'\\s+',' ','g')) as nome
          from wvetro_migracao.raw_canonico
          where recurso='pessoas_cliente'
        ),
        doc_unico as (
          select doc,min(pessoa_chave) as pessoa_chave
          from pessoas
          where doc<>''
          group by doc
          having count(*)=1
        ),
        codigo_nome_unico as (
          select codigo,nome,min(pessoa_chave) as pessoa_chave
          from pessoas
          where coalesce(codigo,'')<>'' and nome<>''
          group by codigo,nome
          having count(*)=1
        ),
        avaliados as (
          select
            c.*,
            coalesce(d.pessoa_chave,cn.pessoa_chave) as pessoa_chave,
            case
              when d.pessoa_chave is not null then 'documento'
              when cn.pessoa_chave is not null then 'codigo_nome'
              else null
            end as metodo_identidade,
            v.status,
            v.metodo_match,
            v.revisado_em
          from comerciais c
          left join doc_unico d on d.doc=c.doc and c.doc<>''
          left join codigo_nome_unico cn
            on d.pessoa_chave is null
           and cn.codigo=c.codigo
           and cn.nome=c.nome
          left join wvetro_migracao.vinculos v
            on v.recurso='pessoas_cliente'
           and v.entidade_atlas='cliente'
           and v.chave_externa=coalesce(d.pessoa_chave,cn.pessoa_chave)
        )
        select
          tipo,
          count(*)::int as total,
          count(*) filter (where status='vinculado')::int as cliente_seguro,
          count(*) filter (where status='vinculado' and revisado_em is not null)::int as cliente_promovido_revisado,
          count(*) filter (where status='vinculado' and revisado_em is null)::int as cliente_existente_seguro,
          count(*) filter (where status='vinculado' and metodo_identidade='codigo_nome')::int as seguro_via_codigo_nome,
          count(*) filter (where pessoa_chave is null)::int as bloqueado_pessoa_nao_resolvida,
          count(*) filter (where status='sugerido')::int as bloqueado_sugestao,
          count(*) filter (where status='novo')::int as bloqueado_cliente_novo,
          count(*) filter (where pessoa_chave is not null and status is null)::int as bloqueado_sem_vinculo
        from avaliados
        group by tipo
        order by tipo
      `

      const itens = rows.map((row: any) => {
        const total = Number(row.total || 0)
        const clienteSeguro = Number(row.cliente_seguro || 0)
        return {
          tipo: String(row.tipo || ''),
          total,
          clienteSeguro,
          bloqueados: Math.max(0, total - clienteSeguro),
          clientePromovidoRevisado: Number(row.cliente_promovido_revisado || 0),
          clienteExistenteSeguro: Number(row.cliente_existente_seguro || 0),
          seguroViaCodigoNome: Number(row.seguro_via_codigo_nome || 0),
          bloqueadoPessoaNaoResolvida: Number(row.bloqueado_pessoa_nao_resolvida || 0),
          bloqueadoSugestao: Number(row.bloqueado_sugestao || 0),
          bloqueadoClienteNovo: Number(row.bloqueado_cliente_novo || 0),
          bloqueadoSemVinculo: Number(row.bloqueado_sem_vinculo || 0),
        }
      })

      const vendaTipos = new Set(['venda_historica_orcamento', 'venda_historica_pedido'])
      const resumo = itens.reduce(
        (acc, item) => {
          acc.total += item.total
          acc.clienteSeguro += item.clienteSeguro
          acc.bloqueados += item.bloqueados
          if (vendaTipos.has(item.tipo)) {
            acc.vendas.total += item.total
            acc.vendas.clienteSeguro += item.clienteSeguro
            acc.vendas.bloqueados += item.bloqueados
          } else {
            acc.orcamentos.total += item.total
            acc.orcamentos.clienteSeguro += item.clienteSeguro
            acc.orcamentos.bloqueados += item.bloqueados
          }
          return acc
        },
        {
          total: 0,
          clienteSeguro: 0,
          bloqueados: 0,
          vendas: { total: 0, clienteSeguro: 0, bloqueados: 0 },
          orcamentos: { total: 0, clienteSeguro: 0, bloqueados: 0 },
        },
      )

      const [duplicidade] = await sql`
        with o as (
          select
            payload->>'Nro' as nro,
            regexp_replace(coalesce(payload->>'ClienteCNPJ',''),'\\D','','g') as doc,
            upper(regexp_replace(trim(coalesce(payload->>'ClienteNome','')),'\\s+',' ','g')) as nome,
            coalesce(nullif(payload->>'Total',''),nullif(payload->>'ValorBruto',''),'0')::numeric as total,
            jsonb_array_length(coalesce(payload->'Itens','[]'::jsonb)) as itens,
            coalesce(payload->>'DtVenda','') as dt_venda
          from wvetro_migracao.raw_canonico
          where recurso='orcamentos'
        ),
        p as (
          select
            payload->>'Nro' as nro,
            regexp_replace(coalesce(payload->>'ClienteCNPJ',''),'\\D','','g') as doc,
            upper(regexp_replace(trim(coalesce(payload->>'ClienteNome','')),'\\s+',' ','g')) as nome,
            coalesce(nullif(payload->>'Total',''),nullif(payload->>'ValorBruto',''),'0')::numeric as total,
            jsonb_array_length(coalesce(payload->'Itens','[]'::jsonb)) as itens,
            coalesce(payload->>'DtVenda','') as dt_venda
          from wvetro_migracao.raw_canonico
          where recurso='pedidos'
        )
        select count(*)::int as duplicacoes_confirmadas
        from o join p using(nro)
        where o.nome=p.nome
          and abs(o.total-p.total)<0.01
          and o.itens=p.itens
          and o.dt_venda=p.dt_venda
          and (
            (o.doc<>'' and p.doc<>'' and o.doc=p.doc)
            or (o.doc='' and p.doc='')
          )
      `

      return NextResponse.json({
        ok: true,
        recurso,
        modo: 'dry-run',
        gravacaoWvetro: false,
        gravacaoAtlas: false,
        resumo,
        itens,
        duplicacoesPedidoOrcamento: Number((duplicidade as any)?.duplicacoes_confirmadas || 0),
        identidadeCliente: {
          prioridade: ['cpf_cnpj_unico', 'pessoa_codigo_nome_exatos_unicos'],
          codigoNomeValidado: true,
          paresCodigoNome: 596,
          paresAmbiguos: 0,
          regra:
            'Código + nome identifica a pessoa apenas dentro do W.Vetro; a associação ao Atlas continua exigindo vínculo pré-existente no staging.',
        },
        politica: {
          prontoSignifica: 'Cliente Atlas resolvido por vínculo seguro; não autoriza promoção automática.',
          pedidoPrevalece: 'Quando pedido e orçamento têm assinatura histórica idêntica, o pedido prevalece como fonte da venda.',
          historicoSemWorkflow: true,
          fluxoVendaNormalPermitido: false,
          motivoFluxoVendaNormalBloqueado:
            'O fluxo normal dispara Financeiro, workflow, Kanban e Engenharia; histórico W.Vetro exige importação isolada.',
        },
      })
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Falha ao montar plano de promoção.'
      console.error('Erro no plano dry-run W.Vetro:', error)
      return NextResponse.json({ error: mensagem, recurso }, { status: 502 })
    }
  }

  if (recurso === 'auditoria-catalogos') {
    if (!neon.configurado) {
      return NextResponse.json({ error: 'Staging Neon não configurado.' }, { status: 503 })
    }

    try {
      const sql = neonStaging()
      const [
        linhasNeon,
        coresNeon,
        vidrosNeon,
        vidrosHistoricoStats,
        pendenciasTecnicas,
        linhasAtlas,
        coresAtlas,
        vidrosAtlas,
        catalogoVidrosAtlas,
      ] = await Promise.all([
          sql`
            select distinct payload->>'LinhaNome' as nome
            from wvetro_migracao.raw_canonico
            where recurso='linhas'
              and nullif(trim(payload->>'LinhaNome'),'') is not null
            order by 1
          `,
          sql`
            select distinct payload->>'CorNome' as nome
            from wvetro_migracao.raw_canonico
            where recurso='cores'
              and nullif(trim(payload->>'CorNome'),'') is not null
            order by 1
          `,
          sql`
            select distinct payload->>'CorNome' as nome
            from wvetro_migracao.raw_canonico
            where recurso='vidros'
              and nullif(trim(payload->>'CorNome'),'') is not null
            order by 1
          `,
          sql`
            with docs as (
              select recurso,chave_externa_canonica as documento,payload
              from wvetro_migracao.raw_canonico
              where recurso in ('orcamentos','pedidos')
            ),
            itens as (
              select d.documento,i
              from docs d
              cross join lateral jsonb_array_elements(coalesce(d.payload->'Itens','[]'::jsonb)) i
            ),
            vidros as (
              select
                upper(regexp_replace(trim(coalesce(v->>'Especificacao','')),'\\s+',' ','g')) as especificacao,
                documento,
                coalesce(nullif(v->>'M2Arred','')::numeric,nullif(v->>'M2','')::numeric,0) as area_m2,
                coalesce(nullif(v->>'CustoVlr','')::numeric,0) as custo
              from itens
              cross join lateral jsonb_array_elements(coalesce(i->'Vidros','[]'::jsonb)) v
              where nullif(trim(v->>'Especificacao'),'') is not null
            ),
            validos as (
              select *,
                case when area_m2>0 and custo>0 then custo/area_m2 else null end as custo_m2
              from vidros
            )
            select
              especificacao,
              count(*)::int as ocorrencias,
              count(distinct documento)::int as documentos,
              round(sum(area_m2),3) as area_m2,
              count(*) filter (where custo_m2 is not null)::int as amostras_custo,
              round(min(custo_m2),2) as custo_m2_min,
              round(percentile_cont(0.5) within group (order by custo_m2)::numeric,2) as custo_m2_mediana,
              round(max(custo_m2),2) as custo_m2_max
            from validos
            group by especificacao
          `,
          sql`
            select chave_externa,motivo,contexto,status
            from wvetro_migracao.pendencias
            where recurso='catalogos_tecnicos'
              and tipo='validacao'
              and status in ('pendente','em_revisao')
          `,
          supabaseAdmin
            .from('wvetro_referencias_linhas')
            .select('linha_raw,status_mapeamento,linha_tecnica_id')
            .eq('origem_api_linhas', true),
          supabaseAdmin
            .from('cores')
            .select('id,nome,ativo'),
          supabaseAdmin
            .from('wvetro_referencias_vidros')
            .select('especificacao,status_validacao,produto_atlas_id,ncm,ocorrencias,dados_origem'),
          supabaseAdmin
            .from('catalogo_custos_tecnicos')
            .select('id,chave,descricao,unidade,custo_unitario,ativo')
            .eq('empresa_id', usuario.empresa_id)
            .eq('categoria', 'vidro')
            .eq('ativo', true),
        ])

      if (linhasAtlas.error) throw new Error(`Falha ao carregar linhas W.Vetro: ${linhasAtlas.error.message}`)
      if (coresAtlas.error) throw new Error(`Falha ao carregar cores Atlas: ${coresAtlas.error.message}`)
      if (vidrosAtlas.error) throw new Error(`Falha ao carregar vidros W.Vetro: ${vidrosAtlas.error.message}`)
      if (catalogoVidrosAtlas.error) {
        throw new Error(`Falha ao carregar catálogo técnico de vidros: ${catalogoVidrosAtlas.error.message}`)
      }

      const normalizar = (valor: unknown) =>
        String(valor || '')
          .normalize('NFC')
          .replace(/\s+/g, ' ')
          .trim()
          .toLocaleUpperCase('pt-BR')

      const pendenciasPorChave = new Map(
        (pendenciasTecnicas || []).map((item: any) => [
          String(item.chave_externa || ''),
          item,
        ]),
      )

      const refsLinhas = new Map(
        (linhasAtlas.data || [])
          .map((item: any) => [normalizar(item.linha_raw), item] as const)
          .filter(([nome]) => !!nome),
      )
      const coresOficiaisLista = (coresAtlas.data || []).map((item: any) => ({
        id: String(item.id || ''),
        nome: normalizar(item.nome),
      })).filter((item: any) => !!item.nome)
      const coresOficiais = new Set(coresOficiaisLista.map((item: any) => item.nome))

      const normalizarSimilaridade = (valor: unknown) =>
        normalizar(valor)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\bMARRON\b/g, 'MARROM')
          .replace(/[^A-Z0-9]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

      const tokensCor = (valor: unknown) =>
        normalizarSimilaridade(valor)
          .split(' ')
          .filter(token => token.length >= 3 && token !== 'COD')

      const sugestoesCor = (nome: string) => {
        const origem = new Set(tokensCor(nome))
        if (!origem.size) return []

        return coresOficiaisLista
          .map((cor: any) => {
            const destino = new Set(tokensCor(cor.nome))
            if (!destino.size) return { ...cor, score: 0 }
            const intersecao = Array.from(origem).filter(token => destino.has(token)).length
            const score = intersecao / Math.min(origem.size, destino.size)
            return { ...cor, score: Number(score.toFixed(3)) }
          })
          .filter((item: any) => item.score >= 0.45)
          .sort((a: any, b: any) => b.score - a.score || a.nome.localeCompare(b.nome, 'pt-BR'))
          .slice(0, 3)
      }
      const referenciasVidros = new Map(
        (vidrosAtlas.data || [])
          .map((item: any) => [normalizar(item.especificacao), item] as const)
          .filter(([nome]) => !!nome),
      )
      const nomesVidrosNeon = new Set(
        (vidrosNeon || []).map((item: any) => normalizar(item.nome)).filter(Boolean),
      )
      const estatisticasVidros = new Map(
        (vidrosHistoricoStats || [])
          .map((item: any) => [normalizar(item.especificacao), item] as const)
          .filter(([nome]) => !!nome),
      )
      const catalogoVidros = new Map<string, any>()
      for (const item of catalogoVidrosAtlas.data || []) {
        for (const valor of [item.chave, item.descricao]) {
          const nome = normalizar(valor)
          if (nome && !catalogoVidros.has(nome)) catalogoVidros.set(nome, item)
        }
      }

      const linhas = (linhasNeon || []).map((item: any) => {
        const nome = normalizar(item.nome)
        const referencia = refsLinhas.get(nome)
        const mapeada = !!referencia?.linha_tecnica_id
        const pendencia = pendenciasPorChave.get(`linha:${nome}`)
        const contexto =
          pendencia?.contexto && typeof pendencia.contexto === 'object'
            ? pendencia.contexto
            : {}
        return {
          nome,
          status: !referencia ? 'sem_referencia' : mapeada ? 'mapeada' : 'pendente_revisao',
          statusMapeamento: referencia?.status_mapeamento || null,
          linhaTecnicaId: referencia?.linha_tecnica_id || null,
          evidenciaUsoHistorico: contexto.evidencia_uso_historico === true,
          ocorrenciasHistoricas: Number(contexto.ocorrencias_itens_historicos || 0),
          documentosHistoricos: Number(contexto.documentos || 0),
        }
      })

      const cores = (coresNeon || []).map((item: any) => {
        const nome = normalizar(item.nome)
        let status = 'pendente_revisao'
        if (coresOficiais.has(nome)) status = 'cor_atlas'
        else if (nomesVidrosNeon.has(nome)) status = 'item_vidro'
        const pendencia = pendenciasPorChave.get(`cor:${nome}`)
        const contexto =
          pendencia?.contexto && typeof pendencia.contexto === 'object'
            ? pendencia.contexto
            : {}
        const ocorrenciasPerfil = Number(contexto.ocorrencias_perfil || 0)
        const ocorrenciasAcessorio = Number(contexto.ocorrencias_acessorio || 0)
        const classificacaoUso =
          ocorrenciasPerfil > 0 && ocorrenciasAcessorio === 0
            ? 'cor_perfil'
            : ocorrenciasAcessorio > 0 && ocorrenciasPerfil === 0
              ? 'acabamento_acessorio'
              : ocorrenciasPerfil > 0 && ocorrenciasAcessorio > 0
                ? 'uso_misto'
                : 'sem_uso'
        return {
          nome,
          status,
          evidenciaUsoHistorico: contexto.evidencia_uso_historico === true,
          ocorrenciasComponentes: Number(contexto.ocorrencias_componentes || 0),
          documentosHistoricos: Number(contexto.documentos || 0),
          ocorrenciasPerfil,
          ocorrenciasAcessorio,
          classificacaoUso,
          sugestoesAtlas:
            status === 'pendente_revisao' && classificacaoUso === 'cor_perfil'
              ? sugestoesCor(nome)
              : [],
        }
      }).sort((a: any, b: any) => {
        const prioridade: Record<string, number> = {
          cor_perfil: 1,
          uso_misto: 2,
          acabamento_acessorio: 3,
          sem_uso: 4,
        }
        return (
          (prioridade[a.classificacaoUso] || 9) - (prioridade[b.classificacaoUso] || 9) ||
          Number(b.ocorrenciasComponentes || 0) - Number(a.ocorrenciasComponentes || 0) ||
          a.nome.localeCompare(b.nome, 'pt-BR')
        )
      })

      const numeroSeguro = (valor: unknown) => {
        const numero = Number(valor)
        return Number.isFinite(numero) ? numero : null
      }

      const vidros = (vidrosNeon || []).map((item: any) => {
        const nome = normalizar(item.nome)
        const referencia: any = referenciasVidros.get(nome)
        const catalogo = catalogoVidros.get(nome)
        const origem =
          referencia?.dados_origem && typeof referencia.dados_origem === 'object'
            ? referencia.dados_origem
            : {}
        const catalogoApi =
          origem?.catalogo_api?.raw && typeof origem.catalogo_api.raw === 'object'
            ? origem.catalogo_api.raw
            : {}
        const area = numeroSeguro(origem.M2Arred) || numeroSeguro(origem.M2)
        const custoAmostra = numeroSeguro(origem.CustoVlr)
        const custoReferenciaM2 =
          area && area > 0 && custoAmostra != null && custoAmostra > 0
            ? Number((custoAmostra / area).toFixed(4))
            : null
        const estatistica: any = estatisticasVidros.get(nome)
        const historicoCustoMediana =
          estatistica?.custo_m2_mediana == null ? null : Number(estatistica.custo_m2_mediana)

        return {
          nome,
          status: catalogo
            ? 'homologado_catalogo'
            : referencia
              ? 'aguardando_homologacao'
              : 'pendente_revisao',
          statusValidacao: referencia?.status_validacao || null,
          produtoAtlasId: referencia?.produto_atlas_id || null,
          catalogoCustoId: catalogo?.id || null,
          catalogoCustoUnitario: catalogo?.custo_unitario == null ? null : Number(catalogo.custo_unitario),
          catalogoUnidade: catalogo?.unidade || null,
          ocorrencias: Number(estatistica?.ocorrencias ?? referencia?.ocorrencias ?? 0),
          ncm: String(catalogoApi.CorNCM || referencia?.ncm || '').trim() || null,
          espessuraMm: numeroSeguro(catalogoApi.CorEspessura),
          pesoKgM2: numeroSeguro(catalogoApi.CorVidroPeso),
          custoReferenciaM2: historicoCustoMediana ?? custoReferenciaM2,
          custoReferenciaFonte:
            historicoCustoMediana != null
              ? 'mediana_historica_wvetro'
              : custoReferenciaM2 == null
                ? null
                : 'amostra_historica_wvetro',
          historicoDocumentos: Number(estatistica?.documentos || 0),
          historicoAreaM2: estatistica?.area_m2 == null ? null : Number(estatistica.area_m2),
          historicoAmostrasCusto: Number(estatistica?.amostras_custo || 0),
          historicoCustoM2Min: estatistica?.custo_m2_min == null ? null : Number(estatistica.custo_m2_min),
          historicoCustoM2Mediana: historicoCustoMediana,
          historicoCustoM2Max: estatistica?.custo_m2_max == null ? null : Number(estatistica.custo_m2_max),
        }
      }).sort((a: any, b: any) =>
        Number(b.ocorrencias || 0) - Number(a.ocorrencias || 0) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
      )

      return NextResponse.json({
        ok: true,
        recurso,
        modo: 'somente-leitura',
        gravacaoWvetro: false,
        gravacaoAtlas: false,
        resumo: {
          linhas: {
            total: linhas.length,
            mapeadas: linhas.filter(item => item.status === 'mapeada').length,
            pendentes: linhas.filter(item => item.status !== 'mapeada').length,
          },
          cores: {
            total: cores.length,
            jaNoAtlas: cores.filter(item => item.status === 'cor_atlas').length,
            itensVidro: cores.filter(item => item.status === 'item_vidro').length,
            pendentes: cores.filter(item => item.status === 'pendente_revisao').length,
            pendentesComUso: cores.filter(
              item => item.status === 'pendente_revisao' && item.evidenciaUsoHistorico,
            ).length,
            pendentesSemUso: cores.filter(
              item => item.status === 'pendente_revisao' && !item.evidenciaUsoHistorico,
            ).length,
            candidatasPerfil: cores.filter(
              item => item.status === 'pendente_revisao' && item.classificacaoUso === 'cor_perfil',
            ).length,
            acabamentosAcessorio: cores.filter(
              item => item.status === 'pendente_revisao' && item.classificacaoUso === 'acabamento_acessorio',
            ).length,
            usoMisto: cores.filter(
              item => item.status === 'pendente_revisao' && item.classificacaoUso === 'uso_misto',
            ).length,
          },
          vidros: {
            total: vidros.length,
            referenciados: vidros.filter(item => item.status !== 'pendente_revisao').length,
            pendentes: vidros.filter(item => item.status !== 'homologado_catalogo').length,
            aguardandoHomologacao: vidros.filter(item => item.status === 'aguardando_homologacao').length,
            homologadosCatalogo: vidros.filter(item => item.status === 'homologado_catalogo').length,
            vinculadosProdutoAtlas: vidros.filter(item => !!item.produtoAtlasId).length,
            comCustoReferencia: vidros.filter(item => item.custoReferenciaM2 != null).length,
          },
        },
        pendencias: {
          linhas: linhas.filter(item => item.status !== 'mapeada'),
          cores: cores.filter(item => item.status === 'pendente_revisao'),
          vidros: vidros.filter(item => item.status !== 'homologado_catalogo'),
        },
      })
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Falha ao auditar catálogos W.Vetro.'
      console.error('Erro na auditoria de catálogos W.Vetro:', error)
      return NextResponse.json({ error: mensagem, recurso }, { status: 502 })
    }
  }

  if (recurso === 'auditoria-relacoes') {
    if (!neon.configurado) {
      return NextResponse.json({ error: 'Staging Neon não configurado.' }, { status: 503 })
    }

    try {
      const sql = neonStaging()
      const rows = await sql`
        select
          origem_recurso,
          origem_chave,
          tipo_relacao,
          destino_recurso,
          destino_chave,
          referencia,
          encontrado,
          confianca,
          regra
        from wvetro_migracao.auditoria_relacoes
        order by
          encontrado asc,
          origem_recurso,
          tipo_relacao,
          referencia nulls last,
          origem_chave
      `

      const normalizados = rows.map((row: any) => ({
        origemRecurso: String(row.origem_recurso || ''),
        origemChave: String(row.origem_chave || ''),
        tipoRelacao: String(row.tipo_relacao || ''),
        destinoRecurso: String(row.destino_recurso || ''),
        destinoChave: String(row.destino_chave || ''),
        referencia: String(row.referencia || '').trim() || null,
        encontrado: row.encontrado === true,
        confianca: String(row.confianca || ''),
        regra: String(row.regra || ''),
      }))

      const evidencias = await carregarEvidenciasAuditoria(usuario.empresa_id, sql)
      const { classificados, referenciasPendentesDistintas } =
        classificarAuditoria(normalizados, evidencias)

      const resumo = classificados.reduce(
        (acc, item) => {
          acc.total += 1
          if (item.encontrado) acc.encontradas += 1
          else acc.ausentes += 1
          if (item.requerAtencao) acc.pendenciasReais += 1
          acc.classificacoes[item.classificacao] =
            (acc.classificacoes[item.classificacao] || 0) + 1
          return acc
        },
        {
          total: 0,
          encontradas: 0,
          ausentes: 0,
          pendenciasReais: 0,
          classificacoes: {} as Record<string, number>,
        },
      )

      ;(resumo as any).referenciasPendentesDistintas = referenciasPendentesDistintas

      const opcoes = {
        origens: Array.from(new Set(classificados.map(item => item.origemRecurso))).sort(),
        relacoes: Array.from(new Set(classificados.map(item => item.tipoRelacao))).sort(),
        confiancas: Array.from(new Set(classificados.map(item => item.confianca))).sort(),
        classificacoes: Array.from(new Set(classificados.map(item => item.classificacao))).sort(),
      }

      const origem = String(req.nextUrl.searchParams.get('origem') || 'todos').trim()
      const relacao = String(req.nextUrl.searchParams.get('relacao') || 'todos').trim()
      const situacao = String(req.nextUrl.searchParams.get('situacao') || 'todos').trim()
      const confianca = String(req.nextUrl.searchParams.get('confianca') || 'todos').trim()
      const classificacao = String(req.nextUrl.searchParams.get('classificacao') || 'todos').trim()
      const busca = String(req.nextUrl.searchParams.get('busca') || '')
        .trim()
        .toLocaleUpperCase('pt-BR')
      const pagina = Math.max(1, Number(req.nextUrl.searchParams.get('pagina') || 1) || 1)
      const limite = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limite') || 50) || 50))

      const filtrados = classificados.filter(item => {
        if (origem !== 'todos' && item.origemRecurso !== origem) return false
        if (relacao !== 'todos' && item.tipoRelacao !== relacao) return false
        if (confianca !== 'todos' && item.confianca !== confianca) return false
        if (classificacao !== 'todos' && item.classificacao !== classificacao) return false
        if (situacao === 'encontradas' && !item.encontrado) return false
        if (situacao === 'ausentes' && item.encontrado) return false
        if (situacao === 'atencao' && !item.requerAtencao) return false
        if (!busca) return true

        const textoBusca = [
          item.origemRecurso,
          item.origemChave,
          item.tipoRelacao,
          item.destinoRecurso,
          item.destinoChave,
          item.referencia,
          item.confianca,
          item.regra,
          item.classificacao,
          item.explicacao,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleUpperCase('pt-BR')

        return textoBusca.includes(busca)
      })

      const total = filtrados.length
      const inicio = (pagina - 1) * limite
      const itens = filtrados.slice(inicio, inicio + limite)
