import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

function presente(valor: unknown) {
  return !(valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0))
}

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const [itensResp, camposResp, respostasResp, pendenciasResp] = await Promise.all([
    supabaseAdmin.from('medicao_itens').select('id, tipo_esquadria, descricao, quantidade, medido, campos_extras').eq('medicao_id', acesso.medicao_id),
    supabaseAdmin.from('tipologia_campos_extras').select('tipo_esquadria, chave, nome, obrigatorio, ativo').eq('ativo', true).eq('obrigatorio', true),
    supabaseAdmin.from('medicao_respostas').select('item_id, campo_chave, valor').eq('medicao_id', acesso.medicao_id),
    supabaseAdmin.from('medicao_pendencias').select('id', { count: 'exact', head: true }).eq('medicao_id', acesso.medicao_id).eq('status', 'aberta'),
  ])

  const itens = itensResp.data || []
  const campos = camposResp.data || []
  const respostas = respostasResp.data || []

  if (itens.length === 0) return NextResponse.json({ error: 'A medicao nao possui pecas.' }, { status: 400 })
  if (itens.some(i => Math.max(1, i.quantidade || 1) > 1)) {
    return NextResponse.json({ error: 'Existem pecas agrupadas. Separe as unidades no Atlas antes de concluir.' }, { status: 409 })
  }
  if (itens.some(i => !i.medido)) {
    return NextResponse.json({ error: 'Ainda existem pecas sem as medidas finais.' }, { status: 409 })
  }
  if ((pendenciasResp.count || 0) > 0) {
    return NextResponse.json({ error: 'Existem pendencias abertas que precisam ser resolvidas no Atlas.' }, { status: 409 })
  }

  const faltantes: string[] = []
  for (const item of itens) {
    const obrigatorios = campos.filter(c => !c.tipo_esquadria || c.tipo_esquadria === item.tipo_esquadria)
    for (const campo of obrigatorios) {
      const resposta = respostas.find(r => r.item_id === item.id && r.campo_chave === campo.chave)
      const legado = (item.campos_extras || {})[campo.chave]
      if (!presente(resposta?.valor) && !presente(legado)) {
        faltantes.push(`${item.descricao || item.tipo_esquadria}: ${campo.nome}`)
      }
    }
  }

  if (faltantes.length > 0) {
    return NextResponse.json({ error: 'Checklist obrigatorio incompleto.', faltantes: faltantes.slice(0, 20) }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('medicoes_finais')
    .update({ status_operacional: 'concluido', concluido_em: new Date().toISOString() })
    .eq('id', acesso.medicao_id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel concluir a medicao.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
