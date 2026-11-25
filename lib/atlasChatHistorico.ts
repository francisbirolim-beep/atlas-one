export type OcultacaoAtlas={conversa_id:string;mensagem_id:string|null;ocultado_em:string}
export function conversaVisivelAtlas(c:{id:string;ultima_mensagem_em?:string|null},h:readonly OcultacaoAtlas[]){
 return !h.some(o=>o.conversa_id===c.id&&!o.mensagem_id&&(!c.ultima_mensagem_em||Date.parse(c.ultima_mensagem_em)<=Date.parse(o.ocultado_em)))
}
export function mensagemVisivelAtlas(m:{id:string;conversa_id?:string;created_at?:string|null},h:readonly OcultacaoAtlas[],conversaSelecionada?:string){
 return !h.some(o=>o.mensagem_id===m.id||(!o.mensagem_id&&(o.conversa_id===m.conversa_id||o.conversa_id===conversaSelecionada)&&!!m.created_at&&Date.parse(m.created_at)<=Date.parse(o.ocultado_em)))
}
