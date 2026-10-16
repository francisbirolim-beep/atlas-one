const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const file=fs.readFileSync(path.join(__dirname,'../components/clientes/Cliente360DashboardV2.tsx'),'utf8')
assert(file.includes("const [aba,setAba]=useState<Aba>('visao')"),'Visão Geral deve abrir primeiro')
assert(file.indexOf("{id:'visao',label:'Visão geral'}") < file.indexOf("{id:'cadastro',label:'Cadastro'}"),'Ordem das abas alterada')
assert(!file.includes('<Kpi titulo="Total vendido"'),'Não exibir KPIs financeiros acima das abas')
assert(!file.includes('<Kpi titulo="Total recebido"'),'Não exibir KPIs financeiros na Visão Geral')
const inicio=file.indexOf("{aba==='visao'&&pode('visao')&&")
const fim=file.indexOf("{aba==='orcamentos'&&pode('orcamentos')&&",inicio)
assert(inicio>-1&&fim>inicio,'Visão Geral deve estar encapsulada em permissão própria')
const geral=file.slice(inicio,fim)
for(const proibido of ['Financeiro do cliente','Total vendido','Total recebido','A receber','Vencido','Cadastro resumido','Últimos orçamentos','moeda(','valorOrcamento(','saldo(','recebimentos.map']){
 assert(!geral.includes(proibido),'Visão Geral expõe informação indevida: '+proibido)
}
for(const permitido of ['pedido_orcamento','orcamento_sob_medida','balcao','abrir_assistencia','pedido_compra']){
 assert(generalCheck(geral,permitido),'Ação indisponível ou sem checagem de permissão: '+permitido)
}
function generalCheck(src,key){return src.includes("pode('"+key+"',true)")}
assert(geral.includes("pode('financeiro')")===false,'Visão Geral não deve exibir painel financeiro')
assert(geral.includes("pode('historico')")&&geral.includes("pode('compras')"),'Links de setores exigem permissão')
assert(file.includes("{aba==='financeiro'&&pode('financeiro')&&"),'Manter aba Financeiro restrita')
assert(file.includes("{aba==='vendas'&&pode('vendas')&&"),'Manter aba Vendas')
assert(file.includes("{aba==='cadastro'&&pode('cadastro')&&"),'Manter cadastro')
assert(file.includes("setAba(atual=>podeCliente360(dados.acesso,atual)"),'Respeitar fallback da aba conforme permissões')
assert(geral.includes('/compras/solicitacoes?cliente='),'Pedido de compra deve preservar vínculo com cliente')
console.log('PASS: Cliente 360 abre em Visão Geral enxuta; financeiro e cadastro preservados; ações e acesso protegidos.')
