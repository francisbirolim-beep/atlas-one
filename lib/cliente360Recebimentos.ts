import { supabase } from './supabase'
import { usuarioAtual } from './auth'
import type { ContaReceberCliente360 } from './cliente360'

export interface AlocacaoParcelaInput {
  conta_receber_id: string
  valor: number
}

export interface RegistrarRecebimentoParcelasInput {
  clienteId: string
  clienteNome: string
  dataRecebimento: string
  forma: string
  referencia?: string
  observacoes?: string
  alocacoes: AlocacaoParcelaInput[]
}

export function saldoParcela(conta: ContaReceberCliente360) {
  return Math.max(0, Number(conta.valor || 0) - Number(conta.valor_pago || 0))
}

export async function registrarRecebimentoPorParcelas(
  dados: RegistrarRecebimentoParcelasInput,
): Promise<{ ok: boolean; recebimentoId?: string; valor?: number; parcelas?: number; error?: string }> {
  if (!dados.clienteId) return { ok: false, error: 'Cliente não informado.' }

  const alocacoes = dados.alocacoes
    .filter(item => item.conta_receber_id && Number.isFinite(item.valor) && item.valor > 0)
    .map(item => ({ conta_receber_id: item.conta_receber_id, valor: Number(item.valor.toFixed(2)) }))

  if (!alocacoes.length) return { ok: false, error: 'Selecione ao menos uma parcela.' }

  const usuario = await usuarioAtual()
  const { data, error } = await supabase.rpc('registrar_recebimento_cliente_parcelas', {
    p_cliente_id: dados.clienteId,
    p_cliente_nome: dados.clienteNome,
    p_data_recebimento: dados.dataRecebimento || new Date().toISOString().slice(0, 10),
    p_forma: dados.forma || 'pix',
    p_referencia: dados.referencia?.trim() || null,
    p_observacoes: dados.observacoes?.trim() || null,
    p_alocacoes: alocacoes,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || null,
  })

  if (error) return { ok: false, error: error.message }

  const resultado = (data || {}) as {
    ok?: boolean
    recebimento_id?: string
    valor?: number
    parcelas?: number
  }

  return {
    ok: resultado.ok !== false,
    recebimentoId: resultado.recebimento_id,
    valor: Number(resultado.valor || 0),
    parcelas: Number(resultado.parcelas || alocacoes.length),
  }
}
