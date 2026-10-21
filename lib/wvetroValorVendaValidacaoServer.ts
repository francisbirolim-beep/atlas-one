import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin as db } from './supabaseAdmin'
import { podeValidarOrcamentoEmpresa } from './validacaoOrcamentoAcessoServer'
import type { UsuarioTenant } from './tenantServer'
import { centavosVendaWVetro, valorOrigemVendaWVetro } from './wvetroValorVendaValidacao'

const erro = (error: string, status = 400) => NextResponse.json({ error }, { status })

/**
 * Conferência comercial independente da validação técnica por esquadria.
 * Jamais regravar preço/custo de itens ou valores de uma venda já confirmada.
 */
export async function conferirValorVendaImportadoWVetro(usuario: UsuarioTenant, body: Record<string, any>) {
  const aprovado = await podeValidarOrcamentoEmpresa(usuario)
  if (!aprovado) return erro('Sem permissão para conferir o valor de venda.', 403)

  const cardId = String(body.cardId || '').trim()
  if (!cardId) return erro('Orçamento não informado.')
  const { data: alvo, error: leitura } = await db.from('orcamentos').select('*')
    .eq('empresa_id', usuario.empresa_id).eq('id', cardId).maybeSingle()
  if (leitura) throw leitura
  if (!alvo) {
    return erro('Orçamento não encontrado.', 404)
  }

  const fluxo = alvo.wvetro_fluxo && typeof alvo.wvetro_fluxo === 'object' &&
    !Array.isArray(alvo.wvetro_fluxo) ? alvo.wvetro_fluxo : {}
  const numero = String(fluxo.numero || fluxo.numero_wvetro || '').trim()
  if (!numero || !String(fluxo.origem || '').toLowerCase().includes('wvetro')) {
    return erro('Esta conferência é exclusiva para orçamentos importados do W.Vetro.', 409)
  }
  const { data: vendas, error: erroVendas } = await db.from('vendas_obras').select('id')
    .eq('empresa_id', usuario.empresa_id).eq('orcamento_id', alvo.id).limit(1)
  if (erroVendas) throw erroVendas
  if (vendas?.length || String(alvo.status || '').toLowerCase() === 'vendido') {
    return erro('Este orçamento já tem venda confirmada. Corrija o valor na conferência da Venda/CMV, não no orçamento.', 409)
  }

  // O card de quem está validando deve continuar sendo a versão aberta na tela.
  if (String(body.atualizadoEm ?? '') !== String(alvo.updated_at ?? '')) {
    return erro('Outro usuário alterou este orçamento. Reabra o card antes de conferir o valor.', 409)
  }
  const antes = alvo.valor_estimado == null ? null : Number(alvo.valor_estimado)
  if (body.valorAnterior !== antes) {
    return erro('O valor de venda mudou em outra sessão. Atualize o card.', 409)
  }
  const modo = body.modo === 'corrigir' ? 'corrigir' : body.modo === 'validar' ? 'validar' : ''
  if (!modo) return erro('Selecione Validar ou Corrigir.')
  const centavosAtuais = antes === null ? null : centavosVendaWVetro(antes)
  if (antes !== null && centavosAtuais === null) return erro('Valor atual inválido; reabra o orçamento.', 409)
  const centavosFinal = modo === 'corrigir' ? centavosVendaWVetro(body.valorCorrigido) : centavosAtuais
  if (centavosFinal === null) return erro('Informe um valor positivo com até duas casas decimais.')
  if (modo === 'corrigir' && centavosFinal === centavosAtuais) {
    return erro('O valor informado é igual ao atual. Use Validar valor atual.')
  }
  const justificativa = String(body.justificativa || '').trim()
  if (modo === 'corrigir' && (justificativa.length < 5 || justificativa.length > 500)) {
    return erro('Informe a justificativa da correção (de 5 a 500 caracteres).')
  }

  const valorFinal = centavosFinal / 100
  const agora = new Date().toISOString()
  const valorOrigem = valorOrigemVendaWVetro(fluxo)
  const registroId = randomUUID()
  const evento = {
    status: modo === 'corrigir' ? 'corrigido' : 'validado',
    valor_origem_wvetro: valorOrigem,
    valor_anterior: antes,
    valor_final: valorFinal,
    justificativa: modo === 'corrigir' ? justificativa : null,
    conferido_em: agora, conferido_por_id: usuario.id, conferido_por_nome: usuario.nome,
    feedback_id: registroId,
  }
  // Feedback permanente: além da revisão mais recente no orçamento, registra
  // cada decisão humana com antes/depois e autoria, inclusive revalidações.
  const { error: erroFeedback } = await db.from('ai_orcamento_feedback').insert({
    id: registroId, empresa_id: usuario.empresa_id, orcamento_id: alvo.id,
    intake_id: null, avaliacao: modo === 'corrigir' ? 'corrigido' : 'validado',
    resultado_original: { origem_aprendizado: 'wvetro_conferencia_valor_venda', numero_wvetro: numero, valor_estimado: antes, valor_wvetro: valorOrigem },
    resultado_final: { origem_aprendizado: 'wvetro_conferencia_valor_venda', numero_wvetro: numero, valor_estimado: valorFinal },
    diferencas: modo === 'corrigir' ? { valor_estimado: { antes, depois: valorFinal }, justificativa } : {},
    usuario_id: usuario.id, usuario_nome: usuario.nome || null,
  })
  if (erroFeedback) throw erroFeedback

  const patch = {
    ...(modo === 'corrigir' ? { valor_estimado: valorFinal } : {}),
    wvetro_fluxo: { ...fluxo, valor_venda_conferencia: evento }, updated_at: agora,
  }
  let gravacao = db.from('orcamentos').update(patch)
    .eq('empresa_id', usuario.empresa_id).eq('id', alvo.id)
  gravacao = alvo.updated_at ? gravacao.eq('updated_at', alvo.updated_at) : gravacao.is('updated_at', null)
  const { data: atualizado, error: erroSalvar } = await gravacao.select('*').maybeSingle()
  if (erroSalvar || !atualizado) {
    const { error: limpeza } = await db.from('ai_orcamento_feedback').delete()
      .eq('empresa_id', usuario.empresa_id).eq('id', registroId)
    if (limpeza) throw new Error('Não foi possível concluir a conferência. Atualize o card.')
    if (erroSalvar) throw erroSalvar
    return erro('Orçamento alterado por outra sessão. Nenhuma correção foi aplicada.', 409)
  }

  const dinheiro = (n: number | null) => n == null ? 'Não informado'
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const hist = await db.from('historico').insert({
    orcamento_id: alvo.id, usuario_id: usuario.id, usuario_nome: usuario.nome || 'Usuário',
    acao: modo === 'corrigir' ? 'Corrigiu valor de venda W.Vetro' : 'Validou valor de venda W.Vetro',
    detalhes: 'W.Vetro #' + numero + ' · ' + dinheiro(antes) + ' → ' + dinheiro(valorFinal) +
      (modo === 'corrigir' ? ' · Motivo: ' + justificativa : ' · Valor conferido sem alteração'),
  })
  if (hist.error) console.error('[wvetro valor venda] Histórico complementar indisponível; feedback e auditoria foram preservados.')
  return NextResponse.json({
    ok: true, orcamento: atualizado,
    mensagem: modo === 'corrigir' ? 'Valor de venda corrigido e registrado no histórico.'
      : 'Valor de venda validado sem alteração.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]