// Compara somente unidades compatíveis, sem modificar os custos do orçamento ou da compra.
import {unidadePadraoCmv,rotuloUnidadeCmv} from './vendaCmvUnidades'
export type CompraPeso={categoria:string;origem:string;quantidade?:number|null;unidade?:string|null;valor:number}
export type RecebimentoPeso={categoria:string;peso_kg?:number|null;preco_kg?:number|null;quantidade?:number|null;unidade?:string|null;valor_total:number;cancelado_em?:string|null}
const centavos=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
export function compararPesosCmv(categoria:string,compras:readonly CompraPeso[],recebimentos:readonly RecebimentoPeso[],valorComprado:number,valorExterno=0){
 const relevantes=compras.filter(c=>c.categoria===categoria&&c.origem==='compra')
 const recebidos=recebimentos.filter(r=>r.categoria===categoria&&!r.cancelado_em)
 const unidadesCompras=[...new Set(relevantes.map(c=>String(c.unidade||'').trim().toUpperCase()).filter(Boolean))]
 const unidadesRecebidos=[...new Set(recebidos.map(r=>r.unidade?String(r.unidade).trim().toUpperCase():(categoria==='perfil'?'KG':'LEGADO_KG')))]
 const unidades=[...new Set([...unidadesCompras,...unidadesRecebidos])]
 const unidade=unidades.length===1&&unidades[0]!=='LEGADO_KG'?unidades[0]:unidadePadraoCmv(categoria)
 const unidadesMisturadas=unidades.length>1||unidades.includes('LEGADO_KG')
 const quantidadeComprada=relevantes.filter(c=>String(c.unidade||'').trim().toUpperCase()===unidade).reduce((s,c)=>s+Number(c.quantidade||0),0)
 const quantidadeRecebida=recebidos.filter(r=>(r.unidade?String(r.unidade).trim().toUpperCase():(categoria==='perfil'?'KG':'LEGADO_KG'))===unidade).reduce((s,r)=>s+Number(r.quantidade??(unidade==='KG'?r.peso_kg:0)??0),0)
 const faltaQuantidadeComprada=unidadesMisturadas||relevantes.some(c=>!(Number(c.quantidade)>0&&String(c.unidade||'').trim().toUpperCase()===unidade))||valorExterno>0
 const quantidadeConferivel=!faltaQuantidadeComprada&&quantidadeComprada>0
 const diferencaQuantidade=quantidadeConferivel?quantidadeRecebida-quantidadeComprada:null
 const percentualQuantidade=quantidadeConferivel?100*(quantidadeRecebida-quantidadeComprada)/quantidadeComprada:null
 const valorRecebido=centavos(recebidos.reduce((s,r)=>s+Number(r.valor_total||0),0))
 return {unidade,rotuloUnidade:rotuloUnidadeCmv(unidade),unidadesMisturadas,quantidadeComprada,quantidadeRecebida,diferencaQuantidade,percentualQuantidade,quantidadeConferivel,faltaQuantidadeComprada,
  pesoComprado:unidade==='KG'?quantidadeComprada:0,pesoRecebido:unidade==='KG'?quantidadeRecebida:0,
  diferencaKg:unidade==='KG'?diferencaQuantidade:null,percentualKg:unidade==='KG'?percentualQuantidade:null,
  pesoConferivel:unidade==='KG'&&quantidadeConferivel,faltaPesoComprado:unidade==='KG'&&faltaQuantidadeComprada,
  valorComprado,valorRecebido,temRecebimento:recebidos.length>0,
  diferencaCompraRecebido:recebidos.length?centavos(valorRecebido-valorComprado):null,
  quantidadeRecebimentos:recebidos.length}
}
