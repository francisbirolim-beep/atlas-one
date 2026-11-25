export type AtendenteArroba={usuario_id:string;apelido:string;nome_publico:string;publico:boolean}
export function apelidoArroba(value:unknown):string|null{
 if(typeof value!=='string')return null
 const s=value.trim().replace(/^@/,'').toLowerCase()
 return /^[a-z][a-z0-9_]{1,29}$/.test(s)&&!['central','todos','equipe','admin','master'].includes(s)?s:null
}
export function comandoArroba(text:unknown){
 if(typeof text!=='string'||text.length>10000)return null
 const s=text.trim()
 if(s==='@')return {tipo:'menu' as const}
 const m=/^@([a-z][a-z0-9_]{1,29})(?:[ \t\r\n]+([\s\S]*))?$/i.exec(s)
 if(!m)return null
 const a=m[1].toLowerCase(),mensagem=(m[2]||'').trim()
 if(a==='central')return {tipo:'central' as const,mensagem}
 const apelido=apelidoArroba(a)
 return apelido?{tipo:'usuario' as const,apelido,mensagem}:null
}
export function linkArroba(telefone:string,apelido:string){
 const a=apelidoArroba(apelido)
 if(!a||!/^55[1-9]\d{9,10}$/.test(telefone))return null
 return 'https://wa.me/'+telefone+'?text='+encodeURIComponent('@'+a+' ')
}
export function decidirArroba(text:unknown,atendentes:readonly AtendenteArroba[]){
 const c=comandoArroba(text)
 if(!c)return {tipo:'normal' as const}
 const lista=atendentes.filter(a=>a.publico&&apelidoArroba(a.apelido)===a.apelido)
 if(c.tipo==='menu')return {tipo:'menu' as const,opcoes:lista.map(a=>({apelido:a.apelido,nome:a.nome_publico}))}
 if(c.tipo==='central')return c
 const matches=lista.filter(a=>a.apelido===c.apelido)
 if(matches.length!==1)return {tipo:'indisponivel' as const}
 return {tipo:'usuario' as const,destino:matches[0].usuario_id,mensagem:c.mensagem}
}
