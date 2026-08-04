// Atlas AI Core - registro de uso/auditoria das chamadas de IA
// Nunca deve quebrar o fluxo principal: qualquer erro aqui e apenas ignorado.

import { supabaseAdmin } from '../supabaseAdmin'

export async function registrarUsoIA(params: {
  agenteId: string | null
  usuarioId: string
  usuarioNome?: string
  provider: string
  modelo: string
  passos?: number
  sucesso?: boolean
  erro?: string
}) {
  try {
    await supabaseAdmin.from('ia_uso_log').insert({
      agente_id: params.agenteId,
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome || null,
      provider: params.provider,
      modelo: params.modelo,
      passos: params.passos ?? null,
      sucesso: params.sucesso ?? true,
      erro: params.erro || null,
    })
  } catch {
    // auditoria nunca deve derrubar o agente
  }
}
