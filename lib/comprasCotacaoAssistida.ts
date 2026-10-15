export type SimulacaoCompra = {
  necessidadeId: string
  descricao: string
  fornecedorId: string
  quantidadeObra: number
  quantidadeEstoque: number
  precoUnitario: number | null
  unidade: string
}

export type FornecedorMinimo = { id:string; nome:string; pedido_minimo:number|null }

export function subtotalSimulado(itens:SimulacaoCompra[]){
  return itens.reduce((s,i)=>s+
    ((Number(i.quantidadeObra)||0)+(Number(i.quantidadeEstoque)||0))*
    (i.precoUnitario === null ? 0 : Math.max(0,Number(i.precoUnitario)||0)),0)
}
export function calcularPedidoMinimo(
  itens:SimulacaoCompra[], fornecedor:FornecedorMinimo
){
  const selecionados=itens.filter(i=>i.fornecedorId===fornecedor.id)
  const subtotal=subtotalSimulado(selecionados)
  const minimo=Math.max(0,Number(fornecedor.pedido_minimo)||0)
  const semPreco=selecionados.filter(i=>i.precoUnitario===null).length
  return {
    quantidadeItens:selecionados.length,subtotal,minimo,
    falta:Math.max(0,minimo-subtotal),
    atingiuMinimo:selecionados.length>0&&semPreco===0&&subtotal>=minimo,
    semPreco,
  }
}
