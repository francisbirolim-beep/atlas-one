/** Pré-conferência comercial: não grava nem altera o orçamento original. */
export type ItemOrcamentoVenda = {
 id?:string
 ambiente?:string
 descricao?:string
 tipo_esquadria?:string
 tipo_outro_texto?:string
 quantidade?:number|string
 preco_total?:number|string|null
 valor_total?:number|string|null
 wvetro_item?: {ValorTotalAlterado?:number|string|null;ValorTotal?:number|string|null;Total?:number|string|null}|null
 [chave:string]:unknown
}
export type SelecionadoVenda = {indice:number;quantidade:number}
export function quantidadeOriginal(item:ItemOrcamentoVenda):number {
 const n=Number(item.quantidade??1)
 return Number.isFinite(n)&&n>0?Math.max(1,Math.floor(n)):1
}
function numeroPreco(v:unknown):number|null {
 if(v===null||v===undefined||String(v).trim()==='')return null
 if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:null
 const texto=String(v).replace(/[^0-9,.-]/g,'')
 if(!texto)return null
 const n=Number(texto.includes(',')?texto.replace(/\./g,'').replace(',','.'):texto)
 return Number.isFinite(n)&&n>=0?n:null
}
export function precoTotalItem(item:ItemOrcamentoVenda):number|null {
 return numeroPreco(item.preco_total??item.valor_total??item.wvetro_item?.ValorTotalAlterado??item.wvetro_item?.ValorTotal??item.wvetro_item?.Total)
}
export function validarSelecaoVenda(itens:ItemOrcamentoVenda[],selecao:SelecionadoVenda[]) {
 const vistos=new Set<number>(),erros:string[]=[]
 for(const s of selecao){
  if(!Number.isInteger(s.indice)||s.indice<0||s.indice>=itens.length){erros.push('Índice de item inválido');continue}
  if(vistos.has(s.indice)){erros.push('Item selecionado duas vezes');continue}
  vistos.add(s.indice)
  if(!Number.isInteger(s.quantidade)||s.quantidade<1||s.quantidade>quantidadeOriginal(itens[s.indice]))erros.push(`Quantidade do item ${s.indice+1} fora do permitido`)
 }
 if(!selecao.length)erros.push('Selecione pelo menos uma tipologia')
 return {valida:erros.length===0,erros,parcial:selecao.length<itens.length||selecao.some(s=>s.quantidade<quantidadeOriginal(itens[s.indice]))}
}
export function resumirSelecaoVenda(itens:ItemOrcamentoVenda[],selecao:SelecionadoVenda[]) {
 const validacao=validarSelecaoVenda(itens,selecao)
 let estimativa=0,semPreco=false,pecas=0
 if(validacao.valida)for(const s of selecao){
  const item=itens[s.indice],total=precoTotalItem(item)
  pecas+=s.quantidade
  if(total===null)semPreco=true
  else estimativa+=total*(s.quantidade/quantidadeOriginal(item))
 }
 return {...validacao,pecas,valorEstimado:semPreco?null:Math.round(estimativa*100)/100}
}
