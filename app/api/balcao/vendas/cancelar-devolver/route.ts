import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function usuarioGerencial(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return null
  const nivel = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
  return nivel === 'edicao' ? usuario : null
}

async function caixaAbertoDoUsuario(usuarioId: string) {
  const { data } = await supabaseAdmin.from('balcao_caixas').select('id,status,operador_id')
    .eq('operador_id', usuarioId).eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1).maybeSingle()
  return data?.id || null
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioGerencial(req)
  if (!usuario) return NextResponse.json({ error: 'Operação restrita à gestão da Venda Balcão.' }, { status: 403 })
  try {
    const body = await req.json()
    const acao = String(body.acao || 'cancelar_devolver')
    if (acao === 'concluir_reembolso') {
      const eventoId = String(body.eventoId || '')
      if (!eventoId) return NextResponse.json({ error: 'Informe o reembolso pendente.' }, { status: 400 })
      const movimentarCaixa = Boolean(body.movimentarCaixa)
      const caixaId = movimentarCaixa ? (String(body.caixaId || '') || await caixaAbertoDoUsuario(usuario.id)) : null
      const { data, error } = await supabaseAdmin.rpc('concluir_reembolso_balcao', {
        p_evento_id: eventoId, p_usuario_id: usuario.id, p_usuario_nome: usuario.nome,
        p_movimentar_caixa: movimentarCaixa, p_caixa_id: caixaId,
        p_observacoes: String(body.observacoes || '').trim() || null,
      })
      if (error) throw error
      return NextResponse.json(data || { ok: true })
    }

    const vendaId = String(body.vendaId || '')
    const tipo = String(body.tipo || '')
    const motivo = String(body.motivo || '').trim()
    const chave = String(body.chaveIdempotencia || '').trim()
    if (!vendaId) return NextResponse.json({ error: 'Venda não informada.' }, { status: 400 })
    if (!['cancelamento_total', 'devolucao_parcial'].includes(tipo)) return NextResponse.json({ error: 'Escolha cancelamento total ou devolução parcial.' }, { status: 400 })
    if (!motivo) return NextResponse.json({ error: 'O motivo é obrigatório.' }, { status: 400 })
    if (!/^[0-9a-f-]{36}$/i.test(chave)) return NextResponse.json({ error: 'Chave de segurança da operação inválida. Reabra a operação.' }, { status: 400 })

    const reembolsarCaixa = Boolean(body.reembolsarCaixa)
    const caixaId = reembolsarCaixa ? (String(body.caixaId || '') || await caixaAbertoDoUsuario(usuario.id)) : null
    const itens = Array.isArray(body.itens) ? body.itens.map((i: any) => ({
      itemId: String(i.itemId || ''), quantidade: Number(i.quantidade || 0), localRetornoId: String(i.localRetornoId || '') || null,
    })).filter((i: any) => i.itemId && i.quantidade > 0) : []
    if (tipo === 'devolucao_parcial' && !itens.length) return NextResponse.json({ error: 'Selecione ao menos um item e quantidade para devolver.' }, { status: 400 })

    const { data, error } = await supabaseAdmin.rpc('processar_cancelamento_devolucao_balcao', {
      p_venda_id: vendaId, p_tipo: tipo, p_itens: itens, p_motivo: motivo,
      p_observacoes: String(body.observacoes || '').trim() || null,
      p_usuario_id: usuario.id, p_usuario_nome: usuario.nome,
      p_reembolsar_caixa: reembolsarCaixa, p_caixa_id: caixaId, p_chave_idempotencia: chave,
    })
    if (error) throw error
    return NextResponse.json(data || { ok: true })
  } catch (e: any) {
    console.error('Erro cancelamento/devolução Venda Balcão', e)
    return NextResponse.json({ error: e?.message || 'Não foi possível processar a operação.' }, { status: 400 })
  }
}
