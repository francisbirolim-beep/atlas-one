/**
 * Regras puras e compartilhadas das condições de pagamento do orçamento.
 * Apenas simulação: nenhum pagamento, crédito ou desconto é gravado no banco.
 */
export type DestinoSaldoOrcamento='a_definir'|'cliente'
export type ValorCondicaoOrcamento={forma:string;valor:string}
export type ResumoPagamentoOrcamento={
  valorTotalCentavos:number
  valorPrevistoCentavos:number
  saldoCentavos:number
  excedenteCentavos:number
  temValorInformado:boolean
  possuiValorInvalido:boolean
  quantosInvalidos:number
}
export const reais=(centavos:number)=>centavos/100
export const valorMoeda=(valor:number)=>valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

/** Valor em reais ou centavos. Vazio é null; não numérico é NaN. */
export function valorEmCentavos(texto:string):number|null{
  const s=String(texto||'').replace(/R\$/gi,'').replace(/\s/g,'').trim()
  if(!s)return null
  let normalizado:string
  if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s)){
    normalizado=s.replace(/\./g,'').replace(',','.')
  }else if(/^(?:\d+)?(?:[.,]\d{1,2})?$/.test(s)&&s!=='.'&&s!==','){
    normalizado=s.replace(',','.')
  }else{
    return NaN
  }
  const n=Number(normalizado)
  if(!Number.isFinite(n)||n<0||n>100000000)return NaN
  return Math.round(n*100)
}

export function resumoPagamentoOrcamento(totalReais:number,condicoes:ValorCondicaoOrcamento[]):ResumoPagamentoOrcamento{
  const valorTotalCentavos=Math.max(0,Math.round((Number.isFinite(totalReais)?totalReais:0)*100))
  let valorPrevistoCentavos=0
  let quantosInvalidos=0
  let temValorInformado=false
  for(const item of condicoes){
    const valor=valorEmCentavos(item.valor)
    if(valor===null)continue
    temValorInformado=true
    if(!Number.isFinite(valor)){quantosInvalidos++;continue}
    valorPrevistoCentavos+=valor
  }
  return {
    valorTotalCentavos,valorPrevistoCentavos,
    saldoCentavos:Math.max(0,valorTotalCentavos-valorPrevistoCentavos),
    excedenteCentavos:Math.max(0,valorPrevistoCentavos-valorTotalCentavos),
    temValorInformado,
    possuiValorInvalido:quantosInvalidos>0,quantosInvalidos
  }
}
