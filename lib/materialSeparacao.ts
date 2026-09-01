import { supabase } from './supabase'
import type { SeparacaoPacote } from './materialPlanejamento'

export type SaldoPerfilEstoque = {
  id: string
  produto_id: string
  local_id: string
  endereco_id?: string | null
  quantidade: number
  quantidade_reservada: number
  disponivel: number
  custo_medio?: number | null
  produto?: { id: string; codigo?: string | null; nome: string; tamanho_barra_mm?: number | null } | null
  local?: { id: string; nome: string } | null
  endereco?: { id: string; codigo?: string | null; nome?: string | null } | null
}

export async function listarSaldosPerfis(produtoIds: string[]): Promise<SaldoPerfilEstoque[]> {
  if (!produtoIds.length) return []
  const { data } = await supabase
    .from('estoque_saldos')
    .select('id,produto_id,local_id,endereco_id,quantidade,quantidade_reservada,custo_medio,produtos(id,codigo,nome,tamanho_barra_mm),estoque_locais(id,nome),estoque_enderecos(id,codigo,nome)')
    .in('produto_id', produtoIds)
    .gt('quantidade', 0)
    .order('produto_id')

  return (data || []).map((row: any) => ({
    id: row.id,
    produto_id: row.produto_id,
    local_id: row.local_id,
    endereco_id: row.endereco_id,
    quantidade: Number(row.quantidade || 0),
    quantidade_reservada: Number(row.quantidade_reservada || 0),
    disponivel: Math.max(0, Number(row.quantidade || 0) - Number(row.quantidade_reservada || 0)),
    custo_medio: row.custo_medio == null ? null : Number(row.custo_medio),
    produto: row.produtos || null,
    local: row.estoque_locais || null,
    endereco: row.estoque_enderecos || null,
  })) as SaldoPerfilEstoque[]
}

export async function cancelarSeparacaoMaterial(separacao: SeparacaoPacote) {
  if (separacao.status === 'cancelado') return { ok: true }

  if (separacao.estoque_reserva_id) {
    const { error } = await supabase.from('estoque_reservas').update({ status: 'cancelada' }).eq('id', separacao.estoque_reserva_id)
    if (error) return { ok: false, error: error.message }
  }

  if (separacao.sobra_estoque_id) {
    const { error } = await supabase.from('estoque_sobras_perfis').update({
      status: 'disponivel',
      pacote_reserva_id: null,
      obra_reserva_id: null,
      reservado_por_id: null,
      reservado_por_nome: null,
      reservado_em: null,
    }).eq('id', separacao.sobra_estoque_id).eq('pacote_reserva_id', separacao.pacote_id)
    if (error) return { ok: false, error: error.message }
  }

  const { error } = await supabase.from('pacote_tecnico_separacoes').update({ status: 'cancelado' }).eq('id', separacao.id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function listarProdutosParaMaterial() {
  const { data } = await supabase
    .from('produtos')
    .select('id,codigo,nome,categoria,unidade,tamanho_barra_mm')
    .eq('ativo', true)
    .in('categoria', ['perfil', 'acessorio', 'outro'])
    .order('categoria')
    .order('nome')
  return data || []
}
