import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { reconciliarPessoasWVetroComClientesAtlas } from '@/lib/wvetroReconciliacaoPessoasServer'
import { statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import { statusNeonStaging, testarNeonStaging } from '@/lib/neonStaging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function autorizado(req: NextRequest) {
  const esperado = String(process.env.WVETRO_MIGRACAO_INTERNAL_TOKEN || '')
  const recebido = String(req.headers.get('x-migration-token') || '')
  return esperado.length >= 32 && recebido === esperado
}

async function empresaUnicaMaster() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('empresa_id')
    .eq('role', 'master')
    .not('empresa_id', 'is', null)
    .limit(100)

  if (error) throw new Error(`Falha ao resolver empresa Master: ${error.message}`)
  const ids = Array.from(new Set((data || []).map(item => String(item.empresa_id || '')).filter(Boolean)))
  if (ids.length !== 1) {
    throw new Error(`Teste interno exige exatamente uma empresa Master; encontradas: ${ids.length}.`)
  }
  return ids[0]
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const neon = statusNeonStaging()
  let testeNeon: unknown = null
  try {
    testeNeon = neon.configurado ? await testarNeonStaging() : null
  } catch (error) {
    testeNeon = { ok: false, error: error instanceof Error ? error.message : 'Falha Neon.' }
  }

  return NextResponse.json({
    ok: true,
    wvetro: statusConfiguracaoWVetro(),
    neon,
    testeNeon,
    writeEnabled: process.env.WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED === 'true',
  })
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const empresaId = await empresaUnicaMaster()
  const dados = await consultarRecursoOperacionalWVetro('pessoas', { tipoPessoa: 'CL' })
  const reconciliacao = await reconciliarPessoasWVetroComClientesAtlas(dados, empresaId, {
    categoriaClienteConfirmada: true,
    origemCategoria: 'Tipopessoa=CL',
  })

  return NextResponse.json({
    ok: true,
    modo: 'dry-run',
    recurso: 'pessoas',
    categoria: 'CL',
    total: reconciliacao.itens.length,
    totais: reconciliacao.totais,
  })
}
