import { NextRequest, NextResponse } from 'next/server'
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

async function autenticarMaster(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

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
  titulosHistoricoFinanceiro: Set<string>
  projetosPresentesNosLotes: Set<string>
}

async function carregarEvidenciasAuditoria(
  empresaId: string,
  sql: ReturnType<typeof neonStaging>,
): Promise<EvidenciasAuditoria> {
  const [comercial, financeiro, projetosLote] = await Promise.all([
    supabaseAdmin
      .from('wvetro_historico_comercial')
      .select('numero_wvetro')
      .eq('empresa_id', empresaId)
      .eq('somente_historico', true)
      .not('numero_wvetro', 'is', null),
    supabaseAdmin
      .from('wvetro_historico_financeiro')
      .select('titulo_id_wvetro')
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
  if (financeiro.error) throw new Error(`Falha ao consultar histórico financeiro W.Vetro: ${financeiro.error.message}`)

  return {
    numerosHistoricoComercial: new Set(
      (comercial.data || []).map((item: any) => String(item.numero_wvetro || '').trim()).filter(Boolean),
    ),
    titulosHistoricoFinanceiro: new Set(
      (financeiro.data || []).map((item: any) => String(item.titulo_id_wvetro || '').trim()).filter(Boolean),
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
      } else {
        classificacao = 'referencia_orcamento_nao_localizada'
        explicacao = 'O número de orçamento não foi localizado nem no staging atual nem no histórico comercial isolado.'
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
  const usuario = await autenticarMaster(req)
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
      const [linhasNeon, coresNeon, vidrosNeon, pendenciasTecnicas, linhasAtlas, coresAtlas, vidrosAtlas] =
        await Promise.all([
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
            .select('nome,ativo'),
          supabaseAdmin
            .from('wvetro_referencias_vidros')
            .select('especificacao,status_validacao,produto_atlas_id'),
        ])

      if (linhasAtlas.error) throw new Error(`Falha ao carregar linhas W.Vetro: ${linhasAtlas.error.message}`)
      if (coresAtlas.error) throw new Error(`Falha ao carregar cores Atlas: ${coresAtlas.error.message}`)
      if (vidrosAtlas.error) throw new Error(`Falha ao carregar vidros W.Vetro: ${vidrosAtlas.error.message}`)

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
      const coresOficiais = new Set(
        (coresAtlas.data || []).map((item: any) => normalizar(item.nome)).filter(Boolean),
      )
      const referenciasVidros = new Map(
        (vidrosAtlas.data || [])
          .map((item: any) => [normalizar(item.especificacao), item] as const)
          .filter(([nome]) => !!nome),
      )
      const nomesVidrosNeon = new Set(
        (vidrosNeon || []).map((item: any) => normalizar(item.nome)).filter(Boolean),
      )

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
        return {
          nome,
          status,
          evidenciaUsoHistorico: contexto.evidencia_uso_historico === true,
          ocorrenciasComponentes: Number(contexto.ocorrencias_componentes || 0),
          documentosHistoricos: Number(contexto.documentos || 0),
          ocorrenciasPerfil: Number(contexto.ocorrencias_perfil || 0),
          ocorrenciasAcessorio: Number(contexto.ocorrencias_acessorio || 0),
        }
      })

      const vidros = (vidrosNeon || []).map((item: any) => {
        const nome = normalizar(item.nome)
        const referencia = referenciasVidros.get(nome)
        return {
          nome,
          status: referencia ? 'referencia_wvetro' : 'pendente_revisao',
          statusValidacao: referencia?.status_validacao || null,
          produtoAtlasId: referencia?.produto_atlas_id || null,
        }
      })

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
          },
          vidros: {
            total: vidros.length,
            referenciados: vidros.filter(item => item.status === 'referencia_wvetro').length,
            pendentes: vidros.filter(item => item.status === 'pendente_revisao').length,
            vinculadosProdutoAtlas: vidros.filter(item => !!item.produtoAtlasId).length,
          },
        },
        pendencias: {
          linhas: linhas.filter(item => item.status !== 'mapeada'),
          cores: cores.filter(item => item.status === 'pendente_revisao'),
          vidros: vidros.filter(item => item.status === 'pendente_revisao'),
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

      return NextResponse.json({
        ok: true,
        recurso,
        modo: 'somente-leitura',
        gravacaoWvetro: false,
        gravacaoAtlas: false,
        resumo,
        opcoes,
        filtros: { origem, relacao, situacao, confianca, classificacao, busca: busca || null },
        pagina,
        limite,
        total,
        paginas: Math.max(1, Math.ceil(total / limite)),
        itens,
      })
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Falha ao carregar auditoria de relações.'
      console.error('Erro ao carregar auditoria de relações W.Vetro:', error)
      return NextResponse.json({ error: mensagem, recurso }, { status: 502 })
    }
  }

  if (recurso === 'staging-clientes') {
    if (!neon.configurado) {
      return NextResponse.json({ error: 'Staging Neon não configurado.' }, { status: 503 })
    }

    try {
      const sql = neonStaging()
      const rows = await sql`
        select
          r.chave_externa,
          r.payload->>'PessoaId' as pessoa_id,
          r.payload->>'PessoaCodigo' as pessoa_codigo,
          coalesce(
            nullif(r.payload->>'PessoaRazaoSocial', ''),
            nullif(r.payload->>'PessoaFantasia', ''),
            nullif(r.payload->>'PessoaResponsavel', ''),
            ''
          ) as nome,
          nullif(r.payload->>'PessoaCPFCNPJ', '') as cpf_cnpj,
          nullif(r.payload->>'PessoaFone', '') as telefone,
          nullif(r.payload->>'PessoaCelular', '') as celular,
          nullif(r.payload->>'PessoaEmail', '') as email,
          nullif(r.payload->>'CidadeNome', '') as cidade,
          v.status,
          v.metodo_match,
          v.atlas_id::text as atlas_id,
          v.confianca::text as confianca,
          v.dados_reconciliacao
        from wvetro_migracao.raw r
        join wvetro_migracao.vinculos v
          on v.recurso = r.recurso
         and v.chave_externa = r.chave_externa
         and v.entidade_atlas = 'cliente'
        where r.recurso = 'pessoas_cliente'
        order by
          case
            when v.status = 'sugerido' and v.metodo_match = 'contato_composto' then 1
            when v.status = 'sugerido' and v.metodo_match = 'contato_parcial' then 2
            when v.status = 'vinculado' then 3
            when v.status = 'divergente' then 4
            else 5
          end,
          nome,
          r.chave_externa
      `

      const atlasIds = Array.from(
        new Set(
          rows
            .map((row: any) => String(row.atlas_id || '').trim())
            .filter(Boolean),
        ),
      )

      const nomesAtlas = new Map<string, string>()
      if (atlasIds.length > 0) {
        const { data: clientesAtlas, error: clientesErro } = await supabaseAdmin
          .from('clientes')
          .select('id,nome')
          .eq('empresa_id', usuario.empresa_id)
          .in('id', atlasIds)

        if (clientesErro) throw new Error(`Falha ao resolver clientes Atlas: ${clientesErro.message}`)
        for (const cliente of clientesAtlas || []) {
          nomesAtlas.set(String(cliente.id), String(cliente.nome || ''))
        }
      }

      const classificar = (row: any) => {
        if (row.status === 'vinculado') return 'vinculado_seguro'
        if (row.status === 'divergente') return 'divergente'
        if (row.status === 'novo') return 'novo'
        if (row.status === 'sugerido' && row.metodo_match === 'contato_composto') return 'sugestao_forte'
        if (row.status === 'sugerido') return 'revisao'
        return 'revisao'
      }

      const filtro = String(req.nextUrl.searchParams.get('status') || 'todos').trim()
      const busca = String(req.nextUrl.searchParams.get('busca') || '').trim().toLocaleUpperCase('pt-BR')
      const pagina = Math.max(1, Number(req.nextUrl.searchParams.get('pagina') || 1) || 1)
      const limite = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limite') || 50) || 50))

      const itens = rows.map((row: any) => {
        const atlasId = String(row.atlas_id || '').trim() || null
        const dados = row.dados_reconciliacao && typeof row.dados_reconciliacao === 'object'
          ? row.dados_reconciliacao
          : {}

        return {
          chaveExterna: String(row.chave_externa || ''),
          pessoaId: String(row.pessoa_id || '').trim() || null,
          pessoaCodigo: String(row.pessoa_codigo || '').trim() || null,
          nome: String(row.nome || ''),
          cpfCnpj: String(row.cpf_cnpj || '').trim() || null,
          telefone: String(row.telefone || '').trim() || null,
          celular: String(row.celular || '').trim() || null,
          email: String(row.email || '').trim() || null,
          cidade: String(row.cidade || '').trim() || null,
          status: classificar(row),
          clienteAtlasId: atlasId,
          clienteAtlasNome: atlasId ? nomesAtlas.get(atlasId) || null : null,
          metodo: String(row.metodo_match || '').trim() || null,
          confianca: row.confianca == null ? null : Number(row.confianca),
          motivos: Array.isArray((dados as any).motivos)
            ? (dados as any).motivos.map((motivo: unknown) => String(motivo))
            : [],
        }
      }).filter((item: any) => {
        if (filtro !== 'todos' && item.status !== filtro) return false
        if (!busca) return true

        const textoBusca = [
          item.nome,
          item.cpfCnpj,
          item.telefone,
          item.celular,
          item.email,
          item.cidade,
          item.clienteAtlasNome,
          item.pessoaId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleUpperCase('pt-BR')

        return textoBusca.includes(busca)
      })

      const total = itens.length
      const inicio = (pagina - 1) * limite
      const paginaItens = itens.slice(inicio, inicio + limite)

      return NextResponse.json({
        ok: true,
        recurso,
        modo: 'somente-leitura',
        gravacaoWvetro: false,
        gravacaoAtlas: false,
        filtro,
        busca: busca || null,
        pagina,
        limite,
        total,
        paginas: Math.max(1, Math.ceil(total / limite)),
        itens: paginaItens,
      })
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Falha ao carregar fila do staging.'
      console.error('Erro ao carregar fila de clientes W.Vetro no Neon:', error)
      return NextResponse.json({ error: mensagem, recurso }, { status: 502 })
    }
  }

  if (recurso === 'mapa') {
    let testeNeon: unknown = null
    let resumoNeon: unknown = null
    let historicoAtlas: unknown = null

    try {
      const [
        comercialTotal,
        comercialHistorico,
        comercialClientes,
        financeiroTotal,
        financeiroHistorico,
        financeiroClientes,
        operacionalTotal,
        operacionalHistorico,
        operacionalClientes,
        suprimentosTotal,
        suprimentosHistorico,
      ] = await Promise.all([
        supabaseAdmin
          .from('wvetro_historico_comercial')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabaseAdmin
          .from('wvetro_historico_comercial')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('somente_historico', true),
        supabaseAdmin
          .from('wvetro_historico_comercial')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('status_vinculo', 'seguro')
          .not('cliente_id', 'is', null),
        supabaseAdmin
          .from('wvetro_historico_financeiro')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabaseAdmin
          .from('wvetro_historico_financeiro')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('somente_historico', true),
        supabaseAdmin
          .from('wvetro_historico_financeiro')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('status_vinculo', 'seguro')
          .not('cliente_id', 'is', null),
        supabaseAdmin
          .from('wvetro_historico_operacional')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabaseAdmin
          .from('wvetro_historico_operacional')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('somente_historico', true),
        supabaseAdmin
          .from('wvetro_historico_operacional')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('status_vinculo', 'seguro')
          .not('cliente_id', 'is', null),
        supabaseAdmin
          .from('wvetro_historico_suprimentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabaseAdmin
          .from('wvetro_historico_suprimentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('somente_historico', true),
      ])

      const respostas = [
        comercialTotal,
        comercialHistorico,
        comercialClientes,
        financeiroTotal,
        financeiroHistorico,
        financeiroClientes,
        operacionalTotal,
        operacionalHistorico,
        operacionalClientes,
        suprimentosTotal,
        suprimentosHistorico,
      ]

      const falha = respostas.find(resposta => resposta.error)
      if (falha?.error) throw new Error(falha.error.message)

      const camada = (
        total: number | null,
        historico: number | null,
        comCliente: number | null,
      ) => {
        const totalSeguro = total ?? 0
        const historicoSeguro = historico ?? 0
        return {
          total: totalSeguro,
          somenteHistorico: historicoSeguro,
          foraHistorico: Math.max(0, totalSeguro - historicoSeguro),
          comCliente: comCliente ?? 0,
        }
      }

      const camadas = {
        comercial: camada(comercialTotal.count, comercialHistorico.count, comercialClientes.count),
        financeiro: camada(financeiroTotal.count, financeiroHistorico.count, financeiroClientes.count),
        operacional: camada(operacionalTotal.count, operacionalHistorico.count, operacionalClientes.count),
        suprimentos: camada(suprimentosTotal.count, suprimentosHistorico.count, 0),
      }

      historicoAtlas = {
        total:
          camadas.comercial.total +
          camadas.financeiro.total +
          camadas.operacional.total +
          camadas.suprimentos.total,
        somenteHistorico:
          camadas.comercial.somenteHistorico +
          camadas.financeiro.somenteHistorico +
          camadas.operacional.somenteHistorico +
          camadas.suprimentos.somenteHistorico,
        foraHistorico:
          camadas.comercial.foraHistorico +
          camadas.financeiro.foraHistorico +
          camadas.operacional.foraHistorico +
          camadas.suprimentos.foraHistorico,
        comCliente:
          camadas.comercial.comCliente +
          camadas.financeiro.comCliente +
          camadas.operacional.comCliente,
        camadas,
      }
    } catch (error) {
      historicoAtlas = {
        erro:
          error instanceof Error
            ? error.message
            : 'Falha ao carregar histórico materializado no Atlas.',
      }
    }

    if (neon.configurado) {
      try {
        const sql = neonStaging()
        const rows = await sql`
          select
            (select count(*)::int from wvetro_migracao.raw where recurso = 'orcamentos') as orcamentos,
            (select count(*)::int from wvetro_migracao.raw where recurso = 'pessoas_cliente') as clientes_cl,
            (select count(*)::int from wvetro_migracao.raw where recurso = 'producao_projeto') as producao_projeto,
            (select count(*)::int from wvetro_migracao.execucoes where status = 'concluida') as execucoes_concluidas,
            (select count(*)::int from wvetro_migracao.vinculos
              where recurso = 'pessoas_cliente' and entidade_atlas = 'cliente' and status = 'vinculado') as clientes_vinculados,
            (select count(*)::int from wvetro_migracao.vinculos
              where recurso = 'pessoas_cliente' and entidade_atlas = 'cliente'
                and status = 'sugerido' and metodo_match = 'contato_composto') as sugestoes_fortes,
            (select count(*)::int from wvetro_migracao.vinculos
              where recurso = 'pessoas_cliente' and entidade_atlas = 'cliente'
                and status = 'sugerido' and metodo_match = 'contato_parcial') as sugestoes_revisao,
            (select count(*)::int from wvetro_migracao.vinculos
              where recurso = 'pessoas_cliente' and entidade_atlas = 'cliente' and status = 'novo') as clientes_novos,
            (select count(*)::int from wvetro_migracao.vinculos
              where recurso = 'pessoas_cliente' and entidade_atlas = 'cliente' and status = 'divergente') as clientes_divergentes,
            (select count(*)::int from wvetro_migracao.auditoria_relacoes) as auditoria_relacoes,
            (select count(*)::int from wvetro_migracao.auditoria_relacoes where encontrado) as auditoria_encontradas,
            (select count(*)::int from wvetro_migracao.auditoria_relacoes where not encontrado) as auditoria_ausentes,
            (
              select count(*)::int
              from wvetro_migracao.auditoria_relacoes a
              where not a.encontrado
                and not (a.origem_recurso = 'pedidos' and a.tipo_relacao = 'numero_compartilhado')
                and not (a.origem_recurso = 'titulos_baixados' and a.tipo_relacao = 'titulo_mesmo_id')
                and coalesce(a.referencia, '') <> '0'
                and not (
                  a.destino_recurso = 'orcamentos'
                  and exists (
                    select 1
                    from wvetro_migracao.raw_canonico p
                    where p.recurso = 'pedidos'
                      and p.payload->>'Nro' = a.referencia
                  )
                )
                and not (
                  a.origem_recurso = 'instalacoes'
                  and a.tipo_relacao = 'projeto_producao'
                  and exists (
                    select 1
                    from wvetro_migracao.auditoria_relacoes lote
                    where lote.origem_recurso = 'instalacoes'
                      and lote.origem_chave = a.origem_chave
                      and lote.tipo_relacao = 'lote_producao'
                      and lote.encontrado
                  )
                )
                and not (
                  a.destino_recurso = 'orcamentos'
                  and nullif(trim(a.referencia), '') is not null
                  and a.origem_recurso in ('titulos','lotes_producao','producao_projeto','instalacoes')
                  and a.confianca in ('documental','declarada_payload')
                )
            ) as auditoria_pendencias_reais,
            (select max(capturado_em) from wvetro_migracao.raw) as ultima_captura
        `
        resumoNeon = rows[0] || null

        const ausentes = await sql`
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
          where not encontrado
        `

        const ausentesNormalizados: AuditoriaNormalizada[] = ausentes.map((row: any) => ({
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

        const evidenciasResumo = await carregarEvidenciasAuditoria(usuario.empresa_id, sql)
        const classificacaoResumo = classificarAuditoria(
          ausentesNormalizados,
          evidenciasResumo,
        )

        if (resumoNeon && typeof resumoNeon === 'object') {
          ;(resumoNeon as any).auditoria_pendencias_reais =
            classificacaoResumo.classificados.filter(item => item.requerAtencao).length
          ;(resumoNeon as any).auditoria_referencias_pendentes_distintas =
            classificacaoResumo.referenciasPendentesDistintas
        }
      } catch (error) {
        resumoNeon = {
          erro: error instanceof Error ? error.message : 'Falha ao carregar resumo do staging Neon.',
        }
      }
    }

    if (req.nextUrl.searchParams.get('testarNeon') === '1' && neon.configurado) {
      try {
        testeNeon = await testarNeonStaging()
      } catch (error) {
        testeNeon = {
          ok: false,
          error: error instanceof Error ? error.message : 'Falha ao testar Neon.',
        }
      }
    }

    return NextResponse.json({
      ok: true,
      modo: 'somente-leitura',
      gravacaoWvetro: false,
      gravacaoAtlas: false,
      configuracao,
      staging: {
        provedor: 'neon',
        ...neon,
        teste: testeNeon,
        resumo: resumoNeon,
      },
      historicoAtlas,
      recursos: WVETRO_MIGRACAO_OPERACIONAL_MAPA,
    })
  }

  const mapa = mapaWVetroPorRecurso(recurso)
  if (!mapa) {
    return NextResponse.json(
      {
        error: 'Recurso inválido.',
        recursosValidos: WVETRO_MIGRACAO_OPERACIONAL_MAPA.map(item => item.recurso),
      },
      { status: 400 },
    )
  }

  if (!configuracao.pronto) {
    return NextResponse.json(
      {
        error: 'Credenciais da API W.Vetro não configuradas no ambiente.',
        configuracao,
      },
      { status: 503 },
    )
  }

  try {
    const params = paramsDaUrl(req)
    if (recurso === 'pessoas' && !params.tipoPessoa) params.tipoPessoa = 'CL'

    const dados = await consultarRecursoOperacionalWVetro(
      recurso as WVetroOperacionalRecurso,
      params,
    )
    const preview = montarPreview(dados)

    const reconciliacao =
      recurso === 'pessoas' && req.nextUrl.searchParams.get('reconciliar') === '1'
        ? await reconciliarPessoasWVetroComClientesAtlas(dados, usuario.empresa_id, {
            categoriaClienteConfirmada: params.tipoPessoa?.toUpperCase() === 'CL',
            origemCategoria: params.tipoPessoa ? `Tipopessoa=${params.tipoPessoa}` : null,
          })
        : null

    return NextResponse.json({
      ok: true,
      recurso,
      modo: 'somente-leitura',
      gravacaoWvetro: false,
      gravacaoAtlas: false,
      mapa,
      ...preview,
      ...(reconciliacao
        ? {
            reconciliacao: {
              regra: 'CPF/CNPJ exato e único é o único vínculo seguro automático nesta fase.',
              totais: reconciliacao.totais,
              itens: reconciliacao.itens.slice(0, 100),
              truncado: reconciliacao.itens.length > 100,
            },
          }
        : {}),
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao consultar W.Vetro.'
    const status = /Informe|não pode|no máximo|inválido|reconhecido/i.test(mensagem) ? 400 : 502
    console.error('Erro no preview de migração operacional W.Vetro:', error)
    return NextResponse.json({ error: mensagem, recurso }, { status })
  }
}
