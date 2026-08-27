import { supabase } from './supabase'
import { usuarioAtual } from './auth'

export type OrdemProducao = {
  id: string
  numero: number
  setor_card_id?: string | null
  cliente_id?: string | null
  obra_id?: string | null
  venda_obra_id?: string | null
  orcamento_id?: string | null
  revisao_id?: string | null
  item_ref?: string | null
  item_snapshot: Record<string, any>
  tipo_producao: 'contramarco' | 'esquadria' | 'personalizada'
  titulo: string
  quantidade: number
  largura_mm?: number | null
  altura_mm?: number | null
  status: 'aguardando' | 'liberada' | 'em_producao' | 'conferencia' | 'concluida' | 'cancelada'
  bloqueada: boolean
  bloqueio_motivo?: string | null
  origem: 'workflow' | 'manual'
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
  cliente_nome?: string | null
  obra_nome?: string | null
  venda_numero?: number | null
}

export type ClienteProducao = { id: string; nome: string }
export type ObraProducao = { id: string; cliente_id: string; nome: string; status: string }
export type VendaProducao = { id: string; numero: number; cliente_id: string; obra_id?: string | null; orcamento_id: string }

function mapOrdem(row: any): OrdemProducao {
  return {
    ...row,
    cliente_nome: row.clientes?.nome || null,
    obra_nome: row.obras?.nome || null,
    venda_numero: row.vendas_obras?.numero || null,
  } as OrdemProducao
}

export async function listarOrdensProducao(): Promise<OrdemProducao[]> {
  const { data, error } = await supabase
    .from('ordens_producao')
    .select('*, clientes(nome), obras(nome), vendas_obras(numero)')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Erro ao listar ordens de produção', error)
    return []
  }
  return (data || []).map(mapOrdem)
}

export async function listarOrdensPorCard(cardId: string): Promise<OrdemProducao[]> {
  const { data, error } = await supabase
    .from('ordens_producao')
    .select('*, clientes(nome), obras(nome), vendas_obras(numero)')
    .eq('setor_card_id', cardId)
    .order('tipo_producao')
    .order('created_at')
  if (error) return []
  return (data || []).map(mapOrdem)
}

export async function listarClientesProducao(): Promise<ClienteProducao[]> {
  const { data } = await supabase.from('clientes').select('id,nome').order('nome')
  return (data || []) as ClienteProducao[]
}

export async function listarObrasProducao(clienteId: string): Promise<ObraProducao[]> {
  if (!clienteId) return []
  const { data } = await supabase
    .from('obras')
    .select('id,cliente_id,nome,status')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  return (data || []) as ObraProducao[]
}

export async function listarVendasProducao(clienteId: string, obraId?: string | null): Promise<VendaProducao[]> {
  if (!clienteId) return []
  let q = supabase.from('vendas_obras').select('id,numero,cliente_id,obra_id,orcamento_id').eq('cliente_id', clienteId).order('created_at', { ascending: false })
  if (obraId) q = q.eq('obra_id', obraId)
  const { data } = await q
  return (data || []) as VendaProducao[]
}

export async function criarOrdemProducaoManual(dados: {
  clienteId?: string | null
  obraId?: string | null
  vendaId?: string | null
  orcamentoId?: string | null
  itemRef?: string | null
  tipoProducao: OrdemProducao['tipo_producao']
  titulo: string
  quantidade: number
  larguraMm?: number | null
  alturaMm?: number | null
  bloqueada?: boolean
  bloqueioMotivo?: string | null
}): Promise<{ ok: boolean; ordem?: OrdemProducao; error?: string }> {
  const usuario = await usuarioAtual()
  const { data: coluna } = await supabase
    .from('setor_kanban_colunas')
    .select('id')
    .eq('setor_id', 'producao')
    .order('ordem')
    .limit(1)
    .maybeSingle()

  let cardId: string | null = null
  if (coluna?.id) {
    const { data: card, error: erroCard } = await supabase.from('setor_kanban_itens').insert({
      titulo: dados.titulo.trim(),
      descricao: dados.clienteId ? 'Produção vinculada criada manualmente.' : 'Produção avulsa criada manualmente.',
      coluna_id: coluna.id,
      cliente_id: dados.clienteId || null,
      obra_id: dados.obraId || null,
      orcamento_id: dados.orcamentoId || null,
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
      atualizado_por_id: usuario?.id || null,
      atualizado_por_nome: usuario?.nome || null,
    }).select('id').single()
    if (erroCard) return { ok: false, error: erroCard.message }
    cardId = card?.id || null
  }

  const { data, error } = await supabase.from('ordens_producao').insert({
    setor_card_id: cardId,
    cliente_id: dados.clienteId || null,
    obra_id: dados.obraId || null,
    venda_obra_id: dados.vendaId || null,
    orcamento_id: dados.orcamentoId || null,
    item_ref: dados.itemRef || null,
    tipo_producao: dados.tipoProducao,
    titulo: dados.titulo.trim(),
    quantidade: Math.max(1, Number(dados.quantidade || 1)),
    largura_mm: dados.larguraMm ?? null,
    altura_mm: dados.alturaMm ?? null,
    status: dados.bloqueada ? 'aguardando' : 'liberada',
    bloqueada: !!dados.bloqueada,
    bloqueio_motivo: dados.bloqueioMotivo || null,
    origem: 'manual',
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  }).select('*, clientes(nome), obras(nome), vendas_obras(numero)').single()

  if (error) {
    if (cardId) await supabase.from('setor_kanban_itens').delete().eq('id', cardId)
    return { ok: false, error: error.message }
  }
  return { ok: true, ordem: mapOrdem(data) }
}

export async function atualizarOrdemProducao(id: string, patch: Partial<Pick<OrdemProducao,
  'status' | 'bloqueada' | 'bloqueio_motivo' | 'titulo' | 'quantidade' | 'largura_mm' | 'altura_mm' | 'obra_id' | 'cliente_id' | 'venda_obra_id'
>>): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('ordens_producao').update(patch).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
