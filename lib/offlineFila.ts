// Fila de pedidos criados sem internet. Fica salva no IndexedDB do
// aparelho (funciona mesmo trocando de tela) ate conseguir conexao
// pra enviar de verdade pro Supabase.

const DB_NOME = 'atlas-one-offline'
const DB_VERSAO = 1
const STORE = 'pendentes'

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nao disponivel'))
      return
    }
    const pedido = indexedDB.open(DB_NOME, DB_VERSAO)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

export interface PendenteOrcamento {
  id: string
  tipo: 'orcamento'
  criadoEm: string
  dados: any
}

export interface PendenteAssistencia {
  id: string
  tipo: 'assistencia'
  criadoEm: string
  dados: any
}

export type Pendente = PendenteOrcamento | PendenteAssistencia

export async function salvarPendente(item: Pendente): Promise<void> {
  // Se o pedido/assistência nasceu dentro de uma obra do Cliente 360,
  // preserva esse contexto também quando o envio ficar para depois.
  // Assim a sincronização offline não perde o vínculo ao trocar de tela.
  const obraId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('obra')
    : null
  const itemComContexto: Pendente = obraId && !item.dados?.obraId
    ? { ...item, dados: { ...item.dados, obraId } }
    : item

  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(itemComContexto)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listarPendentes(): Promise<Pendente[]> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const pedido = tx.objectStore(STORE).getAll()
    pedido.onsuccess = () => resolve((pedido.result as Pendente[]) || [])
    pedido.onerror = () => reject(pedido.error)
  })
}

export async function removerPendente(id: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function contarPendentes(): Promise<number> {
  try {
    const itens = await listarPendentes()
    return itens.length
  } catch {
    return 0
  }
}
