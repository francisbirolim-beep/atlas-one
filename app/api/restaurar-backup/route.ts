import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { salvarBackup, restaurarSnapshot } from '@/lib/backupServer'

export async function POST(req: NextRequest) {
    try {
          const authHeader = req.headers.get('authorization') || ''
          const token = authHeader.replace('Bearer ', '').trim()
          if (!token) {
                  return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
          }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
          if (userErr || !userData?.user) {
                  return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
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
          const backupId = (body.backupId || '').trim()
          if (!backupId) {
                  return NextResponse.json({ error: 'Backup nao informado' }, { status: 400 })
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
