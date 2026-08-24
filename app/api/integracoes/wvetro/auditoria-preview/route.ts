import { NextRequest, NextResponse } from 'next/server'
import {
  processarLoteProdutosWVetro,
  processarPeriodoWVetro,
  resumoAuditoriaWVetro,
  sincronizarLinhasApiWVetro,
} from '@/lib/wvetroAuditoriaServer'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function permitido() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_GIT_COMMIT_REF === 'feat/wvetro-auditoria-completa'
}

function dataOk(valor: string | null): valor is string {
  return !!valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
}

function dias(inicio: string, fim: string) {
  return Math.floor((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000)
}

export async function GET(req: NextRequest) {
  if (!permitido()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const acao = req.nextUrl.searchParams.get('acao') || 'resumo'

  try {
    if (acao === 'resumo') {
      return NextResponse.json({ ok: true, resumo: await resumoAuditoriaWVetro() })
    }

    if (acao === 'iniciar') {
      const linhas = await sincronizarLinhasApiWVetro()
      const [perfis, acessorios] = await Promise.all([
        descobrirEImportarCatalogoWVetro('P'),
        descobrirEImportarCatalogoWVetro('A'),
      ])
      return NextResponse.json({ ok: true, linhas, descobertaCatalogo: { perfis, acessorios } })
    }

    if (acao === 'periodo') {
      const inicio = req.nextUrl.searchParams.get('inicio')
      const fim = req.nextUrl.searchParams.get('fim')
      if (!dataOk(inicio) || !dataOk(fim) || inicio > fim || dias(inicio, fim) > 89) {
        return NextResponse.json({ error: 'Período inválido; use no máximo 90 dias.' }, { status: 400 })
      }
      return NextResponse.json({ ok: true, resultado: await processarPeriodoWVetro(inicio, fim) })
    }

    if (acao === 'produtos') {
      const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') || 0))
      const limite = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get('limite') || 25)))
      return NextResponse.json({ ok: true, resultado: await processarLoteProdutosWVetro(offset, limite) })
    }

    if (acao === 'produtos100') {
      const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') || 0))
      const resultados = await Promise.all([
        processarLoteProdutosWVetro(offset, 25),
        processarLoteProdutosWVetro(offset + 25, 25),
        processarLoteProdutosWVetro(offset + 50, 25),
        processarLoteProdutosWVetro(offset + 75, 25),
      ])
      return NextResponse.json({ ok: true, offset, resultados })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Falha na auditoria W.Vetro.',
    }, { status: 500 })
  }
}
