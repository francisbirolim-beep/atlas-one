/** Regras compartilhadas: originais privados, imagens reais, videos sem executar ou interpretar conteúdo. */
export const LIMITE_MIDIA_MARKETING=30*1024*1024
export const FORMATOS_MIDIA_MARKETING={
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp',
  'video/mp4':'mp4',
  'video/quicktime':'mov',
  'video/webm':'webm',
} as const
export type MimeMarketing=keyof typeof FORMATOS_MIDIA_MARKETING
export function formatoPermitido(value:unknown):value is MimeMarketing {
  return typeof value==='string' && Object.prototype.hasOwnProperty.call(FORMATOS_MIDIA_MARKETING,value)
}
export function conteudoMidiaValido(mime:MimeMarketing,bin:Uint8Array):boolean {
  if(bin.byteLength<12)return false
  const ascii=(inicio:number,fim:number)=>String.fromCharCode(...bin.subarray(inicio,fim))
  if(mime==='image/jpeg')return bin[0]===0xff&&bin[1]===0xd8&&bin[2]===0xff
  if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((b,i)=>bin[i]===b)
  if(mime==='image/webp')return ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP'
  if(mime==='video/webm')return [0x1a,0x45,0xdf,0xa3].every((b,i)=>bin[i]===b)
  if(mime==='video/mp4')return ascii(4,8)==='ftyp' && ascii(8,12)!=='qt  '
  if(mime==='video/quicktime')return ascii(4,8)==='ftyp' && ascii(8,12)==='qt  '
  return false
}
export function nomeMidiaValido(value:unknown):value is string {
  return typeof value==='string' && !!value.trim() && value.trim().length<=240
}
export function evidenciaDireitosValida(value:unknown):value is string {
  return typeof value==='string' && value.trim().length>=12 && value.trim().length<=2000
}
