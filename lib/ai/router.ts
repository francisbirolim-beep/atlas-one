import { AIProvider, AIProviderId, AIRequest, AIResponse } from './types'

const providers = new Map<AIProviderId, AIProvider>()

export function registrarAIProvider(provider: AIProvider) {
  providers.set(provider.id, provider)
}

export function listarAIProvidersRegistrados(): AIProviderId[] {
  return Array.from(providers.keys())
}

export async function executarComAI(request: AIRequest): Promise<AIResponse> {
  const registrados = Array.from(providers.keys())
  const ordem: AIProviderId[] = request.provedorPreferido
    ? [request.provedorPreferido, ...registrados.filter(id => id !== request.provedorPreferido)]
    : registrados

  if (ordem.length === 0) {
    throw new Error('Nenhum provedor de IA foi configurado no Atlas.')
  }

  let ultimoErro: unknown = null

  for (const id of ordem) {
    const provider = providers.get(id)
    if (!provider) continue

    try {
      if (!(await provider.disponivel())) continue
      return await provider.executar(request)
    } catch (erro) {
      ultimoErro = erro
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error('Nenhum provedor de IA disponível conseguiu executar a tarefa.')
}

/**
 * Regra arquitetural do Atlas:
 * este router serve para interpretação, classificação, documentos, imagens,
 * assistência, busca, recomendações, conteúdo e linguagem natural.
 * Fórmulas técnicas, lista de corte, folgas, acessórios, vidro, custos,
 * margem, estoque e regras de engenharia pertencem ao Motor Atlas/MEE.
 */
export function tarefaPodeUsarIA(request: AIRequest): boolean {
  return [
    'interpretacao',
    'classificacao',
    'documento',
    'imagem',
    'assistencia',
    'busca',
    'recomendacao',
    'conteudo',
    'linguagem_natural',
  ].includes(request.tarefa)
}
