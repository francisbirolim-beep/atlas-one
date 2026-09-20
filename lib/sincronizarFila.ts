import { listarPendentes, removerPendente } from './offlineFila'
import { criarOrcamentoNoServidor } from './orcamentos'
import { criarAssistenciaNoServidor } from './assistencias'
import { salvarMedidaItem } from './medicaoFinal'
import { uploadFotoMedicao } from './upload'
import { salvarFotoMedicaoItem } from './medicaoFoto'

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
        let ok = false
        if (item.tipo === 'orcamento') {
          ok = (await criarOrcamentoNoServidor(item.dados)).ok
        } else if (item.tipo === 'assistencia') {
          ok = (await criarAssistenciaNoServidor(item.dados)).ok
        } else if (item.tipo === 'medicao_final') {
          ok = await salvarMedidaItem(item.dados.itemId, item.dados.medidas, item.dados.usuario)
        } else if (item.tipo === 'medicao_foto') {
          const arquivo = new File([item.dados.arquivo], `medicao-${item.dados.itemId}.jpg`, { type: item.dados.arquivo.type || 'image/jpeg' })
          const url = await uploadFotoMedicao(arquivo)
          ok = !!url && await salvarFotoMedicaoItem(item.dados.itemId, item.dados.campo, url)
        }
        if (ok) {
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
