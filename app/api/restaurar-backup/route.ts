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
            .select('nome, role, empresa_id')
            .eq('id', userData.user.id)
            .maybeSingle()

      if (!perfil || perfil.role !== 'master' || !perfil.empresa_id) {
              return NextResponse.json({ error: 'Apenas o usuario master da empresa pode restaurar um backup' }, { status: 403 })
      }

      // O snapshot legado inclui tabelas globais (ex.: setores) e foi criado quando
      // o Atlas possuia uma unica empresa. Se surgir um segundo tenant, bloquear a
      // restauracao destrutiva ate o formato de backup ser migrado para snapshots
      // integralmente isolados por empresa.
      const { count: empresasAtivas, error: empresasErr } = await supabaseAdmin
            .from('empresas')
            .select('id', { count: 'exact', head: true })
      if (empresasErr) {
              return NextResponse.json({ error: 'Nao foi possivel validar o isolamento do backup' }, { status: 500 })
      }
      if ((empresasAtivas || 0) > 1) {
              return NextResponse.json({
                    error: 'Restauracao bloqueada por seguranca: existem multiplas empresas no Atlas.'
              }, { status: 409 })
      }

      const body = await req.json()
          const backupId = (body.backupId || '').trim()
          if (!backupId) {
                  return NextResponse.json({ error: 'Backup nao informado' }, { status: 400 })
          }

      const { data: backup, error: backupErr } = await supabaseAdmin
            .from('backups')
            .select('id, tabelas, empresa_id')
            .eq('id', backupId)
            .eq('empresa_id', perfil.empresa_id)
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
