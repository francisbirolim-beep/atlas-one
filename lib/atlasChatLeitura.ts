export function estadoConexaoAtlas(c:{gateway_status?:string|null;conexao_pausada?:boolean|null}){
  return c.gateway_status==='connected' && c.conexao_pausada!==true
}
export function caminhoLeituraAtlas(path:string,empresa:string){
  const partes=path.split('/')
  return partes.length>=3 && partes[0]===empresa && ['entrada','saida'].includes(partes[1]) && partes.every(p=>!!p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0'))
}

export type CursorAtlasChat={em:string;id:string}
export function cursorLeituraAtlas(em:string|null,id:string|null):CursorAtlasChat|null{
  if(!em||!id)return null
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(em)||!Number.isFinite(Date.parse(em)))return null
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null
  return {em,id}
}
