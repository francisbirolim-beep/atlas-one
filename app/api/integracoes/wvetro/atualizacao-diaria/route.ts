import { NextRequest, NextResponse } from 'next/server'
import { autenticarSchedulerWVetro } from '@/lib/wvetroSchedulerServer'
import {
  mapearReferenciasComponentesExatas,
  materializarReferenciasTipologiasWVetroPendentes,
  processarBaseTecnicaWVetroDia,
  resumoBaseTecnicaWVetro,
  sincronizarCustosProdutosWVetro,
} from '@/lib/wvetroBaseTecnicaServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function dataLocal(offsetDias = 0) {
  const agora = new Date()
  const base = new Date(agora.getTime() + offsetDias * 86400000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base)
  const valor = Object.fromEntries(partes.map(p => [p.type, p.value]))
  return valor.year + '-' + valor.month + '-' + valor.day
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarSchedulerWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Scheduler não autorizado.' }, { status: 401 })

  const hoje = dataLocal(0)
  const ontem = dataLocal(-1)
  try {
    const resultados = []
    for (const data of [ontem, hoje]) {
      resultados.push(await processarBaseTecnicaWVetroDia(data))
    }
    const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
    const mapeamento = await mapearReferenciasComponentesExatas()
    const custos = await sincronizarCustosProdutosWVetro()
    const resumo = await resumoBaseTecnicaWVetro()

    await supabaseAdmin.from('agente_memorias').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: usuario.id,
      chave: 'atlas_operacional:v1:wvetro',
      valor: JSON.stringify({
        versao: 1,
        dominio: 'wvetro',
        tipo: 'observacao_tecnica_diaria',
        periodo: { inicio: ontem, fim: hoje },
        resultados,
        tipologias,
        mapeamento,
        custos,
        resumo,
        evidencia: 'observado',
        registrado_em: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      periodo: { inicio: ontem, fim: hoje },
      resultados,
      tipologias,
      mapeamento,
      custos,
      resumo,
      seguranca: {
        fonte: 'W.Vetro',
        regra: 'Observação técnica; fórmulas e receitas continuam exigindo validação.',
      },
    })
  } catch (e) {
    console.error('Atualização diária W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na atualização diária W.Vetro.' }, { status: 500 })
  }
}
