import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_HASH = '232732165a71ca5bddc3c25d43d5c0137b7d2c4f1546ddc967e618a9675c842c'
const EXPIRES_AT = Date.parse('2026-10-01T08:00:00Z')

function autorizado(req: NextRequest) {
  if (Date.now() > EXPIRES_AT) return false
  const token = String(req.nextUrl.searchParams.get('k') || '')
  const got = createHash('sha256').update(token).digest()
  const expected = Buffer.from(TOKEN_HASH, 'hex')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

function escalar(v: unknown) {
  if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) {
    const s = typeof v === 'string' ? v : String(v ?? '')
    return s.length > 160 ? `${s.slice(0, 157)}...` : v
  }
  return undefined
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const dados = await consultarRecursoOperacionalWVetro('vidros')
    const arrays: Array<{ path: string; total: number; sampleKeys: string[] }> = []
    const keyCount = new Map<string, number>()
    const samples: Array<Record<string, unknown>> = []
    const visited = new Set<object>()

    function walk(value: unknown, path = 'root', depth = 0) {
      if (depth > 6 || value == null || typeof value !== 'object') return
      if (visited.has(value as object)) return
      visited.add(value as object)

      if (Array.isArray(value)) {
        const firstObject = value.find(item => item && typeof item === 'object' && !Array.isArray(item)) as
          | Record<string, unknown>
          | undefined
        arrays.push({
          path,
          total: value.length,
          sampleKeys: firstObject ? Object.keys(firstObject).sort() : [],
        })
        for (const item of value.slice(0, 50)) walk(item, `${path}[]`, depth + 1)
        return
      }

      const obj = value as Record<string, unknown>
      const scalarSample: Record<string, unknown> = {}
      let scalarFields = 0
      for (const [key, child] of Object.entries(obj)) {
        keyCount.set(key, (keyCount.get(key) || 0) + 1)
        const sv = escalar(child)
        if (sv !== undefined) {
          scalarSample[key] = sv
          scalarFields += 1
        }
        walk(child, `${path}.${key}`, depth + 1)
      }
      if (scalarFields >= 2 && samples.length < 5) samples.push(scalarSample)
    }

    walk(dados)

    return NextResponse.json(
      {
        ok: true,
        recurso: 'vidros',
        rootType: Array.isArray(dados) ? 'array' : typeof dados,
        arrays: arrays.slice(0, 30),
        keyFrequency: Array.from(keyCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 80)
          .map(([key, count]) => ({ key, count })),
        samples,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
