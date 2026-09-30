import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { neonStaging } from '@/lib/neonStaging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TOKEN_HASH = '83691da4a384f035b8fb02f6b9c6cafb3f1e68886a39b2d3b9cb477455842946'
const EXPIRES_AT = Date.parse('2026-10-01T02:00:00Z')
const RECURSO_STAGING = 'pessoas_cliente'

function autorizado(req: NextRequest) {
  if (Date.now() > EXPIRES_AT) return false
  const token = String(
    req.headers.get('x-atlas-export-key') ||
    req.nextUrl.searchParams.get('k') ||
    '',
  )
  const got = createHash('sha256').update(token).digest()
  const expected = Buffer.from(TOKEN_HASH, 'hex')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sql = neonStaging()
  let execucaoId = ''

  try {
    const dados = await consultarRecursoOperacionalWVetro('pessoas', { tipoPessoa: 'CL' })
    const staging = transformarPayloadWVetroEmStaging('pessoas', dados)

    const execRows = await sql`
      insert into wvetro_migracao.execucoes (
        recurso, status, total_lidos, total_erros,
        iniciado_em, criado_por_nome, ultima_mensagem
      ) values (
        ${RECURSO_STAGING},
        'em_andamento',
        ${staging.registros.length + staging.semChave.length},
        ${staging.semChave.length},
        now(),
        'captura temporária Tipopessoa=CL',
        'captura CL iniciada'
      )
      returning id
    `
    execucaoId = String((execRows[0] as { id?: string } | undefined)?.id || '')
    if (!execucaoId) throw new Error('Não foi possível criar a execução de clientes CL.')

    let novos = 0
    let repetidos = 0

    for (let i = 0; i < staging.registros.length; i += 50) {
      const lote = staging.registros.slice(i, i + 50)
      const queries = lote.map(registro => sql`
        insert into wvetro_migracao.raw (
          execucao_id, recurso, chave_externa, data_referencia,
          versao, payload, payload_hash
        ) values (
          ${execucaoId}::uuid,
          ${RECURSO_STAGING},
          ${registro.chaveExterna},
          ${registro.dataReferencia}::date,
          (
            select coalesce(max(versao), 0)::int + 1
            from wvetro_migracao.raw
            where recurso = ${RECURSO_STAGING}
              and chave_externa = ${registro.chaveExterna}
          ),
          ${JSON.stringify(registro.payload)}::jsonb,
          ${registro.payloadHash}
        )
        on conflict (recurso, chave_externa, payload_hash) do nothing
        returning id
      `)

      const results = await sql.transaction(queries)
      for (const rows of results as any[]) {
        if (Array.isArray(rows) && rows.length > 0) novos += 1
        else repetidos += 1
      }
    }

    const erros = staging.semChave.length
    const status = erros > 0 ? 'erro' : 'concluida'
    const mensagem = `${novos} novos, ${repetidos} repetidos, ${erros} sem chave.`

    await sql`
      update wvetro_migracao.execucoes
      set status = ${status},
          total_novos = ${novos},
          total_erros = ${erros},
          ultima_mensagem = ${mensagem},
          erro = ${erros > 0 ? 'Existem clientes CL sem chave externa segura.' : null},
          finalizado_em = now(),
          updated_at = now()
      where id = ${execucaoId}::uuid
    `

    return NextResponse.json({
      ok: true,
      recurso: RECURSO_STAGING,
      origem: { recurso: 'pessoas', tipoPessoa: 'CL' },
      execucaoId,
      total: staging.registros.length,
      semChave: staging.semChave.length,
      novos,
      repetidos,
      erros,
      gravacaoAtlasOficial: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    if (execucaoId) {
      try {
        await sql`
          update wvetro_migracao.execucoes
          set status = 'erro',
              total_erros = total_erros + 1,
              erro = ${message.slice(0, 1000)},
              ultima_mensagem = ${message.slice(0, 1000)},
              finalizado_em = now(),
              updated_at = now()
          where id = ${execucaoId}::uuid
        `
      } catch {}
    }
    return NextResponse.json({ error: message, execucaoId: execucaoId || null }, { status: 502 })
  }
}
