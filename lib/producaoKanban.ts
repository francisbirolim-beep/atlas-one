import { supabase } from './supabase'
import { ProducaoColuna, ProducaoItem } from './tipos'

const COLUNA_PADRAO = 'Medição final'

export async function listarColunasProducao(): Promise<ProducaoColuna[]> {
  const { data, error } = await supabase
    .from('producao_colunas')
    .select('*')
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar colunas de producao:', error)
    return []
  }

  if (data.length === 0) {
    return await criarColunaPadrao()
  }

  return data as ProducaoColuna[]
}

async function criarColunaPadrao(): Promise<ProducaoColuna[]> {
  const { data, error } = await supabase
    .from('producao_colunas')
    .insert({ nome: COLUNA_PADRAO, ordem: 0 })
    .select()

  if (error || !data) {
    console.error('Erro ao criar coluna padrao de producao:', error)
    return []
  }
  return data as ProducaoColuna[]
}

export async function criarColunaProducao(nome: string): Promise<ProducaoColuna | null> {
  const { data: colunas } = await supabase
    .from('producao_colunas')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 0

  const { data, error } = await supabase
    .from('producao_colunas')
    .insert({ nome, ordem: proximaOrdem })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar coluna de producao:', error)
    return null
  }
  return data as ProducaoColuna
}

export async function renomearColunaProducao(id: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from('producao_colunas').update({ nome }).eq('id', id)
  return !error
}

export async function excluirColunaProducao(id: string, colunaDestinoId: string): Promise<boolean> {
  const { error: moveError } = await supabase
    .from('producao_itens')
    .update({ coluna_id: colunaDestinoId })
    .eq('coluna_id', id)

  if (moveError) {
    console.error('Erro ao mover cards antes de excluir coluna:', moveError)
    return false
  }

  const { error } = await supabase.from('producao_colunas').delete().eq('id', id)
  return !error
}

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
  colunaId: string,
  titulo: string,
  descricao?: string,
  criadoPorId?: string,
  criadoPorNome?: string,
  orcamentoId?: string
): Promise<ProducaoItem | null> {
  const { data, error } = await supabase
    .from('producao_itens')
    .insert({
      titulo,
      descricao: descricao || null,
      coluna_id: colunaId,
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

export async function moverItemProducao(id: string, novaColunaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('producao_itens')
    .update({ coluna_id: novaColunaId, atualizado_em: new Date().toISOString() })
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
