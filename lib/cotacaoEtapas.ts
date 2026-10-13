// Etapas administrativas, independentes de entrada fiscal e de estoque.
export const ETAPAS_COTACAO = ['necessidade','cotacao','comprado','entrega','recebido'] as const
export type EtapaCotacao = typeof ETAPAS_COTACAO[number]
export type ItemEtapaCotacao = {material_id:string;status_etapa?:string|null;grupo_card_id?:string|null;quantidade_cotar?:number;[key:string]:unknown}
export type LoteEtapas = {status:string;itens:ItemEtapaCotacao[]}
export function etapaItemCotacao(lote:LoteEtapas,item:ItemEtapaCotacao):EtapaCotacao{
 const atual=item.status_etapa||lote.status
 return (ETAPAS_COTACAO as readonly string[]).includes(atual)?atual as EtapaCotacao:'necessidade'
}
export function itensEmEtapa<T extends ItemEtapaCotacao>(lote:{status:string;itens:T[]},etapa:EtapaCotacao):T[]{
 return lote.itens.filter(item=>etapaItemCotacao(lote,item)===etapa)
}
// Grupos persistentes representam compras/entregas independentes dentro da mesma cotação.
// Os registros antigos, sem grupo_card_id, continuam visíveis como um grupo legado.
export function grupoCardCotacao(item:ItemEtapaCotacao):string {
 return typeof item.grupo_card_id==='string'&&item.grupo_card_id.trim()?item.grupo_card_id:'legado'
}
export function gruposItensEmEtapa<T extends ItemEtapaCotacao>(
 lote:{status:string;itens:T[]},etapa:EtapaCotacao
):Array<{id:string;itens:T[]}>{
 const grupos=new Map<string,T[]>()
 for(const item of itensEmEtapa(lote,etapa)){
   const grupo=grupoCardCotacao(item)
   const atual=grupos.get(grupo)||[]
   atual.push(item)
   grupos.set(grupo,atual)
 }
 return Array.from(grupos,([id,itens])=>({id,itens}))
}
// A impressão de um card nunca deve carregar itens de outro grupo ou etapa.
export function itensDoCardCotacao<T extends ItemEtapaCotacao>(
 lote:{status:string;itens:T[]},etapa:EtapaCotacao,grupoId:string
):T[]{
 return gruposItensEmEtapa(lote,etapa).find(grupo=>grupo.id===grupoId)?.itens||[]
}
// O documento geral continua disponível pela URL original, sem estes parâmetros.
export function urlPdfCardCotacao(loteId:string,vendaId:string,etapa:EtapaCotacao,grupoId:string):string{
 const parametros=new URLSearchParams({vendaId,etapaCard:etapa,grupoCardId:grupoId})
 return '/compras/cotacoes/lote/'+encodeURIComponent(loteId)+'?'+parametros.toString()
}
export function progressoLotesCotacao(lotes:LoteEtapas[]){
 const itens=lotes.flatMap(lote=>lote.itens.map(item=>etapaItemCotacao(lote,item)))
 const comprados=itens.filter(etapa=>['comprado','entrega','recebido'].includes(etapa)).length
 const recebidos=itens.filter(etapa=>etapa==='recebido').length
 return {total:itens.length,comprados,recebidos,percentualComprado:itens.length?100*comprados/itens.length:0,percentualRecebido:itens.length?100*recebidos/itens.length:0}
}
