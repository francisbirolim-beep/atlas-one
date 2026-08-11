import { supabase } from './supabase'
import { KanbanColuna } from './tipos'
import { executarAutomacoesColuna } from './automacoes'
import { executarAutomacoesSetor } from './automacoesSetor'
import { criarMedicaoDoOrcamento } from './medicaoFinal'
import { tokenAtual } from './auth'

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
  // Move os cards da coluna que vai ser excluída para outra coluna antes de apagar
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

export async function moverCard(orcamentoId: string, colunaId: string, decisoesAutomacaoSetor?: Record<string, 'substituir' | 'duplicar'>): Promise<boolean> {
  const { data, error } = await supabase
  .from('orcamentos')
  .update({ coluna_id: colunaId, coluna_atualizada_em: new Date().toISOString() })
  .eq('id', orcamentoId)
  .select('cliente_nome, criado_por_id')
  .single()

if (!error) {
  executarAutomacoesColuna(colunaId, {
    cliente_nome: data?.cliente_nome || null,
    criado_por_id: data?.criado_por_id || null,
  }).catch(() => {})
  executarAutomacoesSetor(colunaId, orcamentoId, decisoesAutomacaoSetor).catch(() => {})
  criarMedicaoFinalSeNecessario(colunaId, orcamentoId).catch(() => {})
}

return !error
}

async function criarMedicaoFinalSeNecessario(colunaId: string, orcamentoId: string): Promise<void> {
  const { data: coluna, error: erroColuna } = await supabase
    .from('kanban_colunas')
    .select('gera_medicao_final')
    .eq('id', colunaId)
    .maybeSingle()

  if (erroColuna) {
    console.error('Erro ao verificar gera_medicao_final da coluna:', erroColuna)
    return
  }

  if (!coluna?.gera_medicao_final) return

  const { data: medicaoExistente, error: erroMedicao } = await supabase
    .from('medicoes_finais')
    .select('id')
    .eq('orcamento_id', orcamentoId)
    .limit(1)
    .maybeSingle()

  if (erroMedicao) {
    console.error('Erro ao verificar medicao final existente:', erroMedicao)
    return
  }

  if (medicaoExistente) return

  const medicao = await criarMedicaoDoOrcamento(orcamentoId, null)
  if (!medicao) {
    console.error('Nao foi possivel criar a medicao final automaticamente para o orcamento:', orcamentoId)
    return
  }

  await sincronizarMedicaoFinalComPdf(orcamentoId)
}

async function sincronizarMedicaoFinalComPdf(orcamentoId: string): Promise<void> {
  try {
    const token = await tokenAtual()
    if (!token) return

    const resposta = await fetch('/api/importar-itens-orcamento', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        orcamentoId,
        persistirOrcamento: false,
        substituirMedicao: true,
      }),
    })

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null)
      console.warn('PDF nao sincronizado na medicao final:', erro?.error || resposta.status)
    }
  } catch (erro) {
    console.error('Erro ao sincronizar PDF na medicao final:', erro)
  }
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
