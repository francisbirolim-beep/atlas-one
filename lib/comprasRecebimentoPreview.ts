/** Projecoes puras da etapa 2. Nunca alteram o saldo fisico do estoque. */
export type PlanoRecebimento = {
  quantidadeObra:number
  quantidadeEstoque:number
  recebidaObra:number
  recebidaEstoque:number
}
export type ConferenciaRecebimento = {
  fisicamenteRecebida:number
  avariada:number
  fatorConversao:number
  estoqueJaMovimentado:boolean
  jaDistribuidaNestaConferencia:number
}
const valido=(v:number)=>Number.isFinite(v)&&v>=0
const round=(v:number)=>Math.round(v*1000000)/1000000

/**
 * Destino de um lote conferido. Mesmo material pode servir obra + estoque.
 * O movimento fisico e realizado exclusivamente pela RPC atual da NF.
 */
export function simularDistribuicao(
  pedido:PlanoRecebimento, conferencia:ConferenciaRecebimento,
  paraObra:number, paraEstoque:number
){
  const quantidades=[pedido.quantidadeObra,pedido.quantidadeEstoque,pedido.recebidaObra,
    pedido.recebidaEstoque,conferencia.fisicamenteRecebida,conferencia.avariada,
    conferencia.jaDistribuidaNestaConferencia,paraObra,paraEstoque]
  if(!quantidades.every(valido)||!Number.isFinite(conferencia.fatorConversao)||conferencia.fatorConversao<=0){
    return {ok:false,motivo:'Quantidades ou conversao invalidas',fisicoLancadoAgora:0} as const
  }
  if(conferencia.avariada>conferencia.fisicamenteRecebida){
    return {ok:false,motivo:'Avaria maior que quantidade recebida',fisicoLancadoAgora:0} as const
  }
  if(!conferencia.estoqueJaMovimentado){
    return {ok:false,motivo:'Aguardando movimento fisico da NF, sem lancar estoque novamente',fisicoLancadoAgora:0} as const
  }
  const disponivel=round((conferencia.fisicamenteRecebida-conferencia.avariada)*conferencia.fatorConversao-
    conferencia.jaDistribuidaNestaConferencia)
  const faltaObra=round(pedido.quantidadeObra-pedido.recebidaObra)
  const faltaEstoque=round(pedido.quantidadeEstoque-pedido.recebidaEstoque)
  if(disponivel<0||faltaObra<0||faltaEstoque<0){
    return {ok:false,motivo:'Historico de recebimento inconsistente',fisicoLancadoAgora:0} as const
  }
  if(paraObra>faltaObra+0.000001||paraEstoque>faltaEstoque+0.000001){
    return {ok:false,motivo:'Distribuicao excede a quantidade pendente do pedido',fisicoLancadoAgora:0} as const
  }
  if(paraObra+paraEstoque>disponivel+0.000001){
    return {ok:false,motivo:'Distribuicao excede a mercadoria fisicamente conferida',fisicoLancadoAgora:0} as const
  }
  if(paraObra+paraEstoque<=0){
    return {ok:false,motivo:'Informe alguma quantidade para a obra ou estoque',fisicoLancadoAgora:0} as const
  }
  const totalPedido=pedido.quantidadeObra+pedido.quantidadeEstoque
  const totalRecebido=pedido.recebidaObra+pedido.recebidaEstoque+paraObra+paraEstoque
  return {ok:true,motivo:null,fisicoLancadoAgora:0,
    totalPedido,recebido:round(totalRecebido),saldo:round(totalPedido-totalRecebido),
    obraRecebida:round(pedido.recebidaObra+paraObra),estoqueRecebido:round(pedido.recebidaEstoque+paraEstoque),
    status:totalRecebido+0.000001>=totalPedido?'recebido':'recebido_parcial',
    alertaProducao:paraObra>0?'Material da obra recebido. Conferir disponibilidade antes de liberar producao.':null,
    disponivelNaoDistribuido:round(disponivel-paraObra-paraEstoque),
  } as const
}
