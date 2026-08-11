import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

function numeroValido(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const itemId = String(body?.itemId || '')
  const medidas = body?.medidas || {}

  const { data: item } = await supabaseAdmin
    .from('medicao_itens')
    .select('id')
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Peca nao encontrada nesta medicao.' }, { status: 404 })

  const valores = {
    largura_baixo_mm: numeroValido(medidas.largura_baixo_mm),
    largura_meio_mm: numeroValido(medidas.largura_meio_mm),
    largura_cima_mm: numeroValido(medidas.largura_cima_mm),
    altura_direita_mm: numeroValido(medidas.altura_direita_mm),
    altura_meio_mm: numeroValido(medidas.altura_meio_mm),
    altura_esquerda_mm: numeroValido(medidas.altura_esquerda_mm),
  }

  if (Object.values(valores).some(v => v === null)) {
    return NextResponse.json({ error: 'Preencha as 3 larguras e as 3 alturas com valores validos.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('medicao_itens')
    .update({
      ...valores,
      medido: true,
      medido_em: new Date().toISOString(),
      medido_por_id: null,
      medido_por_nome: acesso.nome_convidado || 'Acesso externo',
    })
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel salvar as medidas.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
