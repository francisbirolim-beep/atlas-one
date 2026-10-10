import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

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

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const vendaId = texto(body.vendaId, 80)
    const ids:string[] = Array.from(new Set<string>((Array.isArray(body.necessidadeIds) ? body.necessidadeIds : []).map((x:any)=>texto(x,80)).filter((x:string)=>Boolean(x))))
    const statusPedido = texto(body.status, 40).toLowerCase()
    const status = MAPA_STATUS[statusPedido]

    if (!vendaId || !ids.length || !status) {
      return NextResponse.json({ error: 'Venda, itens ou situação inválidos.' }, { status: 400 })
    }

    const { data: venda, error: vendaError } = await supabaseAdmin
      .from('vendas_obras')
      .select('id,numero,obra_id,cliente_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', vendaId)
      .maybeSingle()
    if (vendaError) throw new Error(vendaError.message)
    if (!venda?.obra_id) return NextResponse.json({ error: 'A venda ainda não possui obra vinculada.' }, { status: 409 })

    const { data: necessidades, error: necessidadesError } = await supabaseAdmin
      .from('compras_necessidades')
      .select('id,status,observacoes,obra_id,descricao')
      .eq('empresa_id', usuario.empresa_id)
      .eq('obra_id', venda.obra_id)
      .in('id', ids as string[])
    if (necessidadesError) throw new Error(necessidadesError.message)
    if (!necessidades?.length) return NextResponse.json({ error: 'Nenhum material desta venda foi localizado em Compras.' }, { status: 404 })

    const fornecedorNome = texto(body.fornecedorNome, 250)
    const documentoNome = texto(body.documentoNome, 250)
    const documentoUrl = texto(body.documentoUrl, 1500)
    const origem = texto(body.origem, 80) || 'ajuste_manual_materiais'
    const agora = new Date().toISOString()

    const resultados:any[] = []
    for (const necessidade of necessidades) {
      const linhas = [
        texto(necessidade.observacoes, 3000),
        `[Atlas Materiais] ${agora} · ${usuario.nome} · ${origem} · status: ${status}`,
        fornecedorNome ? `Fornecedor: ${fornecedorNome}` : '',
        documentoNome ? `Documento: ${documentoNome}` : '',
        documentoUrl ? `Documento URL: ${documentoUrl}` : '',
      ].filter(Boolean)
      const atualizacao:Record<string,unknown> = {
        status,
        updated_at: agora,
        observacoes: linhas.join('\n').slice(-6000),
      }
      if (status === 'recebido') atualizacao.recebido_em = agora
      else atualizacao.recebido_em = null

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

    return NextResponse.json({
      ok: true,
      atualizados: resultados.length,
      solicitados: ids.length,
      naoLocalizados: ids.filter((id:string)=>!resultados.some(r=>r.id===id)),
      status,
      itens: resultados,
    })
  } catch (error) {
    console.error('[Materiais][status-lote]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar os materiais.' }, { status: 500 })
  }
}

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]