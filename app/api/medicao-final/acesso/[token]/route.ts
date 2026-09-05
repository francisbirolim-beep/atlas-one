import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao, carregarDadosExternosMedicao } from '@/lib/medicaoAcessoExternoServer'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const dados = await carregarDadosExternosMedicao(params.token)
  if (!dados) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })
  return NextResponse.json(dados)
}

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const { data: atual } = await supabaseAdmin
    .from('medicoes_finais')
    .select('status_operacional, iniciado_em, responsavel_nome')
    .eq('id', acesso.medicao_id)
    .eq('empresa_id', acesso.empresa_id)
    .maybeSingle()

  if (!atual) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })
  if (!['liberado', 'em_medicao', 'com_pendencia'].includes(atual.status_operacional || '')) {
    return NextResponse.json({ error: 'A medicao ainda nao foi liberada para execucao.' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('medicoes_finais')
    .update({
      status_operacional: 'em_medicao',
      iniciado_em: atual.iniciado_em || new Date().toISOString(),
      responsavel_nome: atual.responsavel_nome || acesso.nome_convidado || 'Acesso externo',
    })
    .eq('id', acesso.medicao_id)
    .eq('empresa_id', acesso.empresa_id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel iniciar a medicao.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
