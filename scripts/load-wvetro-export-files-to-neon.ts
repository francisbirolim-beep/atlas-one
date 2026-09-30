import fs from 'fs'
import path from 'path'
import { neon } from '@neondatabase/serverless'

const EXPORT_ROOT = '/tmp/wvetro-export'
const ENV_FILE = '/tmp/atlas-migrate/.env.neon'
const REPORT_FILE = '/tmp/wvetro-neon-load-report.json'

function readDatabaseUrl() {
  const text = fs.readFileSync(ENV_FILE, 'utf8')
  const line = text.split(/\r?\n/).find(v => v.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL não encontrado no arquivo Neon.')
  const value = line.slice('DATABASE_URL='.length).trim()
  return value.replace(/^['"]|['"]$/g, '')
}

const sql = neon(readDatabaseUrl())

function collectJsonFiles() {
  const files: string[] = []

  for (const name of ['linhas.json', 'cores.json']) {
    const file = path.join(EXPORT_ROOT, name)
    if (fs.existsSync(file)) files.push(file)
  }

  for (const subdir of ['static', 'metas']) {
    const dir = path.join(EXPORT_ROOT, subdir)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith('.json')) files.push(path.join(dir, name))
    }
  }

  const histRoot = path.join(EXPORT_ROOT, 'hist')
  if (fs.existsSync(histRoot)) {
    for (const recurso of fs.readdirSync(histRoot).sort()) {
      const dir = path.join(histRoot, recurso)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const name of fs.readdirSync(dir).sort()) {
        if (name.endsWith('.json')) files.push(path.join(dir, name))
      }
    }
  }

  for (const subdir of ['itens_nf', 'pedidos_detalhe']) {
    const dir = path.join(EXPORT_ROOT, subdir)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith('.json')) files.push(path.join(dir, name))
    }
  }

  return files
}

function periodFromFile(file: string) {
  const normalized = file.replace(/\\/g, '/')

  if (normalized.includes('/hist/')) {
    const name = path.basename(file, '.json')
    const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
    if (match) return { inicio: match[1], fim: match[2] }
  }

  if (normalized.includes('/metas/')) {
    const name = path.basename(file, '.json')
    const match = name.match(/^(\d{4})_(\d{1,2})$/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      const inicio = new Date(Date.UTC(year, month - 1, 1))
      const fim = new Date(Date.UTC(year, month, 0))
      return {
        inicio: inicio.toISOString().slice(0, 10),
        fim: fim.toISOString().slice(0, 10),
      }
    }
  }

  return { inicio: null as string | null, fim: null as string | null }
}

async function executionDone(recurso: string, inicio: string | null, fim: string | null) {
  const rows = await sql`
    select 1
    from wvetro_migracao.execucoes
    where recurso = ${recurso}
      and status = 'concluida'
      and periodo_inicio is not distinct from ${inicio}::date
      and periodo_fim is not distinct from ${fim}::date
    limit 1
  `
  return rows.length > 0
}

async function createExecution(
  recurso: string,
  inicio: string | null,
  fim: string | null,
  total: number,
  semChave: number,
) {
  const rows = await sql`
    insert into wvetro_migracao.execucoes (
      recurso, periodo_inicio, periodo_fim, cursor_data, status,
      total_lidos, total_erros, iniciado_em, criado_por_nome, ultima_mensagem
    ) values (
      ${recurso},
      ${inicio}::date,
      ${fim}::date,
      ${inicio}::date,
      'em_andamento',
      ${total},
      ${semChave},
      now(),
      'carga operacional W.Vetro 2026-09-30',
      'captura iniciada'
    )
    returning id
  `
  return String((rows[0] as any).id)
}

async function insertRecords(execId: string, registros: any[]) {
  let inserted = 0

  for (let i = 0; i < registros.length; i += 60) {
    const batch = registros.slice(i, i + 60)
    const queries = batch.map((r: any) => sql`
      insert into wvetro_migracao.raw (
        execucao_id, recurso, chave_externa, data_referencia,
        versao, payload, payload_hash
      ) values (
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
      if (Array.isArray(rows) && rows.length > 0) inserted += 1
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
  const mensagem = `${inserted} novo(s), ${Math.max(total - inserted, 0)} existente(s), ${semChave} sem chave`

  await sql`
    update wvetro_migracao.execucoes
    set status = ${status},
        total_novos = ${inserted},
        total_erros = ${semChave},
        ultima_mensagem = ${mensagem},
        erro = ${semChave > 0 ? 'Existem registros reais sem chave externa.' : null},
        finalizado_em = now(),
        updated_at = now()
    where id = ${execId}::uuid
  `
}

async function loadFile(file: string, report: any) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!doc?.ok) {
    report.errors.push({ file, error: doc?.error || 'Arquivo não OK' })
    return
  }

  const recurso = String(doc.recurso || '').trim()
  if (!recurso) {
    report.errors.push({ file, error: 'Recurso ausente' })
    return
  }

  const { inicio, fim } = periodFromFile(file)
  if (await executionDone(recurso, inicio, fim)) {
    report.skipped += 1
    return
  }

  const total = Number(doc.total || 0)
  const semChaveOriginal = Number(doc.semChave || 0)
  const semChave = total === 0 ? 0 : semChaveOriginal
  const registros = Array.isArray(doc.registros) ? doc.registros : []

  const execId = await createExecution(recurso, inicio, fim, total, semChave)

  try {
    const inserted = await insertRecords(execId, registros)
    await finishExecution(execId, inserted, total, semChave)

    const r = report.resources[recurso] ||= {
      files: 0, total: 0, inserted: 0, semChave: 0,
    }
    r.files += 1
    r.total += total
    r.inserted += inserted
    r.semChave += semChave
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await sql`
      update wvetro_migracao.execucoes
      set status = 'erro',
          total_erros = total_erros + 1,
          erro = ${message},
          ultima_mensagem = ${message},
          finalizado_em = now(),
          updated_at = now()
      where id = ${execId}::uuid
    `
    report.errors.push({ file, recurso, error: message })
  }
}

async function summarize(report: any) {
  report.counts = await sql`
    select recurso,
           count(*)::int as snapshots,
           count(distinct chave_externa)::int as entidades,
           max(versao)::int as max_versao
    from wvetro_migracao.raw
    group by recurso
    order by recurso
  `

  report.executions = await sql`
    select recurso,
           status,
           count(*)::int as execucoes,
           sum(total_lidos)::int as lidos,
           sum(total_novos)::int as novos,
           sum(total_erros)::int as erros
    from wvetro_migracao.execucoes
    group by recurso, status
    order by recurso, status
  `

  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
}

async function main() {
  const report: any = {
    startedAt: new Date().toISOString(),
    files: 0,
    skipped: 0,
    resources: {},
    errors: [],
  }

  const files = collectJsonFiles()
  report.files = files.length

  for (const file of files) {
    await loadFile(file, report)
  }

  await summarize(report)

  console.log(JSON.stringify({
    ok: report.errors.length === 0,
    files: report.files,
    skipped: report.skipped,
    errorCount: report.errors.length,
    counts: report.counts,
  }, null, 2))

  if (report.errors.length > 0) process.exitCode = 2
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
