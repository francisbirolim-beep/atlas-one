import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import {
  criarExecucaoWVetroOperacional,
  salvarStagingWVetroOperacional,
  transformarPayloadWVetroEmStaging,
} from '@/lib/wvetroMigracaoOperacionalServer'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'
import {
  consultarRecursoOperacionalWVetro,
  WVetroOperacionalConsultaParams,
} from '@/lib/wvetroOperacionalConsultaServer'
import {
  mapaWVetroPorRecurso,
  WVetroOperacionalRecurso,
} from '@/lib/wvetroOperacionalMap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function texto(valor: unknown) {
  const v = String(valor ?? '').trim()
  return v || undefined
}

function numeroInteiro(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return undefined
  const n = Number(valor)
  return Number.isInteger(n) ? n : undefined
}

function booleano(valor: unknown) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') {
    if (valor.toLowerCase() === 'true') return true
    if (valor.toLowerCase() === 'false') return false
  }
  return undefined
}

function paramsDoBody(body: Record<string, unknown>): WVetroOperacionalConsultaParams {
  return {
    inicio: texto(body.inicio),
    fim: texto(body.fim),
    pessoaId: texto(body.pessoaId),
    tipoPessoa: texto(body.tipoPessoa),
    vendedorId: texto(body.vendedorId),
    linhaId: texto(body.linhaId),
    ano: numeroInteiro(body.ano),
    mes: numeroInteiro(body.mes),
    id: texto(body.id),
    nfId: texto(body.nfId),
    tipo: texto(body.tipo),
    produtoCodigo: texto(body.produtoCodigo),
    corNome: texto(body.corNome),
    tituloTipo: texto(body.tituloTipo),
    contaNro: texto(body.contaNro),
    loteNro: texto(body.loteNro),
    programacaoNro: texto(body.programacaoNro),
    produzido: booleano(body.produzido),
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  const configuracao = statusConfiguracaoWVetro()
  if (!configuracao.pronto) {
    return NextResponse.json(
      { error: 'Credenciais W.Vetro não configuradas no ambiente.', configuracao },
      { status: 503 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // Corpo opcional: mantém Pessoas em dry-run para compatibilidade.
  }

  const recurso = String(body.recurso || 'pessoas').trim() as WVetroOperacionalRecurso
  const mapa = mapaWVetroPorRecurso(recurso)
  if (!mapa) {
    return NextResponse.json({ error: 'Recurso operacional W.Vetro inválido.' }, { status: 400 })
  }

  const dryRun = body.dryRun !== false
  const params = paramsDoBody(body)

  try {
    const dados = await consultarRecursoOperacionalWVetro(recurso, params)
    const staging = transformarPayloadWVetroEmStaging(recurso, dados)

    const reconciliacao =
      recurso === 'pessoas'
        ? await reconciliarPessoasWVetroComClientesAtlas(dados)
        : null

    const resumoBase = {
      ok: true,
      recurso,
      mapa,
      gravacaoWvetro: false,
      gravacaoAtlasOficial: false,
      capturaveis: staging.registros.length,
      semChave: staging.semChave.length,
      chavesAmostra: staging.registros.slice(0, 30).map(item => ({
        chaveExterna: item.chaveExterna,
        dataReferencia: item.dataReferencia,
        hash: item.payloadHash,
      })),
      ...(reconciliacao
        ? {
            reconciliacao: {
              regra: 'CPF/CNPJ exato e único é o único vínculo seguro automático nesta fase.',
              totais: reconciliacao.totais,
              amostra: reconciliacao.itens.slice(0, 100),
              truncado: reconciliacao.itens.length > 100,
            },
          }
        : {}),
    }

    if (dryRun) {
      return NextResponse.json({
        ...resumoBase,
        modo: 'dry-run',
        gravacaoStaging: false,
      })
    }

    const neon = statusNeonStaging()
    if (!neon.configurado) {
      return NextResponse.json(
        {
          error:
            'Staging Neon não configurado. Defina NEON_STAGING_DATABASE_URL ou provisione Neon pelo Vercel Marketplace.',
          gravacaoWvetro: false,
          gravacaoAtlasOficial: false,
          gravacaoStaging: false,
        },
        { status: 503 },
      )
    }

    if (process.env.WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED !== 'true') {
      return NextResponse.json(
        {
          error:
            'Gravação no Neon bloqueada. Use dryRun=true ou habilite WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED somente após aplicar o schema wvetro_migracao no Neon.',
          gravacaoWvetro: false,
          gravacaoAtlasOficial: false,
          gravacaoStaging: false,
          staging: { provedor: 'neon', ...neon },
        },
        { status: 423 },
      )
    }

    const testeNeon = await testarNeonStaging()
    if (!testeNeon.schemaPronto) {
      return NextResponse.json(
        {
          error:
            'Conexão Neon válida, porém o schema wvetro_migracao ainda não foi aplicado. Execute neon/migrations/20260930_wvetro_migracao_operacional_staging.sql.',
          gravacaoWvetro: false,
          gravacaoAtlasOficial: false,
          gravacaoStaging: false,
          staging: testeNeon,
        },
        { status: 503 },
      )
    }

    const execucaoId = await criarExecucaoWVetroOperacional({
      recurso,
      periodoInicio: params.inicio || null,
      periodoFim: params.fim || null,
      criadoPorId: usuario.id,
      criadoPorNome: usuario.nome,
    })

    const resultado = await salvarStagingWVetroOperacional({
      execucaoId,
      recurso,
      payload: dados,
    })

    return NextResponse.json({
      ...resumoBase,
      modo: 'staging',
      gravacaoStaging: true,
      staging: { provedor: 'neon', database: testeNeon.database },
      execucao: resultado,
    })
  } catch (error) {
    console.error(`Erro na captura operacional W.Vetro/${recurso}:`, error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido na captura W.Vetro.'
    const status = /Informe|não pode|no máximo|inválido|reconhecido/i.test(mensagem) ? 400 : 502
    return NextResponse.json({ error: mensagem, recurso }, { status })
  }
}
