export type ItemReciboRecebimento = {
  id: string
  data: string
  valor: number
  forma: string | null
  desconto?: number
  referencia?: string | null
  obra?: string | null
  cartaoParcelas?: number | null
  formas?: Array<{forma: string; valor: number; parcelas?: number | null}>
}

export function somarRecebimentos(itens: ReadonlyArray<{valor:number}>) {
  // Somar em centavos evita diferenças de representação binária nos totais do recibo.
  return itens.reduce((total,item)=>total+Math.round(Number(item.valor)*100),0)/100
}

export function descricaoFormaRecibo(forma: string | null | undefined, parcelas?: number | null) {
  const rotulos: Record<string, string> = {
    pix: 'PIX', dinheiro: 'Dinheiro', boleto: 'Boleto',
    cartao: 'Cartão (modalidade não informada)', cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito', transferencia: 'Transferência',
    cheque: 'Cheque', multiplo: 'Múltiplas formas',
  }
  const rotulo = rotulos[forma || ''] || forma || 'Não informada'
  return forma === 'cartao_credito' && parcelas && parcelas > 0 ? `${rotulo} · ${parcelas}x` : rotulo
}

export type ReciboInfo={
  tipo:'pagar'|'receber';nome:string;documento?:string|null;obra?:string|null;
  referencia?:string|null;descricao?:string|null;data:string;forma?:string|null;
  valorOriginal:number;valorMovimento:number;saldo:number;id:string;assinaturaDataUri?:string|null
  consolidado?: boolean
  itens?: ItemReciboRecebimento[]

}
export function textoRecibo(d:ReciboInfo){
 const moeda=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
 const data=(s:string)=>s?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:'—'
 return {movimento:moeda(d.valorMovimento),original:moeda(d.valorOriginal),saldo:moeda(d.saldo),data:data(d.data)}
}
