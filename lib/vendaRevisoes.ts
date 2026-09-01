import { supabase } from './supabase'
import { usuarioAtual } from './auth'

export type VendaObraResumo = {
  id: string
  numero: number
  orcamento_id: string
  cliente_id: string
  obra_id?: string | null
  valor_venda: number
  custo_previsto?: number | null
  itens_snapshot: any[]
  config_snapshot: Record<string, any>
  versao: number
  status: string
}

export type VendaObraRevisao = {
  id: string
  venda_obra_id: string
  versao: number
  tipo: string
  justificativa: string
  antes?: Record<string, any> | null
  depois?: Record<string, any> | null
  impacto_valor?: number | null
  impacto_custo?: number | null
  criado_por_nome?: string | null
  created_at: string
}

export async function carregarVendaPorOrcamento(orcamentoId: string): Promise<{
  venda: VendaObraResumo | null
  estadoAtual: Record<string, any> | null
  revisoes: VendaObraRevisao[]
}> {
  const { data: vendaData } = await supabase
    .from('vendas_obras')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .maybeSingle()

  if (!vendaData) return { venda: null, estadoAtual: null, revisoes: [] }

  const [{ data: estado }, { data: revisoes }] = await Promise.all([
    supabase.rpc('fn_venda_estado_atual_v1', { p_venda_obra_id: vendaData.id }),
    supabase
      .from('venda_obra_revisoes')
      .select('*')
      .eq('venda_obra_id', vendaData.id)
      .order('versao', { ascending: false }),
  ])

  return {
    venda: vendaData as VendaObraResumo,
    estadoAtual: (estado as Record<string, any>) || null,
    revisoes: (revisoes || []) as VendaObraRevisao[],
  }
}

export async function registrarRevisaoVenda(dados: {
  vendaId: string
  justificativa: string
  depois: Record<string, any>
  impactoValor?: number | null
  impactoCusto?: number | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const usuario = await usuarioAtual()
  const { data, error } = await supabase.rpc('fn_registrar_revisao_venda_v1', {
    p_venda_obra_id: dados.vendaId,
    p_justificativa: dados.justificativa,
    p_depois: dados.depois,
    p_impacto_valor: dados.impactoValor ?? null,
    p_impacto_custo: dados.impactoCusto ?? null,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: String(data || '') || undefined }
}

export function estadoComContramarco(estado: Record<string, any>, valor: 'sem' | 'com') {
  return {
    ...estado,
    config_snapshot: {
      ...(estado?.config_snapshot || {}),
      contramarco: valor,
    },
  }
}
