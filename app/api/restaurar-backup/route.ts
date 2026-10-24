import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { salvarBackup, restaurarSnapshot } from '@/lib/backupServer'

export async function POST(req: NextRequest) {
    try {
      // This legacy restore deletes rows globally and is not transactional.
      // It is never an ordinary tenant-Master action. Keep disabled unless an
      // operator deliberately opens a short maintenance window for ONE backup.
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const operatorId = process.env.ATLAS_LEGACY_RESTORE_OPERATOR_ID || ''
      const permittedBackupId = process.env.ATLAS_LEGACY_RESTORE_BACKUP_ID || ''
      const until = Date.parse(process.env.ATLAS_LEGACY_RESTORE_UNTIL || '')
      const remaining = until - Date.now()
      if (process.env.ATLAS_LEGACY_RESTORE_ENABLED !== 'true' ||
          !uuid.test(operatorId) || !uuid.test(permittedBackupId) ||
          !Number.isFinite(remaining) || remaining <= 0 || remaining > 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Restauracao global indisponivel. Exige manutencao autorizada e recuperacao previamente validada.' }, { status: 503 })
      }

          const authHeader = req.headers.get('authorization') || ''
          const token = authHeader.replace('Bearer ', '').trim()
          if (!token) {
                  return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
          }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
          if (userErr || !userData?.user) {
                  return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
          }

      if (userData.user.id !== operatorId) {
        return NextResponse.json({ error: 'Operador nao autorizado para esta manutencao.' }, { status: 403 })
      }

      const { data: perfil } = await supabaseAdmin
            .from('usuarios')
            .select('nome, role')
            .eq('id', userData.user.id)
            .maybeSingle()

      if (!perfil || perfil.role !== 'master') {
              return NextResponse.json({ error: 'Apenas o usuario master pode restaurar um backup' }, { status: 403 })
      }

      const body = await req.json()
          const backupId = typeof body?.backupId === 'string' ? body.backupId.trim() : ''
          if (!backupId) {
                  return NextResponse.json({ error: 'Backup nao informado' }, { status: 400 })
          }

      if (backupId !== permittedBackupId || body.confirmacao !== `RESTAURAR_GLOBAL:${backupId}`) {
        return NextResponse.json({ error: 'Backup ou confirmacao fora da manutencao autorizada.' }, { status: 403 })
      }

      const { data: backup, error: backupErr } = await supabaseAdmin
            .from('backups')
            .select('id, tabelas')
            .eq('id', backupId)
            .maybeSingle()

      if (backupErr || !backup) {
              return NextResponse.json({ error: 'Backup nao encontrado' }, { status: 400 })
      }

      // Cria um backup de seguranca do estado atual antes de sobrescrever tudo,
      // para permitir desfazer a restauracao se algo der errado.
      await salvarBackup('pre_restauracao', perfil.nome || 'Master')

      await restaurarSnapshot(backup.tabelas as Record<string, any[]>)

      return NextResponse.json({ ok: true })
    } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Erro inesperado ao restaurar' }, { status: 500 })
    }
}
