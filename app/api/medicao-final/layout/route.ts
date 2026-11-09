import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4 } from '@/lib/medicaoFinalLayoutA4Schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const resposta = (error: string, status: number) => NextResponse.json({ error }, { status })

/** O contexto da obra é SEMPRE resolvido por banco e tenant, jamais pelo cliente. */
async function localizarObra(usuario: UsuarioTenant, obraId: string | null, medicaoId: string | null) {
  if (obraId && !UUID.test(obraId)) return { erro: resposta('Identificador da obra inválido.', 400) }
  if (medicaoId && !UUID.test(medicaoId)) return { erro: resposta('Identificador da medição inválido.', 400) }
  let id = obraId
  if (medicaoId) {
    const { data: medicao, error } = await supabaseAdmin.from('medicoes_finais')
      .select('id,obra_id,orcamento_id').eq('id', medicaoId)
      .eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (error) return { erro: resposta('Falha ao conferir a medição.', 503) }
    if (!medicao) return { erro: resposta('Medição não encontrada nesta empresa.', 404) }
    if (id && medicao.obra_id && id !== medicao.obra_id) {
      return { erro: resposta('A medição não pertence à obra informada.', 403) }
    }
    if (!id) id = medicao.obra_id || null
    if (!id && medicao.orcamento_id) {
      const { data: venda, error: erroVenda } = await supabaseAdmin.from('vendas_obras')
        .select('obra_id').eq('orcamento_id', medicao.orcamento_id)
        .eq('empresa_id', usuario.empresa_id).is('excluida_em', null).maybeSingle()
      if (erroVenda) return { erro: resposta('Falha ao consultar a obra da venda.', 503) }
      id = venda?.obra_id || null
    }
    if (!id && medicao.orcamento_id) {
      const { data: orcamento, error: erroOrcamento } = await supabaseAdmin.from('orcamentos')
        .select('obra_id').eq('id', medicao.orcamento_id)
        .eq('empresa_id', usuario.empresa_id).maybeSingle()
      if (erroOrcamento) return { erro: resposta('Falha ao localizar a obra do orçamento.', 503) }
      id = orcamento?.obra_id || null
    }
  }
  if (!id) return { obraId: null }
  const { data: obra, error } = await supabaseAdmin.from('obras')
    .select('id').eq('id', id).eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (error) return { erro: resposta('Falha ao conferir a obra.', 503) }
  if (!obra) return { erro: resposta('Obra não encontrada nesta empresa.', 404) }
  return { obraId: obra.id as string }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return resposta('Não autorizado.', 401)
  const contexto = await localizarObra(usuario, req.nextUrl.searchParams.get('obraId'), req.nextUrl.searchParams.get('medicaoId'))
  if (contexto.erro) return contexto.erro

  const { data: geral, error: erroGeral } = await supabaseAdmin.from('medicao_final_layouts')
    .select('configuracao,updated_at').eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (erroGeral) return resposta('Não foi possível carregar o padrão de impressão da empresa.', 503)
  const layoutGeral = normalizarLayoutMedicaoA4(geral?.configuracao || LAYOUT_MEDICAO_A4_PADRAO)
  let individual = null
  if (contexto.obraId) {
    const { data, error } = await supabaseAdmin.from('medicao_final_layouts_obras')
      .select('configuracao,updated_at').eq('empresa_id', usuario.empresa_id)
      .eq('obra_id', contexto.obraId).maybeSingle()
    if (error) return resposta('Não foi possível carregar o layout desta obra.', 503)
    individual = data
  }
  return NextResponse.json({
    layout: individual ? normalizarLayoutMedicaoA4(individual.configuracao) : layoutGeral,
    layoutGeral,
    origem: individual ? 'obra' : 'geral',
    obraId: contexto.obraId || null,
    atualizadoEm: individual?.updated_at || geral?.updated_at || null,
  })
}

export async function PUT(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return resposta('Não autorizado.', 401)
  if (usuario.role !== 'master') return resposta('Somente o Master pode editar o padrão da medição final.', 403)

  const corpo = await req.json().catch(() => null)
  if (!corpo || typeof corpo.layout !== 'object' || corpo.layout === null || Array.isArray(corpo.layout)) {
    return resposta('Configuração de layout inválida.', 400)
  }
  const escopo = corpo.escopo ?? 'geral'
  if (escopo !== 'obra' && escopo !== 'geral') return resposta('Escolha salvar para esta obra ou para todos.', 400)
  const layout = normalizarLayoutMedicaoA4(corpo.layout)

  if (escopo === 'obra') {
    if (typeof corpo.obraId !== 'string' || !corpo.obraId) return resposta('Selecione uma obra para salvar um layout exclusivo.', 400)
    const contexto = await localizarObra(usuario, corpo.obraId, null)
    if (contexto.erro) return contexto.erro
    if (!contexto.obraId) return resposta('Obra não encontrada.', 404)
    const { error } = await supabaseAdmin.from('medicao_final_layouts_obras').upsert({
      empresa_id: usuario.empresa_id,
      obra_id: contexto.obraId,
      configuracao: layout,
      atualizado_por: usuario.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id,obra_id' })
    if (error) return resposta('Não foi possível salvar o layout desta obra.', 503)
    return NextResponse.json({ ok: true, escopo, obraId: contexto.obraId, layout })
  }

  const { error } = await supabaseAdmin.from('medicao_final_layouts').upsert({
    empresa_id: usuario.empresa_id,
    configuracao: layout,
    atualizado_por: usuario.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_id' })
  if (error) return resposta('Não foi possível salvar o padrão geral.', 503)
  return NextResponse.json({ ok: true, escopo, layout })
}

/** Exclui somente a personalização da obra e volta a herdar o layout geral. */
export async function DELETE(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return resposta('Não autorizado.', 401)
  if (usuario.role !== 'master') return resposta('Somente o Master pode restaurar o padrão da obra.', 403)
  const obraId = req.nextUrl.searchParams.get('obraId')
  if (!obraId) return resposta('Informe a obra que voltará a usar o padrão geral.', 400)
  const contexto = await localizarObra(usuario, obraId, null)
  if (contexto.erro) return contexto.erro
  if (!contexto.obraId) return resposta('Obra não encontrada.', 404)
  const { error } = await supabaseAdmin.from('medicao_final_layouts_obras').delete()
    .eq('empresa_id', usuario.empresa_id).eq('obra_id', contexto.obraId)
  if (error) return resposta('Não foi possível restaurar o padrão desta obra.', 503)
  return NextResponse.json({ ok: true, obraId: contexto.obraId })
}
