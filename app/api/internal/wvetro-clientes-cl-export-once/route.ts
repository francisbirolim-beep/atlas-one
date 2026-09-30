import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_HASH = '83691da4a384f035b8fb02f6b9c6cafb3f1e68886a39b2d3b9cb477455842946'
const EXPIRES_AT = Date.parse('2026-10-01T02:00:00Z')

function autorizado(req: NextRequest) {
  if (Date.now() > EXPIRES_AT) return false
  const token = String(req.headers.get('x-atlas-export-key') || '')
  const got = createHash('sha256').update(token).digest()
  const expected = Buffer.from(TOKEN_HASH, 'hex')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const dados = await consultarRecursoOperacionalWVetro('pessoas', { tipoPessoa: 'CL' })
    const staging = transformarPayloadWVetroEmStaging('pessoas', dados)

    return NextResponse.json(
      {
        ok: true,
        recurso: 'pessoas',
        tipoPessoa: 'CL',
        total: staging.registros.length,
        semChave: staging.semChave.length,
        registros: staging.registros,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
