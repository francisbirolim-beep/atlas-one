import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'
import { impedirRetornoDeRecebimento, type NecessidadeRecebimento } from '@/lib/comprasStatusGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAPA_STATUS: Record<string,string> = {
  falta: 'necessidade',
  necessidade: 'necessidade',
  cotacao: 'cotacao',
  comprado: 'aprovado',
  aprovado: 'aprovado',
  entrega: 'aguardando_entrega',
  aguardando_entrega: 'aguardando_entrega',
  recebido: 'recebido',
}

function texto(v: unknown, max = 500) {
  return String(v ?? '').trim().slice(0, max)
}

function idsUnicos(v: unknown) {
  return Array.from(new Set<string>(
    (Array.isArray(v) ? v : [])
      .map((x:any)=>texto(x,80))
      .filter((x:string)=>Boolean(x)),
  ))
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const vendaId = texto(body.vendaId, 80)
    const necessidadeIds = idsUnicos(body.necessidadeIds)
    const materialIds = idsUnicos(body.materialIds)
    const statusPedido = texto(body.status, 40).toLowerCase()
    const status = MAPA_STATUS[statusPedido]

    if (!vendaId || (!necessidadeIds.length && !materialIds.length) || !status) {
      return NextResponse.json({ error: 'Venda, itens ou situação inválidos.' }, { status: 400 })
    }

    const { data: venda, error: vendaError } = await supabaseAdmin
      .from('vendas_obras')
      .select('id,numero,obra_id,orcamento_id,cliente_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', vendaId)
      .maybeSingle()
    if (vendaError) throw new Error(vendaError.message)
    if (!venda) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })

    const fornecedorNome = texto(body.fornecedorNome, 250)
    const documentoNome = texto(body.documentoNome, 250)
    const documentoUrl = texto(body.documentoUrl, 1500)
    const pedidoNumero = texto(body.pedidoNumero, 120)
    const prazoEntrega = texto(body.prazoEntrega, 120)
    const previsaoEntrega = texto(body.previsaoEntrega, 30)
    const observacoesPedido = texto(body.observacoesPedido, 1000)
    const valorTotalRaw = body.valorTotal === null || body.valorTotal === undefined || body.valorTotal === '' ? null : Number(body.valorTotal)
    const valorTotal = Number.isFinite(valorTotalRaw as number) ? valorTotalRaw as number : null
    const origem = texto(body.origem, 80) || 'ajuste_manual_materiais'
    const agora = new Date().toISOString()

    // Validação ANTES de gravar materiais: nenhum item de outra obra pode ser atualizado
    // e uma compra realmente recebida não pode perder o histórico pelo Kanban.
    if (necessidadeIds.length && !venda.obra_id) {
      return NextResponse.json({ error: 'Vincule uma obra à venda antes de movimentar as compras.' }, { status: 409 })
    }
    let necessidadesValidadas: Array<NecessidadeRecebimento & { observacoes: string | null; obra_id: string; descricao: string }> = []
    if (necessidadeIds.length) {
      const { data, error } = await supabaseAdmin
        .from('compras_necessidades')
        .select('id,status,recebido_em,observacoes,obra_id,descricao')
        .eq('empresa_id', usuario.empresa_id)
        .eq('obra_id', venda.obra_id)
        .in('id', necessidadeIds)
      if (error) throw new Error(error.message)
      if ((data || []).length !== necessidadeIds.length) {
        return NextResponse.json({ error: 'Um ou mais materiais não pertencem a esta obra. Nenhum status foi alterado.' }, { status: 409 })
      }
      necessidadesValidadas = data || []
      const impedimento = impedirRetornoDeRecebimento(necessidadesValidadas, status)
      if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 })
    }

    let atualizadosMateriais = 0
    if (materialIds.length) {
      const { data: pacote, error: pacoteError } = await supabaseAdmin
        .from('pacotes_tecnicos')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('orcamento_id', venda.orcamento_id)
        .neq('status', 'substituido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (pacoteError) throw new Error(pacoteError.message)
      if (!pacote) return NextResponse.json({ error: 'Pacote técnico desta venda não encontrado.' }, { status: 409 })

      const { data: materiais, error: materiaisError } = await supabaseAdmin
        .from('pacote_tecnico_materiais')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('pacote_id', pacote.id)
        .eq('excluido', false)
        .in('id', materialIds)
      if (materiaisError) throw new Error(materiaisError.message)
      const idsValidos = (materiais || []).map((m:any)=>m.id)
      if (idsValidos.length !== materialIds.length) return NextResponse.json({ error: 'Um ou mais materiais técnicos não pertencem a esta venda. Nenhum status foi alterado.' }, { status: 409 })

      const { data: alterados, error: updateMaterialError } = await supabaseAdmin
        .from('pacote_tecnico_materiais')
        .update({
          status_compra: status,
          status_compra_atualizado_em: agora,
          updated_at: agora,
        })
        .eq('empresa_id', usuario.empresa_id)
        .eq('pacote_id', pacote.id)
        .eq('excluido', false)
        .in('id', idsValidos)
        .select('id')
      if (updateMaterialError) throw new Error(updateMaterialError.message)
      atualizadosMateriais = alterados?.length || 0
    }

    const resultados:any[] = []
    if (necessidadeIds.length) {
      for (const necessidade of necessidadesValidadas) {
        const linhas = [
          texto(necessidade.observacoes, 3000),
          `[Atlas Materiais] ${agora} · ${usuario.nome} · ${origem} · status: ${status}`,
          fornecedorNome ? `Fornecedor: ${fornecedorNome}` : '',
          documentoNome ? `Documento: ${documentoNome}` : '',
          documentoUrl ? `Documento URL: ${documentoUrl}` : '',
          pedidoNumero ? `Pedido: ${pedidoNumero}` : '',
          valorTotal !== null ? `Valor total: ${valorTotal}` : '',
          prazoEntrega ? `Prazo: ${prazoEntrega}` : '',
          previsaoEntrega ? `Previsão: ${previsaoEntrega}` : '',
          observacoesPedido ? `Observação compra: ${observacoesPedido}` : '',
        ].filter(Boolean)
        const atualizacao:Record<string,unknown> = {
          status,
          updated_at: agora,
          observacoes: linhas.join('\n').slice(-6000),
        }
        // A data recebido_em pertence à conferência de recebimento, nunca ao arrasto.
        // Mesmo quando o card vai para Recebido, esta rotina NÃO confirma entrada física.

        const { data, error } = await supabaseAdmin
          .from('compras_necessidades')
          .update(atualizacao)
          .eq('empresa_id', usuario.empresa_id)
          .eq('obra_id', venda.obra_id)
          .eq('id', necessidade.id)
          .select('id,status,descricao,recebido_em,observacoes')
          .single()
        if (error) throw new Error(error.message)
        resultados.push(data)
      }
    }

    return NextResponse.json({
      ok: true,
      atualizados: resultados.length,
      atualizadosMateriais,
      solicitadosNecessidades: necessidadeIds.length,
      solicitadosMateriais: materialIds.length,
      status,
      itens: resultados,
      aviso: status === 'recebido'
        ? 'Etapa administrativa registrada. A conferência física, a NF e a entrada no estoque continuam sendo operações próprias.'
        : 'Etapa administrativa atualizada. Esta operação não estorna estoque, notas fiscais nem pagamentos.',
    })
  } catch (error) {
    console.error('[Materiais][status-lote]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar os materiais.' }, { status: 500 })
  }
}