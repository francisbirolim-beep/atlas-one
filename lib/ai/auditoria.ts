// Atlas AI Core - registro de uso/auditoria das chamadas de IA
// Nunca deve quebrar o fluxo principal: qualquer erro aqui e apenas ignorado.

import { supabaseAdmin } from '../supabaseAdmin'

// Remove padroes que parecam chaves/segredos/tokens antes de gravar o erro no log.
// Nunca deve vazar API keys, tokens Bearer ou dados pessoais completos.
function sanitizarErro(erro?: string): string | null {
  if (!erro) return null
  let texto = String(erro)
  texto = texto.replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[REDACTED]')
  texto = texto.replace(/Bearer\s+[a-zA-Z0-9_.-]{10,}/gi, 'Bearer [REDACTED]')
  texto = texto.replace(/([a-zA-Z0-9_-]*api[_-]?key[a-zA-Z0-9_-]*\s*[:=]\s*)[^\s,"']{6,}/gi, '$1[REDACTED]')
  texto = texto.replace(/([a-zA-Z0-9_-]*token[a-zA-Z0-9_-]*\s*[:=]\s*)[^\s,"']{6,}/gi, '$1[REDACTED]')
  texto = texto.replace(/([a-zA-Z0-9_-]*password[a-zA-Z0-9_-]*\s*[:=]\s*)[^\s,"']{3,}/gi, '$1[REDACTED]')
  return texto.slice(0, 500)
}

export async function registrarUsoIA(params: {
  agenteId: string | null
  agenteNome?: string
  usuarioId: string
  usuarioNome?: string
  empresa?: string
  setorId?: string | null
  provider: string
  modelo: string
  passos?: number
  sucesso?: boolean
  erro?: string
  tokensEntrada?: number | null
  tokensSaida?: number | null
  custoEstimado?: number | null
  duracaoMs?: number | null
  fallbackPolicy?: string
}) {
  try {
    await supabaseAdmin.from('ia_uso_log').insert({
      agente_id: params.agenteId,
      agente_nome: params.agenteNome || null,
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome || null,
      empresa: params.empresa || null,
      setor_id: params.setorId || null,
      provider: params.provider,
      modelo: params.modelo,
      passos: params.passos ?? null,
      sucesso: params.sucesso ?? true,
      erro: sanitizarErro(params.erro),
      tokens_entrada: params.tokensEntrada ?? null,
      tokens_saida: params.tokensSaida ?? null,
      custo_estimado: params.custoEstimado ?? null,
      duracao_ms: params.duracaoMs ?? null,
      fallback_policy: params.fallbackPolicy || 'configured_provider_only',
    })
  } catch {
    // auditoria nunca deve derrubar o agente
  }
}
