export type ReciboInfo={
  tipo:'pagar'|'receber';nome:string;documento?:string|null;obra?:string|null;
  referencia?:string|null;descricao?:string|null;data:string;forma?:string|null;
  valorOriginal:number;valorMovimento:number;saldo:number;id:string
}
export function textoRecibo(d:ReciboInfo){
 const moeda=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
 const data=(s:string)=>s?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:'—'
 return {movimento:moeda(d.valorMovimento),original:moeda(d.valorOriginal),saldo:moeda(d.saldo),data:data(d.data)}
}
