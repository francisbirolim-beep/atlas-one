export function nomeContatoAtlas(raw:unknown):string|null{
 if(typeof raw!=='string')return null
 const n=raw.trim()
 return n.length>0&&n.length<=120&&!/[\x00-\x1f\x7f]/.test(n)?n:null
}
