import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_PENDENTES = ['reservado_outra_unidade', 'separando', 'em_entrega']
const ACOES = ['separar', 'enviar', 'entregar']

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso aos atendimentos do balcão.' }, { status: 403 })

  try {
    const localId = (req.nextUrl.searchParams.get('localId') || '').trim()
    let itensQuery = supabaseAdmin
      .from('balcao_venda_itens')
      .select('id,venda_id,produto_id,produto_codigo,produto_nome,unidade,quantidade,local_origem_id,atendimento_status,separado_em,separado_por_nome,enviado_em,enviado_por_nome,entregue_em,entregue_por_nome,atendimento_observacoes,created_at')
      .in('atendimento_status', STATUS_PENDENTES)
      .order('created_at', { ascending: true })
      .limit(300)

    if (localId) itensQuery = itensQuery.eq('local_origem_id', localId)

    const { data: itens, error: erroItens } = await itensQuery
    if (erroItens) throw erroItens
    const lista = itens || []

    const vendaIds = [...new Set(lista.map(i => i.venda_id).filter(Boolean))]
    const localIds = [...new Set(lista.map(i => i.local_origem_id).filter(Boolean))]

    const [{ data: vendas, error: erroVendas }, { data: locais, error: erroLocais }] = await Promise.all([
      vendaIds.length
        ? supabaseAdmin.from('balcao_vendas').select('id,numero,cliente_nome,vendedor_nome,unidade_id,atendimento_status,previsao_entrega,finalizada_em').in('id', vendaIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      localIds.length
        ? supabaseAdmin.from('estoque_locais').select('id,codigo,nome,unidade_id').in('id', localIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
    if (erroVendas) throw erroVendas
    if (erroLocais) throw erroLocais

    const unidadeIds = [...new Set([
      ...(vendas || []).map((v: any) => v.unidade_id),
      ...(locais || []).map((l: any) => l.unidade_id),
    ].filter(Boolean))]

    const { data: unidades, error: erroUnidades } = unidadeIds.length
      ? await supabaseAdmin.from('unidades_operacionais').select('id,codigo,nome').in('id', unidadeIds)
      : { data: [] as any[], error: null }
    if (erroUnidades) throw erroUnidades

    const vendaMap = new Map((vendas || []).map((v: any) => [v.id, v]))
    const localMap = new Map((locais || []).map((l: any) => [l.id, l]))
    const unidadeMap = new Map((unidades || []).map((u: any) => [u.id, u]))

    const atendimentos = lista.map((item: any) => {
      const venda: any = vendaMap.get(item.venda_id)
      const local: any = localMap.get(item.local_origem_id)
      const unidadeOrigem: any = unidadeMap.get(local?.unidade_id)
      const unidadeVenda: any = unidadeMap.get(venda?.unidade_id)
      return {
        ...item,
        venda: venda ? {
          id: venda.id,
          numero: Number(venda.numero),
          clienteNome: venda.cliente_nome || 'Cliente balcão',
          vendedorNome: venda.vendedor_nome,
          atendimentoStatus: venda.atendimento_status,
          previsaoEntrega: venda.previsao_entrega,
          finalizadaEm: venda.finalizada_em,
          unidadeNome: unidadeVenda?.nome || null,
          unidadeCodigo: unidadeVenda?.codigo || null,
        } : null,
        origem: local ? {
          localId: local.id,
          localCodigo: local.codigo,
          localNome: local.nome,
          unidadeId: local.unidade_id,
          unidadeNome: unidadeOrigem?.nome || 'Unidade',
          unidadeCodigo: unidadeOrigem?.codigo || '',
        } : null,
      }
    })

    const locaisFiltro = (locais || []).map((local: any) => {
      const unidade: any = unidadeMap.get(local.unidade_id)
      return {
        id: local.id,
        codigo: local.codigo,
        nome: local.nome,
        unidadeNome: unidade?.nome || 'Unidade',
        unidadeCodigo: unidade?.codigo || '',
      }
    }).sort((a: any, b: any) => `${a.unidadeNome} ${a.nome}`.localeCompare(`${b.unidadeNome} ${b.nome}`, 'pt-BR'))

    return NextResponse.json({ ok: true, atendimentos, locais: locaisFiltro })
  } catch (e) {
    console.error('Erro ao carregar atendimentos balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar a fila de atendimento.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'edicao')
  if (!usuario) return NextResponse.json({ error: 'Sem permissão para avançar atendimentos.' }, { status: 403 })

  try {
    const body = await req.json()
    const itemId = String(body.itemId || '').trim()
    const acao = String(body.acao || '').trim().toLowerCase()
    const observacoes = String(body.observacoes || '').trim()

    if (!itemId) return NextResponse.json({ error: 'Item do atendimento não informado.' }, { status: 400 })
    if (!ACOES.includes(acao)) return NextResponse.json({ error: 'Ação de atendimento inválida.' }, { status: 400 })

    const { data, error } = await supabaseAdmin.rpc('avancar_atendimento_venda_balcao', {
      p_item_id: itemId,
      p_acao: acao,
      p_usuario_id: usuario.id,
      p_usuario_nome: usuario.nome,
      p_observacoes: observacoes || null,
    })
    if (error) throw error
    return NextResponse.json(data || { ok: true })
  } catch (e: any) {
    console.error('Erro ao avançar atendimento balcão', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível avançar o atendimento.' }, { status: 400 })
  }
}
