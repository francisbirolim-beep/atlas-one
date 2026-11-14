import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { dataMaisDias } from '@/lib/agendaRecorrencia'
import { materializarRecorrencia, type RegraPersistida } from '@/lib/agendaRecorrenciaServer'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Materializa as próximas ocorrências diariamente, sem duplicar cards. */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return NextResponse.json({ error: 'Agendamento não configurado' }, { status: 503 })
  if (req.headers.get('authorization') !== 'Bearer ' + segredo) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const campo = (nome: string) => partes.find(p => p.type === nome)?.value || ''
    const hoje = campo('year') + '-' + campo('month') + '-' + campo('day')
    const limite = dataMaisDias(hoje, 1)
    const { data: regras, error } = await supabaseAdmin.from('atlas_recorrencias')
      .select('*').eq('ativo', true).lte('proxima_data', limite)
      .order('proxima_data', { ascending: true }).limit(30)
    if (error) throw error

    let geradas = 0
    const erros: string[] = []
    for (const regra of (regras || []) as RegraPersistida[]) {
      let proxima: string | null = regra.proxima_data
      for (let tentativa = 0; tentativa < 16 && proxima && proxima <= limite; tentativa++) {
        try {
          const seguinte = await materializarRecorrencia(regra, proxima)
          geradas++
          proxima = seguinte
          if (proxima) regra.proxima_data = proxima
        } catch (erro) {
          console.error('Falha em recorrência', regra.id, erro)
          erros.push(regra.id)
          break
        }
      }
    }
    return NextResponse.json({ ok: erros.length === 0, verificadas: regras?.length || 0, geradas, falhas: erros.length })
  } catch (erro) {
    console.error('Falha ao gerar recorrências:', erro)
    return NextResponse.json({ error: 'Falha no processamento automático' }, { status: 500 })
  }
}
