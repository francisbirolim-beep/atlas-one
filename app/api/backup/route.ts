import { NextRequest, NextResponse } from 'next/server'
import { salvarBackup } from '@/lib/backupServer'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // Backup global fica reservado exclusivamente ao cron/infraestrutura.
    // O endpoint manual permanece bloqueado enquanto o Atlas nao tiver
    // snapshot e restauracao isolados por empresa_id.
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
      const registro = await salvarBackup('automatico', 'Backup automatico (diario)')
      return NextResponse.json({ ok: true, backup: registro })
    }

    return NextResponse.json(
      {
        error: 'Backup manual global temporariamente desabilitado no modo multi-tenant. Use somente o backup automatico de infraestrutura ate existir backup isolado por empresa.',
        code: 'GLOBAL_BACKUP_DISABLED_MULTI_TENANT',
      },
      { status: 403 },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}