import { supabase } from './supabase'

export type WorkflowAcaoTipo = 'criar_card_setor' | 'financeiro_venda' | 'criar_medicao_final' | 'mee_pos_medicao' | 'reservado'
export type WorkflowPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente'

export interface WorkflowAutomacao {
  id: string
  nome: string
  evento_chave: string
  acao_tipo: WorkflowAcaoTipo
  destino_setor_id?: string | null
  destino_coluna_id?: string | null
  responsavel_usuario_id?: string | null
  notificar_responsavel: boolean
  notificar_usuario_ids: string[]
  criar_tarefa: boolean
  prazo_horas?: number | null
  prioridade_tarefa: WorkflowPrioridade
  titulo_tarefa_template?: string | null
  mensagem_template?: string | null
  evitar_duplicidade: boolean
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export interface WorkflowSetor {
  id: string
  nome: string
  grupo: string
  ordem: number
  ativo: boolean
  rota?: string | null
}

export interface WorkflowColuna {
  id: string
  setor_id: string
  nome: string
  ordem: number
}

export interface WorkflowUsuario {
  id: string
  nome: string
  email: string
}

export interface WorkflowExecucaoResumo {
  id: string
  automacao_id: string
  evento_chave: string
  orcamento_id?: string | null
  status: string
  created_at: string
}

export async function carregarConfiguracaoWorkflow() {
  const [automacoesResp, setoresResp, colunasResp, usuariosResp, execucoesResp] = await Promise.all([
    supabase.from('workflow_automacoes').select('*').order('evento_chave').order('ordem'),
    supabase.from('setores').select('id,nome,grupo,ordem,ativo,rota').order('grupo').order('ordem'),
    supabase.from('setor_kanban_colunas').select('id,setor_id,nome,ordem').order('setor_id').order('ordem'),
    supabase.from('usuarios').select('id,nome,email').order('nome'),
    supabase.from('workflow_execucoes').select('id,automacao_id,evento_chave,orcamento_id,status,created_at').order('created_at', { ascending: false }).limit(100),
  ])

  const erro = automacoesResp.error || setoresResp.error || colunasResp.error || usuariosResp.error || execucoesResp.error
  if (erro) throw erro

  return {
    automacoes: (automacoesResp.data || []) as WorkflowAutomacao[],
    setores: (setoresResp.data || []) as WorkflowSetor[],
    colunas: (colunasResp.data || []) as WorkflowColuna[],
    usuarios: (usuariosResp.data || []) as WorkflowUsuario[],
    execucoes: (execucoesResp.data || []) as WorkflowExecucaoResumo[],
  }
}

export async function salvarWorkflowAutomacao(id: string, dados: Partial<WorkflowAutomacao>) {
  const { id: _id, created_at: _created, updated_at: _updated, ...patch } = dados as WorkflowAutomacao
  const { data, error } = await supabase
    .from('workflow_automacoes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as WorkflowAutomacao
}

export async function criarWorkflowAutomacao(dados: Partial<WorkflowAutomacao>) {
  const payload = {
    nome: dados.nome || 'Nova automação',
    evento_chave: dados.evento_chave || 'venda_confirmada',
    acao_tipo: dados.acao_tipo || 'criar_card_setor',
    destino_setor_id: dados.destino_setor_id || null,
    destino_coluna_id: dados.destino_coluna_id || null,
    responsavel_usuario_id: dados.responsavel_usuario_id || null,
    notificar_responsavel: dados.notificar_responsavel ?? true,
    notificar_usuario_ids: dados.notificar_usuario_ids || [],
    criar_tarefa: dados.criar_tarefa ?? false,
    prazo_horas: dados.prazo_horas ?? null,
    prioridade_tarefa: dados.prioridade_tarefa || 'normal',
    titulo_tarefa_template: dados.titulo_tarefa_template || null,
    mensagem_template: dados.mensagem_template || null,
    evitar_duplicidade: dados.evitar_duplicidade ?? true,
    ativo: dados.ativo ?? false,
    ordem: dados.ordem ?? 100,
  }
  const { data, error } = await supabase.from('workflow_automacoes').insert(payload).select('*').single()
  if (error) throw error
  return data as WorkflowAutomacao
}

export async function excluirWorkflowAutomacao(id: string) {
  const { error } = await supabase.from('workflow_automacoes').delete().eq('id', id)
  if (error) throw error
}
