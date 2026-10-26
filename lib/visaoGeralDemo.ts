/** Dados fictícios exclusivos da prévia ?demo=1. Não representam clientes reais. */
export type DetalheMaterialCompra = {
 id:string;descricao:string;categoria:string;quantidade:number|null;unidade:string;
 comprado:number|null;recebido:number|null;fornecedor:string|null;responsavelRegistro:string|null;
 fotoUrl:string|null
}
export type MaterialResumo = {tipo:'perfil'|'vidro'|'acessorio'; total:number|null;comprados:number|null;recebidos:number|null}
export type ProjetoGeralCard = {
 vendaId:string;clienteId:string;obraId?:string;cliente:string;projeto:string;numeroOrcamento:string;
 colunaId:string;etapaOperacional:string;cor:'verde'|'amarelo'|'vermelho'|'azul'|'sem_prazo';
 pendencias:string[];previsaoEntrega:string|null;vencimentoEtapa?:string|null;diasAtraso:number;
 materiais:MaterialResumo[];compras:{total:number;comprados:number;recebidos:number};
 producao:{total:number;concluidas:number};instalacao:{total:number;concluidas:number};
 medicao?:{registros:number};instalacaoMes?:string|null;dataInstalacao?:string|null;valorInstalacao?:number|null;detalhesCompra?:DetalheMaterialCompra[];
 fotoProjetoUrl?:string|null;dataVenda?:string|null;observacoes?:string|null;
 controleMaster?:string|null;motivoControle?:string|null;etapaOrigem?:string|null;
}
export type PedidoGeralCard = {
 id:string;cliente:string;clienteId:string|null;vendaId:string|null;numeroOrcamento:string|null;
 status:'compras'|'aguardando';descricao:string;itens:number;recebidos:number;detalhesCompra?:DetalheMaterialCompra[];
}
const m=(perfil:[number,number,number],vidro:[number,number,number],acessorio:[number,number,number]):MaterialResumo[]=>[
 {tipo:'perfil',total:perfil[0],comprados:perfil[1],recebidos:perfil[2]},
 {tipo:'vidro',total:vidro[0],comprados:vidro[1],recebidos:vidro[2]},
 {tipo:'acessorio',total:acessorio[0],comprados:acessorio[1],recebidos:acessorio[2]},
]
const base=(id:string,cliente:string,orc:string,colunaId:string,cor:ProjetoGeralCard['cor'],materiais:MaterialResumo[],pendencias:string[]=[],valor=0,mes='2026-11'):ProjetoGeralCard=>({
 vendaId:'demo-'+id,clienteId:'demo-cliente-'+id,obraId:'demo-obra-'+id,cliente,projeto:'Obra residencial',
 numeroOrcamento:orc,colunaId,etapaOperacional:colunaId,cor,pendencias,
 previsaoEntrega:'2026-11-25',diasAtraso:cor==='vermelho'?4:0,materiais,
 compras:{total:12,comprados:9,recebidos:6},producao:{total:6,concluidas:colunaId==='producao'?3:0},
 instalacao:{total:6,concluidas:colunaId==='finalizado'?6:0},medicao:{registros:3},
 instalacaoMes:mes,valorInstalacao:valor,detalhesCompra:[]
})
export const DEMO_PROJETOS:ProjetoGeralCard[]=[
 base('a','Família Oliveira','#1171','vendido','verde',m([10,2,2],[8,0,0],[15,15,10]),[],28000),
 base('b','Residencial Prado','#1142','separacao','amarelo',m([10,7,6],[6,0,0],[12,8,5]),['Falta conferir lista de perfis'],38000),
 base('c','Construtora Horizonte','#1103','compras','amarelo',m([18,10,4],[8,1,0],[20,12,8]),['Cotação de perfis pendente'],42000),
 base('d','Família Santos','#1098','aguardando','vermelho',m([10,10,5],[8,8,0],[12,12,8]),['5 perfis aguardando entrega','8 vidros não recebidos'],41000),
 base('e','Residencial Souza','#1160','medicao','amarelo',m([12,12,12],[10,0,0],[16,16,16]),['2 tipologias aguardando medição final'],23500),
 base('f','Condomínio Bela Vista','#1120','producao','vermelho',m([30,30,30],[20,20,8],[25,25,25]),['12 vidros aguardando recebimento','3 OPs pendentes'],55000),
 base('g','Família Ribeiro','#1077','instalacao','verde',m([8,8,8],[8,8,8],[12,12,12]),[],22500),
 base('h','Residencial Almeida','#1050','finalizado','azul',m([9,9,9],[6,6,6],[10,10,10]),[],19000,'2026-10'),
]
export const DEMO_PEDIDOS:PedidoGeralCard[]=[
 {id:'compra-a',cliente:'Construtora Horizonte',clienteId:'demo-cliente-c',vendaId:'demo-c',numeroOrcamento:'#1103',status:'compras',descricao:'Pedido de perfis e acessórios',itens:5,recebidos:0},
 {id:'compra-b',cliente:'Família Santos',clienteId:'demo-cliente-d',vendaId:'demo-d',numeroOrcamento:'#1098',status:'aguardando',descricao:'Pedido de perfis — recebimento parcial',itens:8,recebidos:3},
 {id:'compra-c',cliente:'Condomínio Bela Vista',clienteId:'demo-cliente-f',vendaId:'demo-f',numeroOrcamento:'#1120',status:'aguardando',descricao:'Pedido de vidros em paralelo à produção',itens:12,recebidos:5},
]
export const DEMO_INSTALACOES=[
 {vendaId:'demo-a',cliente:'Família Oliveira',numeroOrcamento:'#1171',mes:'2026-11',valor:28000,estado:'previsto' as const},
 {vendaId:'demo-b',cliente:'Residencial Prado',numeroOrcamento:'#1142',mes:'2026-11',valor:38000,estado:'previsto' as const},
 {vendaId:'demo-c',cliente:'Construtora Horizonte',numeroOrcamento:'#1103',mes:'2026-11',valor:42000,estado:'previsto' as const},
 {vendaId:'demo-d',cliente:'Família Santos',numeroOrcamento:'#1098',mes:'2026-11',valor:41000,estado:'previsto' as const},
 {vendaId:'demo-f',cliente:'Condomínio Bela Vista',numeroOrcamento:'#1120',mes:'2026-12',valor:55000,estado:'previsto' as const},
 {vendaId:'demo-g',cliente:'Família Ribeiro',numeroOrcamento:'#1077',mes:'2026-10',valor:22500,estado:'confirmado' as const},
]
