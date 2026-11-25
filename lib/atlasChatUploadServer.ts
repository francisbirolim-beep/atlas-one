import {createHmac,timingSafeEqual} from 'crypto'
type Upload={usuario:string;empresa:string;conversa:string;path:string;mime:string;bytes:number;nome:string;exp:number}
export function assinarUploadAtlas(u:Upload,secret:string){
 if(!secret)throw Error('Assinatura de mídia não configurada.')
 const body=Buffer.from(JSON.stringify(u)).toString('base64url')
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url')
}
export function validarUploadAtlas(ticket:string,secret:string,expected:Omit<Upload,'exp'>,now=Date.now()){
 try{
  if(!secret||ticket.length>4096)return false
  const [body,signature,...rest]=ticket.split('.')
  if(!body||!signature||rest.length)return false
  const a=Buffer.from(signature,'base64url'),b=createHmac('sha256',secret).update(body).digest()
  if(a.length!==b.length||!timingSafeEqual(a,b))return false
  const data=JSON.parse(Buffer.from(body,'base64url').toString()) as Upload
  return Number.isFinite(data.exp)&&data.exp>=now&&Object.entries(expected).every(([key,value])=>data[key as keyof Upload]===value)
 }catch{return false}
}
