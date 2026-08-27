import { supabase } from './supabase'
import { usuarioAtual } from './auth'
import { gerarPacoteTecnico } from './materialPlanejamento'
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
  const [{ data: destino }, { data: card }, usuario] = await Promise.all([
    supabase.from('setor_kanban_colunas').select('nome,setor_id').eq('id', novaColunaId).maybeSingle(),
    supabase.from('setor_kanban_itens').select('orcamento_id').eq('id', id).maybeSingle(),
    usuarioAtual(),
  ])

  const destinoNome = String(destino?.nome || '').toLowerCase()

  // Projeto conferido fecha o checkpoint pré-medição e gera o pacote técnico
  // inicial da obra. Fórmula ainda não validada vira pendência editável: nunca
  // é inventada. Vidros permanecem provisórios até a Medição Final aprovada.
  if (destino?.setor_id === 'engenharia-projeto' && destinoNome === 'projeto conferido') {
    const { error } = await supabase.rpc('fn_concluir_conferencia_projeto_v1', {
      p_card_id: id,
      p_coluna_id: novaColunaId,
      p_usuario_id: usuario?.id || null,
      p_usuario_nome: usuario?.nome || null,
    })
    if (error) {
      console.error('Erro ao concluir conferência do projeto:', error)
      return false
    }

    const orcamentoId = card?.orcamento_id ? String(card.orcamento_id) : ''
    if (orcamentoId) {
      const { data: existente } = await supabase
        .from('pacotes_tecnicos')
        .select('id')
        .eq('orcamento_id', orcamentoId)
        .eq('origem', 'projeto_conferido')
        .neq('status', 'substituido')
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!existente) {
        const pacote = await gerarPacoteTecnico(orcamentoId, 'projeto_conferido', usuario, {
          perdaCorteMm: 0,
          minimoSobraReaproveitavelMm: 300,
        })
        if (!pacote.ok) console.warn('Projeto conferido, mas o pacote técnico ficou pendente:', pacote.error)
      }
    }
    return true
  }

  if (destinoNome.includes('liberad') && destinoNome.includes('produ')) {
    const { error } = await supabase.rpc('fn_engenharia_liberar_para_producao', {
      p_card_id: id,
      p_coluna_id: novaColunaId,
      p_usuario_id: usuario?.id || null,
      p_usuario_nome: usuario?.nome || null,
    })
    if (error) console.error('Erro ao liberar Engenharia para Producao:', error)
    return !error
  }

  const { error } = await supabase.from('setor_kanban_itens').update({
    coluna_id: novaColunaId,
    atualizado_em: new Date().toISOString(),
    atualizado_por_id: usuario?.id || null,
    atualizado_por_nome: usuario?.nome || null,
  }).eq('id', id)
  return !error
}

export async function editarItemSetor(id: string, campos: { titulo?: string; descricao?: string | null; coluna_id?: string }): Promise<boolean> {
  const usuario = await usuarioAtual()
  const { error } = await supabase.from('setor_kanban_itens').update({
    ...campos,
    atualizado_em: new Date().toISOString(),
    atualizado_por_id: usuario?.id || null,
    atualizado_por_nome: usuario?.nome || null,
  }).eq('id', id)
  return !error
}

export async function excluirItemSetor(id: string): Promise<boolean> {
  const { error } = await supabase.from('setor_kanban_itens').delete().eq('id', id)
  return !error
}
