// Atlas AI Core - estimativa de custo por chamada
// Ollama e sempre 0 (roda local). Anthropic usa uma tabela aproximada de preco por
// milhao de tokens - os valores abaixo sao um placeholder e devem ser conferidos
// contra a pagina oficial de precos da Anthropic antes de virar referencia financeira real.

interface PrecoModelo {
  inputPor1M: number
  outputPor1M: number
}

const PRECOS_USD: Record<string, PrecoModelo> = {
  'claude-sonnet-5': { inputPor1M: 3, outputPor1M: 15 },
}

export function estimarCustoUSD(
  provider: string,
  modelo: string,
  inputTokens?: number | null,
  outputTokens?: number | null
): number | null {
  if (provider === 'ollama') return 0

  const preco = PRECOS_USD[modelo]
  if (!preco || inputTokens == null || outputTokens == null) return null

  return (inputTokens / 1_000_000) * preco.inputPor1M + (outputTokens / 1_000_000) * preco.outputPor1M
}
