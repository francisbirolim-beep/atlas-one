import { listarPendentes, removerPendente } from './offlineFila'
import { criarOrcamentoNoServidor } from './orcamentos'
import { criarAssistenciaNoServidor } from './assistencias'

let sincronizando = false

// Percorre a fila salva no aparelho e tenta enviar cada pedido pendente pro
// Supabase. So roda uma vez por vez (evita duplicar envio se for chamado
// varias vezes seguidas, ex: evento online + intervalo).
export async function sincronizarFilaOffline(): Promise<{ enviados: number; restantes: number }> {
  if (sincronizando) {
    const restantes = (await listarPendentes()).length
    return { enviados: 0, restantes }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const restantes = (await listarPendentes()).length
    return { enviados: 0, restantes }
  }

  sincronizando = true
  let enviados = 0
  try {
    const pendentes = await listarPendentes()
    for (const item of pendentes) {
      try {
        const resultado =
          item.tipo === 'orcamento'
            ? await criarOrcamentoNoServidor(item.dados)
            : await criarAssistenciaNoServidor(item.dados)
        if (resultado.ok) {
          await removerPendente(item.id)
          enviados++
        }
      } catch {
        // Ainda sem internet de verdade ou erro passageiro: mantem na fila
        // e tenta de novo na proxima vez.
      }
    }
  } finally {
    sincronizando = false
  }

  const restantes = (await listarPendentes()).length
  return { enviados, restantes }
}
