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
export const progressoOperacional=(compras:number,producao:number,instalacao:number)=>Math.round((100+compras+producao+instalacao)/4)
