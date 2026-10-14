import { buscarPedidoWVetro, listarOrcamentosWVetro, listarPedidosWVetro } from '@/lib/wvetroApi'
import { extrairPedidoAtual } from '@/lib/wvetroConferenciaValores'

type Registro=Record<string,unknown>
const registro=(v:unknown):Registro=>v&&typeof v==='object'&&!Array.isArray(v)?v as Registro:{}
const texto=(v:unknown)=>String(v??'').trim()
const numeroIgual=(a:unknown,numero:string)=>/^\d+$/.test(texto(a))&&Number(texto(a))===Number(numero)
const dataIso=(v:unknown)=>{
 const s=texto(v).slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null
 const d=new Date(s+'T00:00:00Z')
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null
}
export function periodoSeguroWVetro(data:unknown):{inicio:string;fim:string}|null{
 const s=dataIso(data)
 if(!s)return null
 const ms=Date.parse(s+'T00:00:00Z')
 const dia=(d:number)=>new Date(ms+d*86400000).toISOString().slice(0,10)
 // Consulta operacional aceita períodos de até sete dias.
 return {inicio:dia(-3),fim:dia(3)}
}
// Só procurar registros por Nro; Orcamentoid é a chave interna e pode
// ter valor diferente. Não confundir orçamentos de outros clientes.
export function localizarRegistroWVetro(payload:unknown,numero:string):Registro|null{
 const fila:unknown[]=[payload];let visitas=0
 while(fila.length&&visitas++<500){
  const x=fila.shift()
  if(Array.isArray(x)){fila.push(...x.slice(0,250));continue}
  const o=registro(x)
  if(!Object.keys(o).length)continue
  const n=o.Nro??o.nro??o.Numero??o.numero
  if(numeroIgual(n,numero))return o
  for(const [k,v] of Object.entries(o)){
   if(v&&typeof v==='object'&&
       (Array.isArray(v)||/^(?:List[A-Za-z]+|lista[A-Za-z]*|pedido|pedidos|orcamento|orcamentos|data|dados|result|resultado|content|response)$/i.test(k)))
    fila.push(v)
  }
 }
 return null
}
export function itemizacaoCompletaWVetro(pedido:Registro|null):boolean{
 if(!pedido)return false
 const items=Array.isArray(pedido.Itens)?pedido.Itens:Array.isArray(pedido.itens)?pedido.itens:[]
 if(!items.length)return false
 // Não anunciar comparação financeira atual se o serviço somente trouxe
 // cabeçalho ou itens sem custo/venda por tipologia.
 return items.every(x=>{
  const i=registro(x)
  return (i.ValorTotal!=null&&i.ValorTotal!=='') &&
   (i.ValorTotalAlterado!=null&&i.ValorTotalAlterado!=='')
 })
}
export type ConsultaConferencia={
 pedido:Registro|null
 estrategia:'chave'|'lista_pedidos'|'lista_orcamentos'|null
 motivos:string[]
}
export type ClienteWVetroConsulta={
 porChave:(id:string)=>Promise<unknown>
 pedidos:(inicio:string,fim:string)=>Promise<unknown>
 orcamentos:(inicio:string,fim:string)=>Promise<unknown>
}
export const clienteRealWVetro:ClienteWVetroConsulta={
 porChave:buscarPedidoWVetro,pedidos:listarPedidosWVetro,orcamentos:listarOrcamentosWVetro,
}
export async function consultarPedidoConferenciaWVetro(
 numero:string,importado:unknown,
 cliente:ClienteWVetroConsulta=clienteRealWVetro,
):Promise<ConsultaConferencia>{
 if(!/^\d{1,12}$/.test(numero))throw Error('Número W.Vetro inválido')
 const motivos:string[]=[]
 let porChave:unknown
 try{
  porChave=await cliente.porChave(numero)
  const pedido=extrairPedidoAtual(porChave,numero)
  if(itemizacaoCompletaWVetro(pedido))return {pedido,estrategia:'chave',motivos}
  motivos.push('A consulta por chave não trouxe uma composição financeira completa')
 }catch{
  motivos.push('Consulta por chave indisponível')
 }
 const historico=registro(importado)
 const referencias=[
  {tipo:'pedidos' as const,periodo:periodoSeguroWVetro(historico.DtVenda??historico.Data)},
  {tipo:'orcamentos' as const,periodo:periodoSeguroWVetro(historico.DtEmissao)},
 ]
 // Usa os mesmos endpoints de lista que alimentam a integração aprovada,
 // sempre dentro da data original (não confundir com "hoje").
 for(const ref of referencias){
  if(!ref.periodo){motivos.push('Data original '+ref.tipo+' não disponível');continue}
  try{
   const resposta=ref.tipo==='pedidos'
    ?await cliente.pedidos(ref.periodo.inicio,ref.periodo.fim)
    :await cliente.orcamentos(ref.periodo.inicio,ref.periodo.fim)
   const encontrado=localizarRegistroWVetro(resposta,numero)
   if(itemizacaoCompletaWVetro(encontrado))
    return {pedido:encontrado,estrategia:ref.tipo==='pedidos'?'lista_pedidos':'lista_orcamentos',motivos}
   if(encontrado){
    motivos.push('Orçamento localizado na lista '+ref.tipo+', mas sem custos e vendas completos')
    // Se a lista trouxer apenas cabeçalho e sua chave interna, tentar
    // pedidoByKey com a chave real (diferente do número exibido).
    const id=texto(encontrado.Orcamentoid??encontrado.OrcamentoId)
    if(/^\d+$/.test(id)&&id!==numero){
     try{
      const detalhado=await cliente.porChave(id)
      const direto=extrairPedidoAtual(detalhado,numero)
      // Só confiar na resposta se ela afirmar explicitamente o mesmo Nro.
      if(itemizacaoCompletaWVetro(direto))
       return {pedido:direto,estrategia:'chave',motivos}
     }catch{motivos.push('Chave interna não retornou detalhes financeiros')}
    }
   }else motivos.push('Orçamento não encontrado na lista '+ref.tipo+' da data original')
  }catch{
   motivos.push('Consulta da lista '+ref.tipo+' indisponível')
  }
 }
 return {pedido:null,estrategia:null,motivos}
}
