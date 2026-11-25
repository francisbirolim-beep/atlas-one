export const LIMITE_ATLAS_CHAT = 50 * 1024 * 1024
const formatos: Record<string,string> = {
 jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',
 mp4:'video/mp4',mov:'video/quicktime',webm:'audio/webm',m4a:'audio/mp4',mp3:'audio/mpeg',ogg:'audio/ogg',opus:'audio/opus',aac:'audio/aac',
 pdf:'application/pdf',txt:'text/plain',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
const permitidos=new Set(Object.values(formatos))
export function mimeAtlasChat(nome:string,mime:string){
 const tipo=mime.split(';')[0].trim().toLowerCase()
 if(permitidos.has(tipo))return tipo
 if(tipo && tipo!=='application/octet-stream')return ''
 return formatos[nome.split('.').pop()?.toLowerCase()||'']||''
}
export function tamanhoAtlasChat(bytes:number){return Number.isSafeInteger(bytes)&&bytes>0&&bytes<=LIMITE_ATLAS_CHAT}
export function caminhoAtlasChat(path:string,empresa:string,conversa:string){
 const p=path.split('/')
 return p.length===5&&p[0]===empresa&&p[1]==='saida'&&/^\d{4}-\d{2}$/.test(p[2])&&p[3]===conversa&&/^[a-f0-9-]{36}-[a-zA-Z0-9._-]+$/.test(p[4])&&!p.includes('..')
}
export function formatoGravacao(mime:string){
 const tipo=mime.split(';')[0].toLowerCase()
 const extensao=Object.keys(formatos).find(k=>formatos[k]===tipo&&tipo.startsWith('audio/'))
 return extensao?{tipo,extensao}:null
}
