// Atlas AI Core - roteador de providers de IA
// Hoje so o Anthropic esta implementado de verdade. Os demais ficam
// preparados para receber implementacao futura sem mexer no restante do sistema.

import { chamarAnthropic, ParametrosChamadaIA, RespostaProvider } from './providers/anthropic'
import { chamarOllama } from './providers/ollama'

export type ProviderNome = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'openrouter'

export interface RespostaChamadaIA extends RespostaProvider {
  provider: ProviderNome
}

export async function chamarProvider(provider: ProviderNome, params: ParametrosChamadaIA): Promise<RespostaChamadaIA> {
  switch (provider) {
    case 'anthropic': {
      const r = await chamarAnthropic(params)
      return { ...r, provider: 'anthropic' }
    }
    case 'ollama': {
      const r = await chamarOllama(params)
      return { ...r, provider: 'ollama' }
    }
    case 'openai':
    case 'gemini':
    case 'openrouter':
      return { ok: false, erro: `Provider "${provider}" ainda nao esta implementado no Atlas AI Core.`, provider }
    default:
      return { ok: false, erro: `Provider desconhecido: ${provider}`, provider }
  }
}
