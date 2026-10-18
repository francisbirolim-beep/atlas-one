
/**
 * Rascunhos locais de homologação do Marketing Inteligente.
 * Sem envio ao Atlas, ao site público, a terceiros ou a redes sociais.
 * Os blobs ficam no IndexedDB deste navegador/dispositivo e os metadados
 * ficam separados por usuário no localStorage. Não usar como banco definitivo.
 */
export type CanalMarketing = 'Instagram' | 'Facebook' | 'TikTok' | 'Google'
export type StatusPostMarketing = 'rascunho' | 'aprovado'
export type MidiaLocal = {
  id: string
  nome: string
  tipo: string
  tamanho: number
  criadoEm: string
  obra: string
  autorizado: boolean
}
export type PostLocal = {
  id: string
  titulo: string
  legenda: string
  canal: CanalMarketing
  data: string
  midiaId: string
  status: StatusPostMarketing
}
export type ConfigLocal = { whatsapp: string; cidade: string; chamada: string }
export type RascunhoMarketing = {
  midias: MidiaLocal[]
  posts: PostLocal[]
  config: ConfigLocal
  campanhaPausada: boolean
}
export const MAX_ARQUIVO = 30 * 1024 * 1024
const PREFIXO = 'atlas:marketing-inteligente:rascunho:v1:'
const BANCO = 'atlas-marketing-previa-local-v1'
const LOJA = 'arquivos'

export function estadoInicialMarketing(): RascunhoMarketing {
  return {
    midias: [], posts: [],
    config: {
      whatsapp: '',
      cidade: 'José Bonifácio e região',
      chamada: 'Soluções em alumínio que transformam ambientes',
    },
    campanhaPausada: true,
  }
}
export function carregarRascunhoMarketing(usuarioId: string): RascunhoMarketing {
  const fallback = estadoInicialMarketing()
  try {
    const bruto = localStorage.getItem(PREFIXO + usuarioId)
    if (!bruto) return fallback
    const valor = JSON.parse(bruto) as Partial<RascunhoMarketing>
    return {
      midias: Array.isArray(valor.midias) ? valor.midias : [],
      posts: Array.isArray(valor.posts) ? valor.posts : [],
      config: { ...fallback.config, ...(valor.config || {}) },
      campanhaPausada: true, // sempre voltar em modo seguro
    }
  } catch {
    return fallback
  }
}
export function salvarRascunhoMarketing(usuarioId: string, valor: RascunhoMarketing) {
  localStorage.setItem(PREFIXO + usuarioId, JSON.stringify({
    ...valor, campanhaPausada: true,
  }))
}
function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Armazenamento indisponível')); return }
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Falha ao abrir a biblioteca local'))
  })
}
export async function salvarArquivoLocal(usuarioId: string, id: string, arquivo: File): Promise<void> {
  const banco = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const transacao = banco.transaction(LOJA, 'readwrite')
    transacao.objectStore(LOJA).put(arquivo, usuarioId + ':' + id)
    transacao.oncomplete = () => resolve()
    transacao.onerror = () => reject(transacao.error || new Error('Não foi possível guardar o arquivo'))
  }).finally(() => banco.close())
}
export async function lerArquivoLocal(usuarioId: string, id: string): Promise<Blob | null> {
  const banco = await abrirBanco()
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = banco.transaction(LOJA, 'readonly')
    const req = tx.objectStore(LOJA).get(usuarioId + ':' + id)
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null)
    req.onerror = () => reject(req.error || new Error('Não foi possível ler o arquivo'))
    tx.oncomplete = () => banco.close()
    tx.onerror = () => banco.close()
  })
}
export async function excluirArquivoLocal(usuarioId: string, id: string): Promise<void> {
  const banco = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = banco.transaction(LOJA, 'readwrite')
    tx.objectStore(LOJA).delete(usuarioId + ':' + id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Não foi possível excluir'))
  }).finally(() => banco.close())
}
export function datasDoMes(anoMes: string): string[] {
  const [ano, mes] = anoMes.split('-').map(Number)
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return []
  return Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, idx) =>
    anoMes + '-' + String(idx + 1).padStart(2, '0')
  )
}
export function prepararCalendarioLocal(
  mes: string,
  midias: MidiaLocal[],
  existentes: PostLocal[],
): PostLocal[] {
  const autorizadas = midias.filter(item => item.autorizado)
  if (!autorizadas.length) return existentes
  const canais: CanalMarketing[] = ['Instagram', 'Facebook', 'TikTok', 'Google']
  const datasOcupadas = new Set(existentes.map(item => item.data + '|' + item.canal))
  const novos: PostLocal[] = []
  datasDoMes(mes).forEach((data, dia) => {
    const canal = canais[dia % canais.length]
    if (datasOcupadas.has(data + '|' + canal)) return
    const midia = autorizadas[dia % autorizadas.length]
    novos.push({
      id: crypto.randomUUID(),
      data, canal, midiaId: midia.id, status: 'rascunho',
      titulo: 'Obra Esquadrifácio® — ' + midia.obra,
      legenda: 'Esquadria de alumínio sob medida da Esquadrifácio®. Conheça nossas soluções para sua obra em José Bonifácio e região. Solicite um orçamento.',
    })
  })
  return [...existentes, ...novos].sort((a,b) => a.data.localeCompare(b.data))
}