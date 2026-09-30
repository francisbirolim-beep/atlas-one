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

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  const configuracao = statusConfiguracaoWVetro()
  const neon = statusNeonStaging()
  const recurso = String(req.nextUrl.searchParams.get('recurso') || 'mapa').trim()

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

      const origem = String(req.nextUrl.searchParams.get('origem') || 'todos').trim()
      const relacao = String(req.nextUrl.searchParams.get('relacao') || 'todos').trim()
      const situacao = String(req.nextUrl.searchParams.get('situacao') || 'todos').trim()
      const confianca = String(req.nextUrl.searchParams.get('confianca') || 'todos').trim()
      const busca = String(req.nextUrl.searchParams.get('busca') || '')
        .trim()
        .toLocaleUpperCase('pt-BR')
      const pagina = Math.max(1, Number(req.nextUrl.searchParams.get('pagina') || 1) || 1)
      const limite = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limite') || 50) || 50))

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

      const resumo = normalizados.reduce(
        (acc, item) => {
          acc.total += 1
          if (item.encontrado) acc.encontradas += 1
          else acc.ausentes += 1
          return acc
        },
        { total: 0, encontradas: 0, ausentes: 0 },
      )

      const opcoes = {
        origens: Array.from(new Set(normalizados.map(item => item.origemRecurso))).sort(),
        relacoes: Array.from(new Set(normalizados.map(item => item.tipoRelacao))).sort(),
        confiancas: Array.from(new Set(normalizados.map(item => item.confianca))).sort(),
      }

      const filtrados = normalizados.filter(item => {
        if (origem !== 'todos' && item.origemRecurso !== origem) return false
        if (relacao !== 'todos' && item.tipoRelacao !== relacao) return false
        if (confianca !== 'todos' && item.confianca !== confianca) return false
        if (situacao === 'encontradas' && !item.encontrado) return false
        if (situacao === 'ausentes' && item.encontrado) return false
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
        filtros: { origem, relacao, situacao, confianca, busca: busca || null },
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
            (select max(capturado_em) from wvetro_migracao.raw) as ultima_captura
        `
        resumoNeon = rows[0] || null
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
