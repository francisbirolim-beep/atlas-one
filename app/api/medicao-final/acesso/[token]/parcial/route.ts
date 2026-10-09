import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

export async function POST(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const { data: medicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('id, status_operacional, iniciado_em, versao, empresa_id')
    .eq('id', acesso.medicao_id)
    .maybeSingle()

  if (!medicao) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })
  if (!medicao.iniciado_em || !['em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return NextResponse.json({ error: 'A Medicao Final precisa estar em andamento para ser enviada como parcial.' }, { status: 409 })
  }

  const { data: itens, error: itensError } = await supabaseAdmin
    .from('medicao_itens')
    .select('id, quantidade, medido')
    .eq('medicao_id', acesso.medicao_id)

  if (itensError) return NextResponse.json({ error: 'Nao foi possivel conferir as pecas da medicao.' }, { status: 500 })

  const lista = itens || []
  const total = lista.reduce((soma, item) => soma + Math.max(1, Number(item.quantidade || 1)), 0)
  const medidas = lista.reduce((soma, item) => soma + (item.medido ? 1 : 0), 0)
  const abertas = Math.max(0, total - medidas)

  if (medidas === 0) {
    return NextResponse.json({ error: 'Salve pelo menos uma peca medida antes de enviar uma medicao parcial.' }, { status: 409 })
  }
  if (abertas === 0) {
    return NextResponse.json({ error: 'Todas as pecas ja estao medidas. Use Finalizar e enviar Medicao Final.' }, { status: 409 })
  }

  const { data: ultima } = await supabaseAdmin
    .from('medicao_revisoes')
    .select('motivo, versao')
    .eq('medicao_id', acesso.medicao_id)
    .in('motivo', ['Medição parcial', 'Retomada da medição'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultima?.motivo === 'Medição parcial') {
    return NextResponse.json({ error: 'Esta medicao ja foi enviada como parcial. Continue quando houver novas pecas para medir.' }, { status: 409 })
  }

  const versao = Math.max(Number(medicao.versao || 0), Number(ultima?.versao || 0)) + 1
  const agora = new Date().toISOString()

  const { error: revisaoError } = await supabaseAdmin
    .from('medicao_revisoes')
    .insert({
      medicao_id: acesso.medicao_id,
      empresa_id: medicao.empresa_id,
      versao,
      motivo: 'Medição parcial',
      snapshot: {
        evento: 'parcial',
        registrado_em: agora,
        pecas_medidas: medidas,
        pecas_abertas: abertas,
        total_pecas: total,
        origem: 'acesso_externo',
      },
      criado_por_id: null,
      criado_por_nome: acesso.nome_convidado || 'Acesso externo',
    })

  if (revisaoError) {
    console.error('Erro ao registrar medicao parcial externa:', revisaoError)
    return NextResponse.json({ error: 'Nao foi possivel enviar a medicao parcial.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('medicoes_finais')
    .update({ versao })
    .eq('id', acesso.medicao_id)

  return NextResponse.json({
    ok: true,
    pecasMedidas: medidas,
    pecasAbertas: abertas,
    mensagem: `Medicao parcial enviada: ${medidas} peca(s) concluida(s) e ${abertas} em aberto.`,
  })
}
