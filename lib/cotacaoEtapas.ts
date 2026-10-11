// Etapas administrativas, independentes de entrada fiscal e de estoque.
export const ETAPAS_COTACAO = ['necessidade','cotacao','comprado','entrega','recebido'] as const
export type EtapaCotacao = typeof ETAPAS_COTACAO[number]
export type ItemEtapaCotacao = {material_id:string;status_etapa?:string|null;quantidade_cotar?:number;[key:string]:unknown}
export type LoteEtapas = {status:string;itens:ItemEtapaCotacao[]}
export function etapaItemCotacao(lote:LoteEtapas,item:ItemEtapaCotacao):EtapaCotacao{
 const atual=item.status_etapa||lote.status
 return (ETAPAS_COTACAO as readonly string[]).includes(atual)?atual as EtapaCotacao:'necessidade'
}
export function itensEmEtapa<T extends ItemEtapaCotacao>(lote:{status:string;itens:T[]},etapa:EtapaCotacao):T[]{
 return lote.itens.filter(item=>etapaItemCotacao(lote,item)===etapa)
}
export function progressoLotesCotacao(lotes:LoteEtapas[]){
 const itens=lotes.flatMap(lote=>lote.itens.map(item=>etapaItemCotacao(lote,item)))
 const comprados=itens.filter(etapa=>['comprado','entrega','recebido'].includes(etapa)).length
 const recebidos=itens.filter(etapa=>etapa==='recebido').length
 return {total:itens.length,comprados,recebidos,percentualComprado:itens.length?100*comprados/itens.length:0,percentualRecebido:itens.length?100*recebidos/itens.length:0}
}
