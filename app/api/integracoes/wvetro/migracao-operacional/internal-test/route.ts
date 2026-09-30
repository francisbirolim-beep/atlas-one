import { NextRequest, NextResponse } from 'next/server'
import { statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import { statusNeonStaging, testarNeonStaging, neonStaging } from '@/lib/neonStaging'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import {
  criarExecucaoWVetroOperacional,
  salvarStagingWVetroOperacional,
  transformarPayloadWVetroEmStaging,
} from '@/lib/wvetroMigracaoOperacionalServer'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { mapaWVetroPorRecurso, WVetroOperacionalRecurso } from '@/lib/wvetroOperacionalMap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function autorizado(req: NextRequest) {
  const esperado = String(process.env.WVETRO_MIGRACAO_INTERNAL_TOKEN || '')
  const recebido = String(req.headers.get('x-migration-token') || '')
  return esperado.length >= 32 && recebido === esperado
}

function params(body: Record<string, unknown>) {
  return {
    inicio: typeof body.inicio === 'string' ? body.inicio : undefined,
    fim: typeof body.fim === 'string' ? body.fim : undefined,
    pessoaId: typeof body.pessoaId === 'string' ? body.pessoaId : undefined,
    tipoPessoa: typeof body.tipoPessoa === 'string' ? body.tipoPessoa : undefined,
    vendedorId: typeof body.vendedorId === 'string' ? body.vendedorId : undefined,
    linhaId: typeof body.linhaId === 'string' ? body.linhaId : undefined,
    ano: Number.isInteger(Number(body.ano)) ? Number(body.ano) : undefined,
    mes: Number.isInteger(Number(body.mes)) ? Number(body.mes) : undefined,
    id: typeof body.id === 'string' ? body.id : undefined,
    nfId: typeof body.nfId === 'string' ? body.nfId : undefined,
    tipo: typeof body.tipo === 'string' ? body.tipo : undefined,
    produtoCodigo: typeof body.produtoCodigo === 'string' ? body.produtoCodigo : undefined,
    corNome: typeof body.corNome === 'string' ? body.corNome : undefined,
    tituloTipo: typeof body.tituloTipo === 'string' ? body.tituloTipo : undefined,
    contaNro: typeof body.contaNro === 'string' ? body.contaNro : undefined,
    loteNro: typeof body.loteNro === 'string' ? body.loteNro : undefined,
    programacaoNro: typeof body.programacaoNro === 'string' ? body.programacaoNro : undefined,
    produzido: typeof body.produzido === 'boolean' ? body.produzido : undefined,
  }
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let testeNeon: unknown = null
  try {
    testeNeon = await testarNeonStaging()
  } catch (error) {
    testeNeon = { ok: false, error: error instanceof Error ? error.message : 'Falha Neon.' }
  }

  return NextResponse.json({
    ok: true,
    wvetro: statusConfiguracaoWVetro(),
    neon: statusNeonStaging(),
    testeNeon,
    writeEnabled: process.env.WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED === 'true',
  })
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const acao = String(body.acao || 'dry-run')
  const recurso = String(body.recurso || 'pessoas') as WVetroOperacionalRecurso

  if (!mapaWVetroPorRecurso(recurso)) {
    return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
  }

  if (acao === 'count') {
    const sql = neonStaging()
    const rows = await sql`
      select
        (select count(*)::int from wvetro_migracao.execucoes where recurso = ${recurso}) as execucoes,
        (select count(*)::int from wvetro_migracao.raw where recurso = ${recurso}) as raw,
        (select count(*)::int from wvetro_migracao.pendencias where recurso = ${recurso}) as pendencias
    `
    return NextResponse.json({ ok: true, recurso, contagem: rows[0] || null })
  }

  const dados = await consultarRecursoOperacionalWVetro(recurso, params(body))
  const staging = transformarPayloadWVetroEmStaging(recurso, dados)
  const reconciliacao =
    recurso === 'pessoas' ? await reconciliarPessoasWVetroComClientesAtlas(dados) : null

  if (acao === 'dry-run') {
    return NextResponse.json({
      ok: true,
      modo: 'dry-run',
      recurso,
      capturaveis: staging.registros.length,
      semChave: staging.semChave.length,
      reconciliacao: reconciliacao?.totais || null,
    })
  }

  if (acao !== 'capture') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  if (process.env.WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Escrita staging bloqueada.' }, { status: 423 })
  }

  const teste = await testarNeonStaging()
  if (!teste.schemaPronto) {
    return NextResponse.json({ error: 'Schema Neon não está pronto.' }, { status: 503 })
  }

  const p = params(body)
  const execucaoId = await criarExecucaoWVetroOperacional({
    recurso,
    periodoInicio: p.inicio || null,
    periodoFim: p.fim || null,
    criadoPorNome: 'teste-interno-preview',
  })

  const resultado = await salvarStagingWVetroOperacional({
    execucaoId,
    recurso,
    payload: dados,
  })

  return NextResponse.json({
    ok: true,
    modo: 'staging',
    recurso,
    execucao: resultado,
    reconciliacao: reconciliacao?.totais || null,
  })
}
