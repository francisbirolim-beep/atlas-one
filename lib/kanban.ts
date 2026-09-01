import { supabase } from './supabase'
import { KanbanColuna } from './tipos'
import { executarAutomacoesColuna } from './automacoes'
import { executarAutomacoesSetor } from './automacoesSetor'

export async function listarColunas(): Promise<KanbanColuna[]> {
  const { data, error } = await supabase
    .from('kanban_colunas')
    .select('*')
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar colunas:', error)
    return []
  }
  return data as KanbanColuna[]
}

export async function primeiraColunaId(): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_colunas')
    .select('id')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.id || null
}

export async function criarColuna(nome: string): Promise<KanbanColuna | null> {
  const { data: colunas } = await supabase
    .from('kanban_colunas')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 1

  const { data, error } = await supabase
    .from('kanban_colunas')
    .insert({ nome, ordem: proximaOrdem })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar coluna:', error)
    return null
  }
  return data as KanbanColuna
}

export async function renomearColuna(id: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from('kanban_colunas').update({ nome }).eq('id', id)
  return !error
}

export async function excluirColuna(id: string, colunaDestinoId: string): Promise<boolean> {
  const { error: moveError } = await supabase
    .from('orcamentos')
    .update({ coluna_id: colunaDestinoId })
    .eq('coluna_id', id)

  if (moveError) {
    console.error('Erro ao mover cards antes de excluir coluna:', moveError)
    return false
  }

  const { error } = await supabase.from('kanban_colunas').delete().eq('id', id)
  return !error
}

export async function moverCard(
  orcamentoId: string,
  colunaId: string,
  decisoesAutomacaoSetor?: Record<string, 'substituir' | 'duplicar'>
): Promise<boolean> {
  // A coluna marcada com gera_medicao_final é o gatilho visual de "Vendido".
  // Ela NÃO pode ser persistida antes da confirmação da venda, senão o card
  // fica parecendo vendido sem existir venda, conta a receber ou projeto.
  const { data: colunaDestino, error: erroColuna } = await supabase
    .from('kanban_colunas')
    .select('gera_medicao_final')
    .eq('id', colunaId)
    .maybeSingle()

  if (erroColuna) {
    console.error('Erro ao verificar configuracao da coluna:', erroColuna)
    return false
  }

  if (colunaDestino?.gera_medicao_final) {
    if (typeof window !== 'undefined') {
      window.location.assign(`/vendas/confirmar?orcamento=${encodeURIComponent(orcamentoId)}`)
    }
    return true
  }

  const { data, error } = await supabase
    .from('orcamentos')
    .update({ coluna_id: colunaId, coluna_atualizada_em: new Date().toISOString() })
    .eq('id', orcamentoId)
    .select('cliente_nome, criado_por_id')
    .single()

  if (error) return false

  executarAutomacoesColuna(colunaId, {
    cliente_nome: data?.cliente_nome || null,
    criado_por_id: data?.criado_por_id || null,
  }).catch(() => {})
  executarAutomacoesSetor(colunaId, orcamentoId, decisoesAutomacaoSetor).catch(() => {})

  return true
}

export async function atualizarSlaColuna(
  id: string,
  slaAmarelo: number | null,
  slaVermelho: number | null
): Promise<boolean> {
  const { error } = await supabase
    .from('kanban_colunas')
    .update({ sla_amarelo_horas: slaAmarelo, sla_vermelho_horas: slaVermelho })
    .eq('id', id)
  return !error
}

export async function excluirOrcamento(id: string): Promise<boolean> {
  await supabase.from('historico').delete().eq('orcamento_id', id)
  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  return !error
}

export async function atualizarCoresColuna(
  id: string,
  corCards: string | null,
  slaAmareloCor: string | null,
  slaVermelhoCor: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('kanban_colunas')
    .update({
      cor_cards: corCards,
      sla_amarelo_cor: slaAmareloCor,
      sla_vermelho_cor: slaVermelhoCor,
    })
    .eq('id', id)
  return !error
}
