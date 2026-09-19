// Persistencia offline do Atlas One.
//
// A fila guarda pedidos prontos para sincronizar. O rascunho guarda o
// levantamento em andamento desde o primeiro preenchimento, para que fechar a
// tela, perder sinal ou falhar o envio nunca obrigue a refazer a visita.

const DB_NOME = 'atlas-one-offline'
const DB_VERSAO = 2
const STORE = 'pendentes'
const STORE_RASCUNHOS = 'rascunhos'

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
      if (!db.objectStoreNames.contains(STORE_RASCUNHOS)) {
        db.createObjectStore(STORE_RASCUNHOS, { keyPath: 'id' })
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

export interface RascunhoOffline<T = any> {
  id: string
  atualizadoEm: string
  dados: T
}

export async function salvarPendente(item: Pendente): Promise<void> {
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

export async function salvarRascunho<T>(id: string, dados: T): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RASCUNHOS, 'readwrite')
    tx.objectStore(STORE_RASCUNHOS).put({
      id,
      atualizadoEm: new Date().toISOString(),
      dados,
    } satisfies RascunhoOffline<T>)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function obterRascunho<T>(id: string): Promise<RascunhoOffline<T> | null> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RASCUNHOS, 'readonly')
    const pedido = tx.objectStore(STORE_RASCUNHOS).get(id)
    pedido.onsuccess = () => resolve((pedido.result as RascunhoOffline<T> | undefined) || null)
    pedido.onerror = () => reject(pedido.error)
  })
}

export async function removerRascunho(id: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RASCUNHOS, 'readwrite')
    tx.objectStore(STORE_RASCUNHOS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
