import {createHmac,timingSafeEqual} from 'node:crypto'
export const COOKIE_TESTE_ATLAS='atlas_chat_teste'
export type TesteAtlas={empresa:string;usuario:string;canal:string;conversa:string;telefone:string;exp:number}
export function assinarTesteAtlas(d:TesteAtlas,secret:string){
 if(!secret)throw Error('Autorização de teste indisponível.')
 const b=Buffer.from(JSON.stringify(d)).toString('base64url')
 return b+'.'+createHmac('sha256',secret).update('atlas-chat-teste-v1:'+b).digest('base64url')
}
export function lerTesteAtlas(raw:string,secret:string,scope:Pick<TesteAtlas,'empresa'|'usuario'|'canal'>,now=Date.now()):TesteAtlas|null{
 try{
  if(!secret||!raw||raw.length>2048)return null
  const [b,s,...extra]=raw.split('.')
  if(!b||!s||extra.length)return null
  const a=Buffer.from(s,'base64url'),h=createHmac('sha256',secret).update('atlas-chat-teste-v1:'+b).digest()
  if(a.length!==h.length||!timingSafeEqual(a,h))return null
  const d=JSON.parse(Buffer.from(b,'base64url').toString()) as TesteAtlas
  if(!Number.isFinite(d.exp)||d.exp<=now||d.empresa!==scope.empresa||d.usuario!==scope.usuario||d.canal!==scope.canal||typeof d.conversa!=='string'||!/^55[1-9]\d{9,10}$/.test(d.telefone))return null
  return d
 }catch{return null}
}
