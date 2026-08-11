import { supabase } from './supabase'
import { SetorKanbanColuna, SetorKanbanItem } from './tipos'

const COLUNA_PADRAO = 'A Fazer'

export async function listarColunasSetor(setorId: string): Promise<SetorKanbanColuna[]> {
  const { data, error } = await supabase.from('setor_kanban_colunas').select('*').eq('setor_id', setorId).order('ordem', { ascending: true })
  if (error || !data) return []
  if (data.length === 0) return criarColunaPadraoSetor(setorId)
  return data as SetorKanbanColuna[]
}

async function criarColunaPadraoSetor(setorId: string): Promise<SetorKanbanColuna[]> {
  const { data, error } = await supabase.from('setor_kanban_colunas').insert({ setor_id: setorId, nome: COLUNA_PADRAO, ordem: 0 }).select()
  if (error || !data) return []
  return data as SetorKanbanColuna[]
}

export async function criarColunaSetor(setorId: string, nome: string): Promise<SetorKanbanColuna | null> {
  const { data: colunas } = await supabase.from('setor_kanban_colunas').select('ordem').eq('setor_id', setorId).order('ordem', { ascending: false }).limit(1)
  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 0
  const { data, error } = await supabase.from('setor_kanban_colunas').insert({ setor_id: setorId, nome, ordem: proximaOrdem }).select().single()
  if (error) return null
  return data as SetorKanbanColuna
}

export async function renomearColunaSetor(id: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from('setor_kanban_colunas').update({ nome }).eq('id', id)
  return !error
}

export async function excluirColunaSetor(id: string, colunaDestinoId: string): Promise<boolean> {
  const { error: moveError } = await supabase.from('setor_kanban_itens').update({ coluna_id: colunaDestinoId }).eq('coluna_id', id)
  if (moveError) return false
  const { error } = await supabase.from('setor_kanban_colunas').delete().eq('id', id)
  return !error
}

export async function listarItensSetor(setorId: string): Promise<SetorKanbanItem[]> {
  const { data: colunas, error: errColunas } = await supabase.from('setor_kanban_colunas').select('id').eq('setor_id', setorId)
  if (errColunas || !colunas?.length) return []
  const { data, error } = await supabase.from('setor_kanban_itens').select('*').in('coluna_id', colunas.map((c: { id: string }) => c.id)).order('created_at', { ascending: true })
  if (error || !data) return []
  return data as SetorKanbanItem[]
}

export async function criarItemSetor(colunaId: string, titulo: string, descricao?: string, criadoPorId?: string, criadoPorNome?: string, orcamentoId?: string): Promise<SetorKanbanItem | null> {
  const { data, error } = await supabase.from('setor_kanban_itens').insert({ titulo, descricao: descricao || null, coluna_id: colunaId, criado_por_id: criadoPorId || null, criado_por_nome: criadoPorNome || null, orcamento_id: orcamentoId || null }).select().single()
  if (error) return null
  return data as SetorKanbanItem
}

export async function moverItemSetor(id: string, novaColunaId: string): Promise<boolean> {
  const { data: destino } = await supabase.from('setor_kanban_colunas').select('nome').eq('id', novaColunaId).maybeSingle()
  if (destino?.nome?.toLowerCase().includes('liberad') && destino.nome.toLowerCase().includes('produ')) {
    const { usuarioAtual } = await import('./auth')
    const usuario = await usuarioAtual()
    const { error } = await supabase.rpc('fn_engenharia_liberar_para_producao', {
      p_card_id: id,
      p_coluna_id: novaColunaId,
      p_usuario_id: usuario?.id || null,
      p_usuario_nome: usuario?.nome || null,
    })
    if (error) console.error('Erro ao liberar Engenharia para Producao:', error)
    return !error
  }

  const { error } = await supabase.from('setor_kanban_itens').update({ coluna_id: novaColunaId, atualizado_em: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function editarItemSetor(id: string, campos: { titulo?: string; descricao?: string | null; coluna_id?: string }): Promise<boolean> {
  const { error } = await supabase.from('setor_kanban_itens').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function excluirItemSetor(id: string): Promise<boolean> {
  const { error } = await supabase.from('setor_kanban_itens').delete().eq('id', id)
  return !error
}
