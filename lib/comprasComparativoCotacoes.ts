// O menor preço só é comparável entre propostas completas com frete conhecido.
export type ItemCotado={item_id:string;quantidade:number;preco_unitario:number;unidade?:string}
export type ItemSolicitado={id:string;quantidade_necessaria:number|null;unidade:string;descricao:string}
export type CondicoesCotacao={
 frete:number|null;desconto:number;prazo_dias:number|null;
 forma_pagamento:string|null;validade:string|null
}
export function calcularComparativo(itens:ItemCotado[], solicitados:ItemSolicitado[], c:CondicoesCotacao) {
 const porId=new Map(itens.map(i=>[i.item_id,i]))
 const faltando=solicitados.filter(s=>!porId.has(s.id)).map(s=>s.id)
 const quantidadeDivergente=solicitados.filter(s=>{
   const i=porId.get(s.id)
   return !!i&&s.quantidade_necessaria!=null&&Math.abs(i.quantidade-s.quantidade_necessaria)>0.000001
 }).map(s=>s.id)
 const subtotal=Math.round(itens.reduce((a,i)=>a+i.quantidade*i.preco_unitario,0)*100)/100
 const total=c.frete==null?null:Math.round((subtotal+c.frete-c.desconto)*100)/100
 const completa=solicitados.length>0&&!faltando.length&&!quantidadeDivergente.length&&
   c.frete!=null&&total!=null&&total>=0
 return {subtotal,total,completa,faltando,quantidadeDivergente,
  custoComparavel:completa?total:null,
  descricao:completa?'Proposta comparável':faltando.length?'Faltam itens':
    quantidadeDivergente.length?'Quantidades divergentes':'Informe o frete'}
}
