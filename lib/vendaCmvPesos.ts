// Compara compra e recebimento sem tocar no CMV comprado nem no custo W.Vetro.
export type CompraPeso={categoria:string;origem:string;quantidade?:number|null;unidade?:string|null;valor:number}
export type RecebimentoPeso={categoria:string;peso_kg:number;preco_kg:number;valor_total:number;cancelado_em?:string|null}
const centavos=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
export function compararPesosCmv(categoria:string,compras:readonly CompraPeso[],recebimentos:readonly RecebimentoPeso[],valorComprado:number,valorExterno=0){
 const relevantes=compras.filter(c=>c.categoria===categoria&&c.origem==='compra')
 const semPeso=relevantes.some(c=>!(Number(c.quantidade)>0&&String(c.unidade).trim().toUpperCase()==='KG'))
 const pesoComprado=relevantes.reduce((s,c)=>s+(String(c.unidade).trim().toUpperCase()==='KG'?Number(c.quantidade)||0:0),0)
 const recebidos=recebimentos.filter(r=>r.categoria===categoria&&!r.cancelado_em)
 const pesoRecebido=recebidos.reduce((s,r)=>s+Number(r.peso_kg||0),0)
 const valorRecebido=centavos(recebidos.reduce((s,r)=>s+Number(r.valor_total||0),0))
 const pesoConferivel=!semPeso&&valorExterno===0&&pesoComprado>0
 const diferencaKg=pesoConferivel?pesoRecebido-pesoComprado:null
 const percentualKg=pesoConferivel?100*(pesoRecebido-pesoComprado)/pesoComprado:null
 return {pesoComprado,pesoRecebido,valorComprado,valorRecebido,temRecebimento:recebidos.length>0,
  diferencaKg,percentualKg,pesoConferivel,diferencaCompraRecebido:recebidos.length?centavos(valorRecebido-valorComprado):null,
  faltaPesoComprado:semPeso||valorExterno>0,quantidadeRecebimentos:recebidos.length}
}
