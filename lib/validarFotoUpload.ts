/** Identifica formatos de foto permitidos pelo cabeçalho; não confia no nome/MIME enviado. */
export function identificarFotoUpload(bytes: Uint8Array): { mime: string; extensao: string } | null {
  const tem = (assinatura: number[], inicio = 0) =>
    bytes.length >= inicio + assinatura.length && assinatura.every((v, i) => bytes[inicio + i] === v)
  const ascii = (inicio: number, tamanho: number) =>
    String.fromCharCode(...Array.from(bytes.slice(inicio, inicio + tamanho)))
  if (tem([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', extensao: 'jpg' }
  if (tem([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', extensao: 'png' }
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', extensao: 'webp' }
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return { mime: 'image/gif', extensao: 'gif' }
  // Fotos de celulares: somente marcas explícitas de imagem, nunca contêiner genérico de vídeo.
  if (bytes.length >= 16 && ascii(4, 4) === 'ftyp') {
    const tamanho = bytes[0] * 0x1000000 + bytes[1] * 0x10000 + bytes[2] * 0x100 + bytes[3]
    if (tamanho < 16 || tamanho > bytes.length || tamanho % 4 !== 0) return null
    const marca = ascii(8, 4)
    if (['heic', 'heix', 'hevc', 'hevx'].includes(marca)) return { mime: 'image/heic', extensao: 'heic' }
    if (['avif', 'avis'].includes(marca)) return { mime: 'image/avif', extensao: 'avif' }
  }
  return null
}
