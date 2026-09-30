import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listarPessoasWVetro, statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import {
  criarExecucaoWVetroOperacional,
  salvarStagingWVetroOperacional,
  transformarPayloadWVetroEmStaging,
} from '@/lib/wvetroMigracaoOperacionalServer'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'

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
    // Corpo é opcional. Sem body a rota executa em dry-run.
  }

  const dryRun = body.dryRun !== false
  const pessoaId = texto(body.pessoaId)
  const tipoPessoa = texto(body.tipoPessoa)

  try {
    const dados = await listarPessoasWVetro({ pessoaId, tipoPessoa })
    const staging = transformarPayloadWVetroEmStaging('pessoas', dados)
    const reconciliacao = await reconciliarPessoasWVetroComClientesAtlas(dados)

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        recurso: 'pessoas',
        modo: 'dry-run',
        gravacaoWvetro: false,
        gravacaoAtlasOficial: false,
        gravacaoStaging: false,
        capturaveis: staging.registros.length,
        semChave: staging.semChave.length,
        chavesAmostra: staging.registros.slice(0, 30).map(item => ({
          chaveExterna: item.chaveExterna,
          hash: item.payloadHash,
        })),
        reconciliacao: {
          regra: 'CPF/CNPJ exato e único é o único vínculo seguro automático nesta fase.',
          totais: reconciliacao.totais,
          amostra: reconciliacao.itens.slice(0, 100),
          truncado: reconciliacao.itens.length > 100,
        },
      })
    }

    const neon = statusNeonStaging()
    if (!neon.configurado) {
      return NextResponse.json(
        {
          error: 'Staging Neon não configurado. Defina NEON_STAGING_DATABASE_URL no ambiente servidor.',
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
      recurso: 'pessoas',
      criadoPorId: usuario.id,
      criadoPorNome: usuario.nome,
    })

    const resultado = await salvarStagingWVetroOperacional({
      execucaoId,
      recurso: 'pessoas',
      payload: dados,
    })

    return NextResponse.json({
      ok: true,
      recurso: 'pessoas',
      modo: 'staging',
      gravacaoWvetro: false,
      gravacaoAtlasOficial: false,
      gravacaoStaging: true,
      staging: { provedor: 'neon', database: testeNeon.database },
      execucao: resultado,
      reconciliacao: {
        totais: reconciliacao.totais,
        amostra: reconciliacao.itens.slice(0, 100),
        truncado: reconciliacao.itens.length > 100,
      },
    })
  } catch (error) {
    console.error('Erro na captura operacional W.Vetro/Pessoas:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido na captura W.Vetro.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}
