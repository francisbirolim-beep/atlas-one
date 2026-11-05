import {otimizarPerfis, type CortePerfil} from './aproveitamentoPerfis'
import type {MaterialResumoTipologia} from './materiaisTipologiasResumo'

export type CorteAgrupadoObra = {
 comprimentoMm:number;quantidade:number;tipologias:string[]
}
export type BarraConsolidadaObra = {
 chave:string;produtoId:string;codigo:string;descricao:string;cor:string|null;
 comprimentoBarraMm:number;quantidadeBarras:number;quantidadePecas:number;
 materialIds:string[];tipologias:string[];cortes:CorteAgrupadoObra[];
 sobraTotalMm:number
}
const corNormalizada=(s:unknown)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
const chaveBarra=(produtoId:string,cor:string|null|undefined,tamanho:number)=>
 JSON.stringify([produtoId,corNormalizada(cor),tamanho])

/** Simulação de barras brutas para a obra INTEIRA, nunca modifica tipologia nem estoque.
 * A quantidade técnica é de PEÇAS de corte. Só o otimizador gera a quantidade de BARRAS.
 * A perda de serra é explícita: sem configuração confirmada, usa 0 e sinaliza a premissa.
 */
export function calcularBarrasConsolidadasObra(
 materiais:MaterialResumoTipologia[], opcoes:{perdaCorteMm?:number}={}
){
 const perdaCorteMm=Number(opcoes.perdaCorteMm??0)
 if(!Number.isFinite(perdaCorteMm)||perdaCorteMm<0||perdaCorteMm>50)
  throw Error('A perda de corte deve estar entre 0 e 50 mm.')
 const pendencias:string[]=[]
 const cortes:CortePerfil[]=[]
 const validos=new Set<string>()
 const codigoPorProduto=new Map<string,string>()
 const resumos=new Map<string,BarraConsolidadaObra>()
 let pecas=0
 for(const m of materiais){
  if(!['perfil','contramarco'].includes(String(m.categoria||'').toLowerCase()))continue
  const qtd=Number(m.quantidade_ajustada??m.quantidade_tecnica??0)
  const corte=Number(m.comprimento_corte_mm??0)
  const barra=Number(m.comprimento_barra_mm??0)
  const produtoId=String(m.produto_id||'').trim()
  const codigo=String(m.codigo||'').trim().toUpperCase()
  const descricao=String(m.descricao||codigo).trim()
  const cor=m.cor_ref||null
  if(!Number.isInteger(qtd)||qtd<0){pendencias.push(codigo+': quantidade de peças inválida.');continue}
  if(!qtd)continue
  if(!produtoId||!codigo||!Number.isFinite(corte)||corte<=0||!Number.isFinite(barra)||barra<=0){
   pendencias.push((codigo||descricao)+': falta produto, código, medida de corte ou comprimento comercial da barra.')
   continue
  }
  if(corte+perdaCorteMm>barra){
   pendencias.push(codigo+': corte de '+corte+' mm não cabe na barra de '+barra+' mm, incluindo a perda de serra.')
   continue
  }
  const codigoAnterior=codigoPorProduto.get(produtoId)
  if(codigoAnterior&&codigoAnterior!==codigo){
   pendencias.push(codigo+': produto cadastrado também como '+codigoAnterior+'. Corrija o vínculo antes de otimizar.')
   continue
  }
  codigoPorProduto.set(produtoId,codigo)
  pecas+=qtd
  if(pecas>2500){
   return {barras:[] as BarraConsolidadaObra[],pendencias:['Mais de 2.500 cortes; use o plano de produção para o cálculo completo.'],
    idsCalculados:[] as string[],totalBarras:0,totalPecas:0,perdaCorteMm}
  }
  validos.add(m.id)
  const chave=chaveBarra(produtoId,cor,barra)
  let registro=resumos.get(chave)
  if(!registro){
   registro={chave,produtoId,codigo,descricao,cor,comprimentoBarraMm:barra,
    quantidadeBarras:0,quantidadePecas:0,materialIds:[],tipologias:[],cortes:[],sobraTotalMm:0}
   resumos.set(chave,registro)
  }
  registro.quantidadePecas+=qtd
  registro.materialIds.push(m.id)
  if(m.item_ref&&!registro.tipologias.includes(m.item_ref))registro.tipologias.push(m.item_ref)
  const linha=registro.cortes.find(c=>c.comprimentoMm===corte)
  if(linha){
   linha.quantidade+=qtd
   if(m.item_ref&&!linha.tipologias.includes(m.item_ref))linha.tipologias.push(m.item_ref)
  }else registro.cortes.push({comprimentoMm:corte,quantidade:qtd,tipologias:m.item_ref?[m.item_ref]:[]})
  cortes.push({id:m.id,material_id:m.id,item_ref:m.item_ref,produto_id:produtoId,codigo,
   cor_ref:cor,comprimento_mm:corte,quantidade:qtd,comprimento_barra_mm:barra})
 }
 const plano=otimizarPerfis(cortes,[],{perdaCorteMm,minimoSobraReaproveitavelMm:300})
 for(const bar of plano.barras.filter(b=>b.fonte_tipo==='barra_nova')){
  const resumo=resumos.get(chaveBarra(bar.produto_id,bar.cor_ref,bar.comprimento_inicial_mm))
  if(resumo){resumo.quantidadeBarras++;resumo.sobraTotalMm+=bar.sobra_final_mm}
 }
 const barras=[...resumos.values()].map(b=>({...b,cortes:b.cortes.sort((a,c)=>c.comprimentoMm-a.comprimentoMm)}))
  .sort((a,b)=>a.codigo.localeCompare(b.codigo,'pt-BR')||String(a.cor).localeCompare(String(b.cor))||a.comprimentoBarraMm-b.comprimentoBarraMm)
 return {barras,pendencias:[...pendencias,...plano.pendencias],idsCalculados:[...validos],
  totalBarras:barras.reduce((s,b)=>s+b.quantidadeBarras,0),
  totalPecas:barras.reduce((s,b)=>s+b.quantidadePecas,0),perdaCorteMm}
}
