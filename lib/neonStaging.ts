import { neon } from '@neondatabase/serverless'

const ENV_NAME = 'NEON_STAGING_DATABASE_URL'
const MARKETPLACE_ENV_NAME = 'DATABASE_URL'

function connectionStringNeonStaging() {
  return String(
    process.env[ENV_NAME] || process.env[MARKETPLACE_ENV_NAME] || '',
  ).trim()
}

export type NeonStagingStatus = {
  configurado: boolean
  env: typeof ENV_NAME | typeof MARKETPLACE_ENV_NAME | null
  host: string | null
  database: string | null
}

export function statusNeonStaging(): NeonStagingStatus {
  const raw = connectionStringNeonStaging()
  const env = process.env[ENV_NAME]
    ? ENV_NAME
    : process.env[MARKETPLACE_ENV_NAME]
      ? MARKETPLACE_ENV_NAME
      : null

  if (!raw) {
    return { configurado: false, env, host: null, database: null }
  }

  try {
    const url = new URL(raw)
    return {
      configurado: true,
      env,
      host: url.hostname,
      database: url.pathname.replace(/^\//, '') || null,
    }
  } catch {
    return { configurado: false, env, host: null, database: null }
  }
}

export function neonStaging() {
  const raw = connectionStringNeonStaging()
  if (!raw) {
    throw new Error(
      'Neon staging não configurado. Defina NEON_STAGING_DATABASE_URL ou provisione Neon pelo Vercel Marketplace.',
    )
  }

  return neon(raw)
}

export async function testarNeonStaging() {
  const sql = neonStaging()
  const rows = await sql`
    select
      current_database() as database,
      current_user as usuario,
      now() as agora,
      to_regnamespace('wvetro_migracao') is not null as schema_pronto
  `

  const row = rows[0] as {
    database?: string
    usuario?: string
    agora?: string
    schema_pronto?: boolean
  } | undefined

  return {
    ok: true,
    database: row?.database || null,
    usuario: row?.usuario || null,
    agora: row?.agora || null,
    schemaPronto: !!row?.schema_pronto,
  }
}
