import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import {
  mapaWVetroPorRecurso,
  WVETRO_MIGRACAO_OPERACIONAL_MAPA,
  WVetroOperacionalRecurso,
} from '@/lib/wvetroOperacionalMap'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'
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
