/** Conciliação exclusivamente de leitura dos pesos registrados no CMV.
 * A unidade de conferência é fornecedor + venda/obra, NÃO cada nota individual.
 * Não altera custo realizado nem cria pedidos/recebimentos.
 */
export type EtapaPerfil = 'comprado'|'recebido'
export type EventoPerfil = {
  id:string; venda_obra_id:string; fornecedor:string|null; etapa_cmv:EtapaPerfil|null;
  data_lancamento:string; quantidade:number|string|null; valor:number|string|null; documento?:string|null
}
export type VendaReferencia = {id:string;cliente_id:string|null;numero:number|null}
export type ReferenciaPeriodo = 'compra'|'recebimento'|'movimento'
export type LinhaFornecedor = {
  id:string; fornecedor:string; fornecedorChave:string; vendaId:string; clienteId:string|null;
  cliente:string; numero:number|null; datasCompra:string[]; datasRecebimento:string[]; documentos:string[];
  pesoComprado:number; pesoRecebido:number; valorComprado:number; valorRecebido:number;
  pesoDiferenca:number|null; percentual:number|null; valorDiferenca:number|null;
  qtdCompras:number; qtdRecebimentos:number; situacao:'conferido'|'aguardando_recebimento'|'sem_compra'
}
export type ResumoFornecedor = {
  fornecedor:string; fornecedorChave:string; obras:number; conferidas:number; pendentes:number;
  pesoComprado:number; pesoRecebido:number; valorComprado:number; valorRecebido:number;
  pesoDiferenca:number|null; percentual:number|null; valorDiferenca:number|null;
}
export type ResultadoFornecedores = {linhas:LinhaFornecedor[]; fornecedores:ResumoFornecedor[]; total:ResumoFornecedor}
const kg=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000
const reais=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const pct=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
export const chaveFornecedor=(valor:string|null|undefined)=>String(valor||'Não informado').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLocaleUpperCase('pt-BR')
const dentro=(data:string,inicio:string,fim:string)=>data>=inicio&&data<=fim
const numero=(valor:unknown)=>{const n=Number(valor);return Number.isFinite(n)&&n>0?n:0}
function agregar(fornecedor:string,fornecedorChave:string,linhas:LinhaFornecedor[]):ResumoFornecedor{
 const conferidas=linhas.filter(l=>l.situacao==='conferido')
 const pesoComprado=kg(conferidas.reduce((s,l)=>s+l.pesoComprado,0))
 const pesoRecebido=kg(conferidas.reduce((s,l)=>s+l.pesoRecebido,0))
 const valorComprado=reais(conferidas.reduce((s,l)=>s+l.valorComprado,0))
 const valorRecebido=reais(conferidas.reduce((s,l)=>s+l.valorRecebido,0))
 return {fornecedor,fornecedorChave,obras:linhas.length,conferidas:conferidas.length,pendentes:linhas.length-conferidas.length,
  pesoComprado,pesoRecebido,valorComprado,valorRecebido,
  pesoDiferenca:conferidas.length?kg(pesoRecebido-pesoComprado):null,
  percentual:conferidas.length&&pesoComprado>0?pct((pesoRecebido-pesoComprado)/pesoComprado*100):null,
  valorDiferenca:conferidas.length?reais(valorRecebido-valorComprado):null}
}
export function montarRelatorioFornecedores(
 eventos:EventoPerfil[], vendas:VendaReferencia[], clientes:Record<string,string>,
 inicio:string,fim:string,referencia:ReferenciaPeriodo='compra'
):ResultadoFornecedores{
 const vendasPorId=new Map(vendas.map(v=>[v.id,v]))
 const grupos=new Map<string,{fornecedor:string;chave:string;vendaId:string;eventos:EventoPerfil[]}>()
 for(const evento of eventos){
  if(!vendasPorId.has(evento.venda_obra_id)||numero(evento.quantidade)<=0||!['comprado','recebido'].includes(evento.etapa_cmv||''))continue
  const chave=chaveFornecedor(evento.fornecedor)
  const id=evento.venda_obra_id+'|'+chave
  const grupo=grupos.get(id)||{fornecedor:String(evento.fornecedor||'Não informado').trim(),chave,vendaId:evento.venda_obra_id,eventos:[]}
  grupo.eventos.push(evento);grupos.set(id,grupo)
 }
 const linhas:LinhaFornecedor[]=[]
 for(const [id,g] of grupos){
  const compras=g.eventos.filter(e=>e.etapa_cmv==='comprado')
  const recebimentos=g.eventos.filter(e=>e.etapa_cmv==='recebido')
  const filtro=referencia==='compra'?compras:referencia==='recebimento'?recebimentos:g.eventos
  if(!filtro.some(e=>dentro(e.data_lancamento,inicio,fim)))continue
  const venda=vendasPorId.get(g.vendaId)!
  const pesoComprado=kg(compras.reduce((s,e)=>s+numero(e.quantidade),0))
  const pesoRecebido=kg(recebimentos.reduce((s,e)=>s+numero(e.quantidade),0))
  const valorComprado=reais(compras.reduce((s,e)=>s+numero(e.valor),0))
  const valorRecebido=reais(recebimentos.reduce((s,e)=>s+numero(e.valor),0))
  const conferido=compras.length>0&&recebimentos.length>0
  linhas.push({id,fornecedor:g.fornecedor,fornecedorChave:g.chave,vendaId:g.vendaId,clienteId:venda.cliente_id,
   cliente:clientes[venda.cliente_id||'']||'Cliente não encontrado',numero:venda.numero,
   datasCompra:Array.from(new Set(compras.map(e=>e.data_lancamento))).sort(),
   datasRecebimento:Array.from(new Set(recebimentos.map(e=>e.data_lancamento))).sort(),
   documentos:Array.from(new Set(recebimentos.map(e=>e.documento?.trim()).filter((x):x is string=>!!x))),
   pesoComprado,pesoRecebido,valorComprado,valorRecebido,
   pesoDiferenca:conferido?kg(pesoRecebido-pesoComprado):null,
   percentual:conferido&&pesoComprado>0?pct((pesoRecebido-pesoComprado)/pesoComprado*100):null,
   valorDiferenca:conferido?reais(valorRecebido-valorComprado):null,
   qtdCompras:compras.length,qtdRecebimentos:recebimentos.length,
   situacao:conferido?'conferido':compras.length?'aguardando_recebimento':'sem_compra'})
 }
 linhas.sort((a,b)=>a.fornecedorChave.localeCompare(b.fornecedorChave,'pt-BR')||a.cliente.localeCompare(b.cliente,'pt-BR'))
 const porFornecedor=new Map<string,LinhaFornecedor[]>()
 for(const l of linhas)porFornecedor.set(l.fornecedorChave,[...(porFornecedor.get(l.fornecedorChave)||[]),l])
 const fornecedores=Array.from(porFornecedor.entries()).map(([chave,valores])=>agregar(valores[0].fornecedor,chave,valores))
  .sort((a,b)=>(b.percentual??-Infinity)-(a.percentual??-Infinity)||a.fornecedor.localeCompare(b.fornecedor,'pt-BR'))
 return {linhas,fornecedores,total:agregar('Todos','TODOS',linhas)}
}
