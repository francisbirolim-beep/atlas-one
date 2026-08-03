import { supabase } from './supabase'
import { ProducaoItem } from './tipos'

export const COLUNA_MEDICAO_FINAL = 'medicao_final'

export async function listarItensProducao(): Promise<ProducaoItem[]> {
  const { data, error } = await supabase
    .from('producao_itens')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar itens de producao:', error)
    return []
  }
  return data as ProducaoItem[]
}

export async function criarItemProducao(
  titulo: string,
  descricao?: string,
  criadoPorId?: string,
  criadoPorNome?: string,
  orcamentoId?: string,
  coluna: string = COLUNA_MEDICAO_FINAL
): Promise<ProducaoItem | null> {
  const { data, error } = await supabase
    .from('producao_itens')
    .insert({
      titulo,
      descricao: descricao || null,
      coluna,
      orcamento_id: orcamentoId || null,
      criado_por_id: criadoPorId || null,
      criado_por_nome: criadoPorNome || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar item de producao:', error)
    return null
  }
  return data as ProducaoItem
}

export async function moverItemProducao(id: string, novaColuna: string): Promise<boolean> {
  const { error } = await supabase
    .from('producao_itens')
    .update({ coluna: novaColuna, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export async function editarItemProducao(
  id: string,
  campos: { titulo?: string; descricao?: string | null }
): Promise<boolean> {
  const { error } = await supabase
    .from('producao_itens')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export async function excluirItemProducao(id: string): Promise<boolean> {
  const { error } = await supabase.from('producao_itens').delete().eq('id', id)
  return !error
}
