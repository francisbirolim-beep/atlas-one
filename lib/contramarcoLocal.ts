import { coordenadasEmTexto } from './enderecoObra'

export type LocalContramarco = {
  nome_obra: string
  endereco: string
  cidade: string
  observacoes: string
  gps: string | null
  updated_at: string | null
}
export type FotoLocalContramarco = { id: string; arquivo_nome: string; url: string | null }
export const LIMITE_FOTO_CONTRAMARCO = 3 * 1024 * 1024
export const TIPOS_FOTO_CONTRAMARCO: Record<string,string> = {
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif',
}
export function validarLocalContramarco(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Informe os dados da obra.')
  const b = body as Record<string, unknown>
  const campo = (chave: string, limite: number) => {
    if (typeof b[chave] !== 'string' || (b[chave] as string).length > limite) throw new Error('Campo inválido: ' + chave)
    return (b[chave] as string).trim()
  }
  const nome_obra = campo('nome_obra',150)
  if (!nome_obra) throw new Error('Informe o nome ou número da obra.')
  const endereco = campo('endereco',300), cidade = campo('cidade',120), observacoes = campo('observacoes',4000)
  const gps = b.gps == null || b.gps === '' ? null : typeof b.gps === 'string' ? coordenadasEmTexto(b.gps) : null
  if (b.gps != null && b.gps !== '' && !gps) throw new Error('GPS inválido. Capture novamente.')
  if (b.updated_at !== null && (typeof b.updated_at !== 'string' || !Number.isFinite(Date.parse(b.updated_at)))) throw new Error('Versão inválida. Atualize a tela.')
  return {nome_obra,endereco,cidade,observacoes,gps,updated_at: b.updated_at as string | null}
}
export function assinaturaFotoContramarco(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 16) return false
  const texto = (a: number,b: number) => String.fromCharCode(...bytes.slice(a,b))
  if (mime === 'image/jpeg') return bytes[0]===255 && bytes[1]===216 && bytes[2]===255
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)
  if (mime === 'image/webp') return texto(0,4)==='RIFF' && texto(8,12)==='WEBP'
  if (mime === 'image/heic' || mime === 'image/heif') return texto(4,8)==='ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(texto(8,Math.min(bytes.length,64)))
  return false
}
