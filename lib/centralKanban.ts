export const QUADROS = [
 {id:'comercial',nome:'Comercial',rota:'/kanban/comercial'},
 {id:'engenharia',nome:'Medição e Engenharia',rota:'/engenharia'},
 {id:'compras',nome:'Compras',rota:'/compras'},
 {id:'producao',nome:'Produção',rota:'/producao'},
 {id:'instalacao',nome:'Instalação',rota:'/instalacao'},
 {id:'financeiro',nome:'Financeiro',rota:'/financeiro'},
 {id:'assistencia',nome:'Assistência Técnica',rota:'/assistencias'},
] as const
export type QuadroId = typeof QUADROS[number]['id']
export type SetorBoard = Exclude<QuadroId,'comercial'|'assistencia'>
export type NivelBoard = 'oculto'|'visualizar'|'movimentar'|'administrar'
export const ETAPAS:Record<SetorBoard,string[]>={
 engenharia:['Aguardando medição','Em medição','Validar medição','Liberado'],
 compras:['Conferir materiais','Em cotação','Pedido realizado','Aguardando mercadoria','Recebimento parcial','Recebido 100%'],
 producao:['Aguardando liberação','Planejamento','Corte','Montagem','Conferência','Finalizada'],
 instalacao:['Aguardando agendamento','Agendado','Em instalação','Pendências','Concluída'],
 financeiro:['A receber','Recebimento parcial','Quitado'],
}
export const SETORES_ACESSO:Record<QuadroId,string[]>={
 comercial:['orcamentos','fazer-orcamento-msanfyvj'],engenharia:['engenharia','medicao','engenharia-projeto'],
 compras:['compras','compras-perfis','compras-vidros','compras-acessorios','compras-outros'],
 producao:['producao'],instalacao:['instalacao'],financeiro:['financeiro'],assistencia:['assistencia-painel']
}
export const calcPct=(parte:number,total:number)=>total>0?Math.max(0,Math.min(100,Math.round(parte/total*100))):0

// O mesmo desconto considerado no painel da venda precisa contar na Central de Kanbans.
// A alocação e o campo da conta representam o MESMO desconto: nunca somar os dois.
type ContaFinanceiraKanban={id:string;status?:string|null;valor?:number|null;valor_pago?:number|null;valor_desconto?:number|null}
type AlocacaoDescontoKanban={conta_receber_id?:string|null;tipo?:string|null;valor?:number|null}
const valorSeguro=(valor:unknown)=>{const n=Number(valor);return Number.isFinite(n)?Math.max(0,n):0}
export function percentualFinanceiroKanban(contas:ContaFinanceiraKanban[],alocacoes:AlocacaoDescontoKanban[],valorVenda:number){
 const descontos=new Map<string,number>()
 for(const a of alocacoes)if(a.tipo==='desconto'&&a.conta_receber_id){
  descontos.set(a.conta_receber_id,(descontos.get(a.conta_receber_id)||0)+valorSeguro(a.valor))
 }
 let total=0,liquidado=0
 for(const c of contas){
  if(['cancelado','cancelada'].includes(String(c.status||'').toLowerCase()))continue
  const valor=valorSeguro(c.valor),pago=valorSeguro(c.valor_pago)
  const desconto=Math.max(valorSeguro(c.valor_desconto),descontos.get(c.id)||0)
  total+=valor
  liquidado+=Math.min(valor,pago+desconto)
 }
 const venda=valorSeguro(valorVenda)
 if(venda<=0||total<=0)return 0
 // A venda só pode aparecer quitada se as parcelas conferirem com o valor da venda.
 if(Math.abs(total-venda)<=0.02&&liquidado>=venda-0.01)return 100
 // Evita mostrar 100% com saldo residual ou parcelas inconsistentes.
 return Math.min(99,calcPct(liquidado,venda))
}
export const progressoOperacional=(compras:number,producao:number,instalacao:number)=>Math.round((100+compras+producao+instalacao)/4)


// Uma coluna final operacional não é apenas uma posição visual: requer conclusão real.
// Engenharia mantém fluxo próprio de liberação técnica, sem mudança automática aqui.
export const indiceConclusaoOperacional=(setor:string):number|null=>
 ['compras','producao','instalacao','financeiro'].includes(setor)
  ?ETAPAS[setor as SetorBoard].length-1:null
export const ehColunaConclusaoOperacional=(setor:string,ordem:number):boolean=>{
 const indice=indiceConclusaoOperacional(setor)
 return indice!==null&&ordem===indice
}
