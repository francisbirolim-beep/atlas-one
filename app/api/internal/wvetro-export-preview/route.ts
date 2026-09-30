import { NextRequest, NextResponse } from 'next/server'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { mapaWVetroPorRecurso, WVetroOperacionalRecurso } from '@/lib/wvetroOperacionalMap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function textParam(req: NextRequest, name: string) {
  const value = req.nextUrl.searchParams.get(name)
  return value == null ? undefined : value.trim() || undefined
}

function intParam(req: NextRequest, name: string) {
  const value = textParam(req, name)
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function boolParam(req: NextRequest, name: string) {
  const value = textParam(req, name)
  if (value === undefined) return undefined
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return undefined
}

export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Rota indisponível em produção.' }, { status: 404 })
  }

  const recurso = String(req.nextUrl.searchParams.get('recurso') || '').trim() as WVetroOperacionalRecurso
  if (!mapaWVetroPorRecurso(recurso)) {
    return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
  }

  try {
    const dados = await consultarRecursoOperacionalWVetro(recurso, {
      inicio: textParam(req, 'inicio'),
      fim: textParam(req, 'fim'),
      pessoaId: textParam(req, 'pessoaId'),
      tipoPessoa: textParam(req, 'tipoPessoa'),
      vendedorId: textParam(req, 'vendedorId'),
      linhaId: textParam(req, 'linhaId'),
      ano: intParam(req, 'ano'),
      mes: intParam(req, 'mes'),
      id: textParam(req, 'id'),
      nfId: textParam(req, 'nfId'),
      tipo: textParam(req, 'tipo'),
      produtoCodigo: textParam(req, 'produtoCodigo'),
      corNome: textParam(req, 'corNome'),
      tituloTipo: textParam(req, 'tituloTipo'),
      contaNro: textParam(req, 'contaNro'),
      loteNro: textParam(req, 'loteNro'),
      programacaoNro: textParam(req, 'programacaoNro'),
      produzido: boolParam(req, 'produzido'),
    })

    const staging = transformarPayloadWVetroEmStaging(recurso, dados)
    return NextResponse.json({
      ok: true,
      recurso,
      total: staging.registros.length,
      semChave: staging.semChave.length,
      registros: staging.registros,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message, recurso }, { status: 502 })
  }
}
