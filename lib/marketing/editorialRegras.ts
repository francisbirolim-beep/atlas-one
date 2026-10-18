export type CanalEditorial = 'instagram' | 'facebook' | 'tiktok' | 'google'
export type RascunhoEditorial = {
  titulo: string
  legenda: string
  canal: CanalEditorial
  data_planejada: string
}
const CANAIS = new Set<CanalEditorial>(['instagram','facebook','tiktok','google'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ehUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
export function revisaoValida(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 2147483646
}
export function dataEditorialValida(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [ano, mes, dia] = value.split('-').map(Number)
  const date = new Date(Date.UTC(ano, mes-1, dia))
  return date.getUTCFullYear() === ano && date.getUTCMonth() === mes-1 && date.getUTCDate() === dia
}
export function validarEditorial(payload: unknown): RascunhoEditorial | null {
  if (!payload || typeof payload !== 'object') return null
  const v = payload as Record<string, unknown>
  if (typeof v.titulo !== 'string' || !v.titulo.trim() || v.titulo.trim().length > 240) return null
  if (typeof v.legenda !== 'string' || v.legenda.length > 4000) return null
  if (typeof v.canal !== 'string' || !CANAIS.has(v.canal as CanalEditorial)) return null
  if (!dataEditorialValida(v.data_planejada)) return null
  return { titulo: v.titulo.trim(), legenda: v.legenda, canal: v.canal as CanalEditorial, data_planejada: v.data_planejada as string }
}
