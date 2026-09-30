import fs from 'fs'
import { neonStaging } from '../lib/neonStaging'
import type { WVetroOperacionalRecurso } from '../lib/wvetroOperacionalMap'

const BASE = 'https://atlas-one-eight-rho.vercel.app/api/internal/wvetro-export-once'
const TOKEN = String(process.env.MIG_TOKEN || '')
const START = String(process.env.MIGRATION_START || '2024-01-01')
const END = String(process.env.MIGRATION_END || '2026-09-30')
const REPORT_FILE = '/tmp/wvetro-migration-report.json'
const sql = neonStaging()

if (!TOKEN) throw new Error('MIG_TOKEN ausente')

const report: any = {
  startedAt: new Date().toISOString(),
  start: START,
  end: END,
  resources: {},
  errors: [],
}

function saveReport() {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function windows(start: string, end: string) {
  const out: Array<{ inicio: string; fim: string }> = []
  let cursor = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')

  while (cursor <= last) {
    const fim = new Date(cursor)
    fim.setUTCDate(fim.getUTCDate() + 6)
    if (fim > last) fim.setTime(last.getTime())
    out.push({ inicio: iso(cursor), fim: iso(fim) })
    cursor = new Date(fim)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return out
}

async function fetchJson(
  recurso: WVetroOperacionalRecurso,
  params: Record<string, unknown> = {},
) {
  const u = new URL(BASE)
  u.searchParams.set('recurso', recurso)
  u.searchParams.set('k', TOKEN)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      u.searchParams.set(key, String(value))
    }
  }

  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(u, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      })
      const text = await resp.text()
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.slice(0, 400)}`)
      const json = JSON.parse(text)
      if (!json?.ok) throw new Error(json?.error || 'Resposta W.Vetro inválida')
      return json
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1200 * attempt))
    }
  }

  throw new Error(lastError || 'Falha ao buscar W.Vetro')
}

async function alreadyDone(recurso: string, inicio?: string, fim?: string) {
  const rows = await sql`
    select 1
    from wvetro_migracao.execucoes
    where recurso = ${recurso}
      and status = 'concluida'
      and coalesce(periodo_inicio::text, '') = ${inicio || ''}
      and coalesce(periodo_fim::text, '') = ${fim || ''}
    limit 1
  `
  return rows.length > 0
}

async function createExecution(
  recurso: string,
  inicio: string | undefined,
  fim: string | undefined,
  total: number,
  errors: number,
) {
  const rows = await sql`
    insert into wvetro_migracao.execucoes
      (recurso, periodo_inicio, periodo_fim, cursor_data, status,
       total_lidos, total_erros, iniciado_em, criado_por_nome, ultima_mensagem)
    values (
      ${recurso},
      ${inicio || null}::date,
      ${fim || null}::date,
      ${inicio || null}::date,
      'em_andamento',
      ${total},
      ${errors},
      now(),
      'migração W.Vetro -> Neon',
      'captura iniciada'
    )
    returning id
  `
  return String((rows[0] as any).id)
}

async function insertRecords(execId: string, registros: any[]) {
  let inserted = 0

  for (let i = 0; i < registros.length; i += 80) {
    const batch = registros.slice(i, i + 80)
    const queries = batch.map((r: any) => sql`
      insert into wvetro_migracao.raw
        (execucao_id, recurso, chave_externa, data_referencia, versao, payload, payload_hash)
      values (
        ${execId}::uuid,
        ${String(r.recurso)},
        ${String(r.chaveExterna)},
        ${r.dataReferencia || null}::date,
        (
          select coalesce(max(versao), 0)::int + 1
          from wvetro_migracao.raw
          where recurso = ${String(r.recurso)}
            and chave_externa = ${String(r.chaveExterna)}
        ),
        ${JSON.stringify(r.payload)}::jsonb,
        ${String(r.payloadHash)}
      )
      on conflict (recurso, chave_externa, payload_hash) do nothing
      returning id
    `)

    const results = await sql.transaction(queries)
    for (const rows of results as any[]) {
      if (Array.isArray(rows) && rows.length) inserted += 1
    }
  }

  return inserted
}

async function finishExecution(
  execId: string,
  inserted: number,
  total: number,
  semChave: number,
) {
  const status = semChave > 0 ? 'erro' : 'concluida'
  const message = `${inserted} novo(s), ${Math.max(total - inserted, 0)} já existente(s), ${semChave} sem chave`

  await sql`
    update wvetro_migracao.execucoes
    set status = ${status},
        total_novos = ${inserted},
        total_erros = ${semChave},
        ultima_mensagem = ${message},
        erro = ${semChave > 0 ? 'Existem registros sem chave externa segura.' : null},
        finalizado_em = now(),
        updated_at = now()
    where id = ${execId}::uuid
  `
}

async function capture(
  recurso: WVetroOperacionalRecurso,
  params: Record<string, any> = {},
) {
  const inicio = params.inicio ? String(params.inicio) : undefined
  const fim = params.fim ? String(params.fim) : undefined

  if (await alreadyDone(recurso, inicio, fim)) {
    const rr = report.resources[recurso] ||= {
      execucoes: 0, puladas: 0, lidos: 0, novos: 0, erros: 0,
    }
    rr.puladas += 1
    return
  }

  try {
    const data = await fetchJson(recurso, params)
    const execId = await createExecution(
      recurso,
      inicio,
      fim,
      Number(data.total || 0),
      Number(data.semChave || 0),
    )
    const inserted = await insertRecords(
      execId,
      Array.isArray(data.registros) ? data.registros : [],
    )
    await finishExecution(
      execId,
      inserted,
      Number(data.total || 0),
      Number(data.semChave || 0),
    )

    const rr = report.resources[recurso] ||= {
      execucoes: 0, puladas: 0, lidos: 0, novos: 0, erros: 0,
    }
    rr.execucoes += 1
    rr.lidos += Number(data.total || 0)
    rr.novos += inserted
    rr.erros += Number(data.semChave || 0)
    saveReport()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const rr = report.resources[recurso] ||= {
      execucoes: 0, puladas: 0, lidos: 0, novos: 0, erros: 0,
    }
    rr.execucoes += 1
    rr.erros += 1
    report.errors.push({ recurso, params, message })
    saveReport()
  }
}

async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0
  async function worker() {
    while (true) {
      const i = index++
      if (i >= items.length) return
      await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

async function staticResources() {
  const resources: WVetroOperacionalRecurso[] = [
    'pessoas',
    'tipos_pessoa',
    'vendedores',
    'linhas',
    'cores',
    'vidros',
    'contas',
    'plano_contas',
  ]
  for (const recurso of resources) await capture(recurso)
}

async function metas() {
  const meses: Array<{ ano: number; mes: number }> = []
  let d = new Date(START + 'T00:00:00Z')
  const end = new Date(END + 'T00:00:00Z')
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

  while (d <= end) {
    meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 })
    d.setUTCMonth(d.getUTCMonth() + 1)
  }

  await pool(meses, 2, async p => capture('metas', p))
}

async function historical() {
  const periods = windows(START, END)
  const resources: WVetroOperacionalRecurso[] = [
    'orcamentos',
    'pedidos',
    'notas_entrada',
    'estoque_movimentos',
    'titulos',
    'titulos_baixados',
    'extrato',
    'lotes_producao',
    'producao_projeto',
    'instalacoes',
  ]

  for (const recurso of resources) {
    await pool(periods, 2, async p => capture(recurso, p))
  }
}

async function nfItems() {
  const rows = await sql`
    select distinct payload->>'NFCompraId' as id
    from wvetro_migracao.raw
    where recurso = 'notas_entrada'
      and payload->>'NFCompraId' is not null
  `
  const ids = rows.map((r: any) => String(r.id || '')).filter(Boolean)
  await pool(ids, 3, async id => capture('itens_nf', { nfId: id }))
}

async function orderDetails() {
  const rows = await sql`
    select distinct coalesce(
      payload->>'Id',
      payload->>'OrcamentoId',
      payload->>'Orcamentoid'
    ) as id
    from wvetro_migracao.raw
    where recurso = 'pedidos'
  `
  const ids = rows.map((r: any) => String(r.id || '')).filter(Boolean)
  await pool(ids, 3, async id => capture('pedido', { id }))
}

async function summarize() {
  const counts = await sql`
    select recurso,
           count(*)::int as snapshots,
           count(distinct chave_externa)::int as entidades,
           max(versao)::int as max_versao
    from wvetro_migracao.raw
    group by recurso
    order by recurso
  `

  const executions = await sql`
    select recurso,
           status,
           count(*)::int as total,
           sum(total_lidos)::int as lidos,
           sum(total_novos)::int as novos,
           sum(total_erros)::int as erros
    from wvetro_migracao.execucoes
    group by recurso, status
    order by recurso, status
  `

  report.finishedAt = new Date().toISOString()
  report.counts = counts
  report.executions = executions
  saveReport()

  console.log(JSON.stringify({
    ok: true,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    resourceCount: (counts as any[]).length,
    errors: report.errors.length,
    counts,
  }, null, 2))
}

async function main() {
  await staticResources()
  await metas()
  await historical()
  await nfItems()
  await orderDetails()
  await summarize()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
