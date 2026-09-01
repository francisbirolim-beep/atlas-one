import { supabase } from '@/lib/supabase'

export interface Obra {
  id: string
  numero: number
  cliente_id: string
  nome: string
  status: string
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  responsavel?: string | null
  data_inicio?: string | null
  previsao_entrega?: string | null
  observacoes?: string | null
  created_at: string
}

export interface ContaReceber {
  id: string
  valor: number
  valor_pago: number | null
  status: string
  vencimento: string | null
  data_emissao: string
  obra_id?: string | null
  documento?: string | null
}

export interface Recebimento {
  id: string
  valor: number
  data_recebimento: string
  forma?: string | null
  obra_id?: string | null
}

export interface ClienteDocumento {
  id: string
  titulo: string
  nome_arquivo?: string | null
  url: string
  tipo?: string | null
  created_at: string
  obra_id?: string | null
}

export interface ResumoCliente360 {
  obras: Obra[]
  contasReceber: ContaReceber[]
  recebimentos: Recebimento[]
  documentos: ClienteDocumento[]
  faturado: number
  aReceber: number
  recebimentosNaoAlocados: number
}

export async function carregarResumoCliente360(clienteId: string): Promise<ResumoCliente360> {
  const [obrasResp, contasResp, recebimentosResp, alocacoesResp, documentosResp] = await Promise.all([
    supabase.from('obras').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
    supabase.from('financeiro_contas_receber').select('id,valor,valor_pago,status,vencimento,data_emissao,obra_id,documento').eq('cliente_id', clienteId),
    supabase.from('financeiro_recebimentos').select('id,valor,data_recebimento,forma,obra_id').eq('cliente_id', clienteId).neq('status', 'cancelado'),
    supabase.from('financeiro_recebimento_alocacoes').select('recebimento_id,valor'),
    supabase.from('cliente_documentos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
  ])

  const obras = (obrasResp.data || []) as Obra[]
  const contasReceber = (contasResp.data || []) as ContaReceber[]
  const recebimentos = (recebimentosResp.data || []) as Recebimento[]
  const documentos = (documentosResp.data || []) as ClienteDocumento[]

  const idsRecebimentos = new Set(recebimentos.map(r => r.id))
  const alocacoes = ((alocacoesResp.data || []) as Array<{ recebimento_id: string; valor: number }>)
    .filter(a => idsRecebimentos.has(a.recebimento_id))

  const faturado = contasReceber.reduce((soma, c) => soma + (c.valor_pago || 0), 0)
  const aReceber = contasReceber
    .filter(c => c.status !== 'pago' && c.status !== 'cancelado')
    .reduce((soma, c) => soma + (c.valor - (c.valor_pago || 0)), 0)
  const totalRecebido = recebimentos.reduce((soma, r) => soma + (r.valor || 0), 0)
  const totalAlocado = alocacoes.reduce((soma, a) => soma + (a.valor || 0), 0)
  const recebimentosNaoAlocados = Math.max(0, totalRecebido - totalAlocado)

  return { obras, contasReceber, recebimentos, documentos, faturado, aReceber, recebimentosNaoAlocados }
}

export async function criarObra(clienteId: string, nome: string, dados: Partial<Obra> = {}): Promise<string | null> {
  const { data, error } = await supabase
    .from('obras')
    .insert({ cliente_id: clienteId, nome, ...dados })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as string
}

export function statusObraLabel(status: string) {
  const mapa: Record<string, string> = {
    planejamento: 'Planejamento',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    pausada: 'Pausada',
    cancelada: 'Cancelada',
  }
  return mapa[status] || status.replace(/_/g, ' ')
}

export function statusContaLabel(status: string) {
  const mapa: Record<string, string> = {
    aberto: 'Em aberto',
    pago: 'Pago',
    parcial: 'Parcial',
    vencido: 'Vencido',
    cancelado: 'Cancelado',
  }
  return mapa[status] || status
}
