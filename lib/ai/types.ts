export type AIProviderId = 'local' | 'openai' | 'claude' | string

export type AIModulo =
  | 'gestao'
  | 'comercial'
  | 'orcamento'
  | 'medicao_final'
  | 'engenharia'
  | 'compras'
  | 'estoque'
  | 'producao'
  | 'instalacao'
  | 'financeiro'
  | 'marketing'
  | 'rh'
  | 'qualidade'
  | 'pd'

export type AITipoTarefa =
  | 'interpretacao'
  | 'classificacao'
  | 'documento'
  | 'imagem'
  | 'assistencia'
  | 'busca'
  | 'recomendacao'
  | 'conteudo'
  | 'linguagem_natural'

export type AIRequest = {
  modulo: AIModulo
  tarefa: AITipoTarefa
  prompt: string
  usuarioId?: string | null
  contexto?: Record<string, unknown>
  provedorPreferido?: AIProviderId
}

export type AIResponse = {
  texto: string
  provider: AIProviderId
  model?: string
  inputTokens?: number
  outputTokens?: number
  custoEstimado?: number
}

export interface AIProvider {
  id: AIProviderId
  disponivel(): Promise<boolean>
  executar(request: AIRequest): Promise<AIResponse>
}

export type AIUsage = {
  modulo: AIModulo
  tarefa: AITipoTarefa
  usuarioId?: string | null
  provider: AIProviderId
  model?: string
  inputTokens?: number
  outputTokens?: number
  custoEstimado?: number
  criadoEm: string
}
