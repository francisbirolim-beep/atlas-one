import { supabase } from './supabase'
import { AutomacaoOrcamento } from './tipos'
import { primeiraColunaTarefaId, criarTarefa } from './tarefas'
import { atribuirTarefa } from './tarefasColaboracao'

export async function listarAutomacoesOrcamento(): Promise<AutomacaoOrcamento[]> {
  const { data, error } = await supabase
    .from('automacoes_orcamento')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar automacoes:', error)
    return []
  }
  return data as AutomacaoOrcamento[]
}

export async function criarAutomacaoOrcamento(
  colunaId: string,
  destinoTipo: 'fixo' | 'solicitante',
  usuarioId: string | null,
  tituloTarefa: string,
  nome?: string
): Promise<AutomacaoOrcamento | null> {
  const { data, error } = await supabase
    .from('automacoes_orcamento')
    .insert({
      coluna_id: colunaId,
      destino_tipo: destinoTipo,
      usuario_id: destinoTipo === 'fixo' ? usuarioId : null,
      titulo_tarefa: tituloTarefa,
      nome: nome || null,
      ativo: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar automacao:', error)
    return null
  }
  return data as AutomacaoOrcamento
}

export async function alternarAtivoAutomacao(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('automacoes_orcamento')
    .update({ ativo })
    .eq('id', id)

  return !error
}

export async function excluirAutomacaoOrcamento(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('automacoes_orcamento')
    .delete()
    .eq('id', id)

  return !error
}

async function criarTarefaAutomaticaCompatibilidade(
  usuarioAlvo: string,
  titulo: string,
  origemOrcamentoId?: string,
) {
  const atribuicao = await atribuirTarefa({
    responsavelId: usuarioAlvo,
    titulo,
    ...(origemOrcamentoId ? { dataHora: new Date().toISOString(), origemOrcamentoId } : {}),
  })
  if (atribuicao.ok) return

  // Janela transitória entre deploy do código e apply da migration: enquanto
  // COLABORACAO_INATIVA, preserva o comportamento legado. Depois da migration
  // a API passa a ser o único caminho cross-user permitido pela RLS.
  if (atribuicao.code === 'COLABORACAO_INATIVA') {
    const colunaTarefaId = await primeiraColunaTarefaId(usuarioAlvo)
    if (colunaTarefaId) await criarTarefa(usuarioAlvo, colunaTarefaId, titulo, undefined, origemOrcamentoId ? new Date().toISOString() : null)
    return
  }
  console.error('Erro ao criar tarefa automática:', atribuicao.error)
}

export async function executarAutomacoesColuna(
  colunaId: string,
  orcamento: { id?: string | null; cliente_nome?: string | null; criado_por_id?: string | null; coluna_nome?: string | null }
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('automacoes_orcamento')
      .select('*')
      .eq('coluna_id', colunaId)
      .eq('ativo', true)

    if (error || !data || data.length === 0) return

    for (const automacao of data as AutomacaoOrcamento[]) {
      const usuarioAlvo =
        automacao.destino_tipo === 'solicitante'
          ? orcamento.criado_por_id || null
          : automacao.usuario_id

      if (!usuarioAlvo) continue

      const cliente = orcamento.cliente_nome || 'cliente'
      const titulo = automacao.titulo_tarefa.replace(/\{cliente\}/g, cliente)
      // Gatilho especializado apenas para "Orçamento feito"; outras automações
      // continuam no fluxo legado, sem mudança de prazos ou duplicação.
      const etapa = String(orcamento.coluna_nome || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const origem = etapa === 'orcamento feito' && automacao.destino_tipo === 'solicitante'
        ? orcamento.id || undefined : undefined
      await criarTarefaAutomaticaCompatibilidade(usuarioAlvo, titulo, origem)
    }
  } catch (e) {
    console.error('Erro ao executar automacoes da coluna:', e)
  }
}
