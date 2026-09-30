import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buscarPedidoWVetro,
  listarContasWVetro,
  listarCoresWVetro,
  listarExtratoWVetro,
  listarInstalacoesWVetro,
  listarItensNotaEntradaWVetro,
  listarLinhasWVetro,
  listarLotesProducaoWVetro,
  listarMetasWVetro,
  listarMovimentosEstoqueWVetro,
  listarNotasEntradaWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarPessoasWVetro,
  listarPlanoContasWVetro,
  listarProducaoProjetoWVetro,
  listarTiposPessoaWVetro,
  listarTitulosBaixadosWVetro,
  listarTitulosWVetro,
  listarVendedoresWVetro,
  listarVidrosWVetro,
  statusConfiguracaoWVetro,
} from '@/lib/wvetroApi'
import {
  mapaWVetroPorRecurso,
  WVETRO_MIGRACAO_OPERACIONAL_MAPA,
  WVetroOperacionalRecurso,
} from '@/lib/wvetroOperacionalMap'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'

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
    .select('id,nome,role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function dataIsoValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

function validarPeriodo(req: NextRequest, limiteDias = 7) {
  const inicio = req.nextUrl.searchParams.get('inicio')
  const fim = req.nextUrl.searchParams.get('fim')

  if (!dataIsoValida(inicio) || !dataIsoValida(fim)) {
    throw new Error('Informe inicio e fim no formato YYYY-MM-DD.')
  }

  const inicioMs = new Date(`${inicio}T00:00:00Z`).getTime()
  const fimMs = new Date(`${fim}T00:00:00Z`).getTime()
  const dias = Math.floor((fimMs - inicioMs) / 86_400_000)

  if (dias < 0) throw new Error('A data final não pode ser anterior à data inicial.')
  if (dias > limiteDias) {
    throw new Error(`A API W.Vetro deve ser consultada em lotes de no máximo ${limiteDias} dias.`)
  }

  return { inicio, fim, dias }
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

async function consultarRecurso(req: NextRequest, recurso: WVetroOperacionalRecurso) {
  if (recurso === 'pessoas') {
    return listarPessoasWVetro({
      pessoaId: param(req, 'pessoaId'),
      tipoPessoa: param(req, 'tipoPessoa'),
    })
  }

  if (recurso === 'tipos_pessoa') return listarTiposPessoaWVetro()
  if (recurso === 'vendedores') return listarVendedoresWVetro(param(req, 'vendedorId'))
  if (recurso === 'linhas') return listarLinhasWVetro()
  if (recurso === 'cores') return listarCoresWVetro()
  if (recurso === 'vidros') return listarVidrosWVetro()

  if (recurso === 'pedido') {
    const id = param(req, 'id')
    if (!id) throw new Error('Informe id do orçamento/pedido W.Vetro.')
    return buscarPedidoWVetro(id)
  }

  if (recurso === 'metas') {
    const ano = inteiro(req, 'ano')
    const mes = inteiro(req, 'mes')
    if (!ano || !mes || mes < 1 || mes > 12) throw new Error('Informe ano e mes válidos.')
    return listarMetasWVetro({
      vendedorId: param(req, 'vendedorId'),
      linhaId: param(req, 'linhaId'),
      ano,
      mes,
    })
  }

  if (recurso === 'itens_nf') {
    const nfId = param(req, 'nfId')
    if (!nfId) throw new Error('Informe nfId.')
    return listarItensNotaEntradaWVetro(nfId)
  }

  if (recurso === 'contas') return listarContasWVetro(param(req, 'contaNro'))
  if (recurso === 'plano_contas') return listarPlanoContasWVetro()

  const periodo = validarPeriodo(req, 7)

  if (recurso === 'orcamentos') return listarOrcamentosWVetro(periodo.inicio, periodo.fim)
  if (recurso === 'pedidos') return listarPedidosWVetro(periodo.inicio, periodo.fim)
  if (recurso === 'notas_entrada') return listarNotasEntradaWVetro(periodo.inicio, periodo.fim)

  if (recurso === 'estoque_movimentos') {
    return listarMovimentosEstoqueWVetro(periodo.inicio, periodo.fim, {
      tipo: param(req, 'tipo'),
      produtoCodigo: param(req, 'produtoCodigo'),
      corNome: param(req, 'corNome'),
    })
  }

  if (recurso === 'titulos') {
    return listarTitulosWVetro(periodo.inicio, periodo.fim, param(req, 'tituloTipo'))
  }

  if (recurso === 'titulos_baixados') {
    return listarTitulosBaixadosWVetro(periodo.inicio, periodo.fim, param(req, 'tituloTipo'))
  }

  if (recurso === 'extrato') {
    return listarExtratoWVetro(periodo.inicio, periodo.fim, {
      contaNro: param(req, 'contaNro'),
      tipo: param(req, 'tipo'),
    })
  }

  if (recurso === 'lotes_producao') {
    const produzidoRaw = param(req, 'produzido')
    const produzido =
      produzidoRaw === undefined ? undefined : produzidoRaw.toLowerCase() === 'true'

    return listarLotesProducaoWVetro({
      loteNro: param(req, 'loteNro'),
      inicio: periodo.inicio,
      fim: periodo.fim,
      produzido,
    })
  }

  if (recurso === 'producao_projeto') {
    return listarProducaoProjetoWVetro({
      loteNro: param(req, 'loteNro'),
      inicio: periodo.inicio,
      fim: periodo.fim,
    })
  }

  if (recurso === 'instalacoes') {
    return listarInstalacoesWVetro({
      programacaoNro: param(req, 'programacaoNro'),
      inicio: periodo.inicio,
      fim: periodo.fim,
    })
  }

  throw new Error('Recurso operacional não reconhecido.')
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  const configuracao = statusConfiguracaoWVetro()
  const neon = statusNeonStaging()
  const recurso = String(req.nextUrl.searchParams.get('recurso') || 'mapa').trim()

  if (recurso === 'mapa') {
    let testeNeon: unknown = null
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
    const dados = await consultarRecurso(req, recurso as WVetroOperacionalRecurso)
    const preview = montarPreview(dados)

    const reconciliacao =
      recurso === 'pessoas' && req.nextUrl.searchParams.get('reconciliar') === '1'
        ? await reconciliarPessoasWVetroComClientesAtlas(dados)
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
