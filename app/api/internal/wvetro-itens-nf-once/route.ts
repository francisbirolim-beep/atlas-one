import { NextResponse } from 'next/server'
import { neonStaging } from '@/lib/neonStaging'
import { listarItensNotaEntradaWVetro, statusConfiguracaoWVetro } from '@/lib/wvetroApi'
import {
  criarExecucaoWVetroOperacional,
  salvarStagingWVetroOperacional,
} from '@/lib/wvetroMigracaoOperacionalServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Disponível somente em Preview.' }, { status: 404 })
  }

  const configuracao = statusConfiguracaoWVetro()
  if (!configuracao.pronto) {
    return NextResponse.json({ error: 'W.Vetro não configurado.' }, { status: 503 })
  }

  const sql = neonStaging()
  const notas = await sql`
    select distinct payload->>'NFCompraId' as nf_id
    from wvetro_migracao.raw
    where recurso = 'notas_entrada'
      and nullif(payload->>'NFCompraId', '') is not null
    order by 1
  `

  const resultados: Array<Record<string, unknown>> = []
  let totalNovos = 0
  let totalRepetidos = 0
  let totalErros = 0

  for (const nota of notas as Array<{ nf_id?: string }>) {
    const nfId = String(nota.nf_id || '').trim()
    if (!nfId) continue

    try {
      const payload = await listarItensNotaEntradaWVetro(nfId)
      const execucaoId = await criarExecucaoWVetroOperacional({
        recurso: 'itens_nf',
        criadoPorNome: 'preview-capture-once',
      })
      const resumo = await salvarStagingWVetroOperacional({
        execucaoId,
        recurso: 'itens_nf',
        payload,
      })

      totalNovos += resumo.novos
      totalRepetidos += resumo.repetidos
      totalErros += resumo.erros
      resultados.push({ nfId, ...resumo })
    } catch (error) {
      totalErros += 1
      resultados.push({
        nfId,
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }

  return NextResponse.json({
    ok: totalErros === 0,
    notas: notas.length,
    totalNovos,
    totalRepetidos,
    totalErros,
    resultados,
  })
}
