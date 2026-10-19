import {quantidadeCmvValida, unidadeCmvValida} from './vendaCmvUnidades'

/** Não homologar como peças o que foi gravado antigamente como quilos.
 * Registros antigos de perfis mantêm kg como unidade original de compra.
 */
export type LinhaRecebimentoConferencia={
 categoria:string
 unidade?:string|null
 quantidade?:number|null
 peso_kg?:number|null
 preco_unitario?:number|null
 preco_kg?:number|null
 cancelado_em?:string|null
}
export function recebimentoConferivelCmv(r:LinhaRecebimentoConferencia):boolean {
 if(r.cancelado_em) return false
 const u=String(r.unidade||'').trim().toUpperCase()
 if(!u){
  return r.categoria==='perfil'&&Number(r.peso_kg)>0&&Number(r.preco_kg)>0
 }
 return unidadeCmvValida(u)&&quantidadeCmvValida(r.quantidade==null?null:Number(r.quantidade),u)
  &&Number(r.preco_unitario)>0
}
