export function destinoEntradaWhatsApp(chat:boolean,central:boolean){
 return chat&&central?'escolher':chat?'chat':central?'central':'bloqueado'
}
// Ausência de configuração preserva a entrada anterior. Não concede novas
// permissões de canal; as verificações legadas continuam obrigatórias.
export function centralPermitida(valor:boolean|null|undefined){
 return valor!==false
}

export function permissoesEntradaAtlas(row:{habilitado:boolean;central_habilitado?:boolean|null}|null|undefined,chatPadrao=false){
 return {chat:row?row.habilitado===true:chatPadrao,central:centralPermitida(row?.central_habilitado)}
}
