import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { salvarBackup } from '@/lib/backupServer'

export async function GET(req: NextRequest) {
    try {
          const authHeader = req.headers.get('authorization') || ''
          const token = authHeader.replace('Bearer ', '').trim()
          if (!token) {
                  return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
          }

      // Chamada automatica do cron diario da Vercel (Authorization: Bearer <CRON_SECRET>)
      if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
              const registro = await salvarBackup('automatico', 'Backup automatico (diario)')
              return NextResponse.json({ ok: true, backup: registro })
      }

      // Chamada manual: precisa ser usuario master autenticado
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
              return NextResponse.json({ error: 'Apenas o usuario master pode fazer backup' }, { status: 403 })
      }

      const registro = await salvarBackup('manual', perfil.nome || 'Master')
          return NextResponse.json({ ok: true, backup: registro })
    } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
    }
}
