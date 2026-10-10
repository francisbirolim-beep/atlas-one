// Regra contábil para o painel: uma cotação nunca vira CMV realizado.
const estadosCompraConfirmada=new Set(['aprovado','pedido_emitido','aguardando_entrega','recebido','comprado'])
export function custoRealCompraConfirmada(status:string|null|undefined,valorRegistrado:number|null|undefined):number{
  if(!estadosCompraConfirmada.has(String(status||'').trim().toLowerCase()))return 0
  const n=Number(valorRegistrado)
  return Number.isFinite(n)&&n>0?Math.round(n*100)/100:0
}
