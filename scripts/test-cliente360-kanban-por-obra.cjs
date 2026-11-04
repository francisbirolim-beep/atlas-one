const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const root=path.join(__dirname,'..')
const source=fs.readFileSync(path.join(root,'lib/cliente360KanbanObras.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod={exports:{}}
const colunas=[
 {id:'vendido',nome:'Vendido',ordem:0},{id:'separacao',nome:'Separação',ordem:1},
 {id:'compras',nome:'Compras',ordem:2},{id:'aguardando',nome:'Aguardando',ordem:3},
 {id:'medicao',nome:'Medição',ordem:4},{id:'producao',nome:'Produção',ordem:5},
 {id:'instalacao',nome:'Instalação',ordem:6},{id:'finalizado',nome:'Finalizado',ordem:7}]
new Function('require','module','exports',compiled)(
 (ref)=>ref==='./visaoGeralProjetos'?{COLUNAS_GERAIS_PADRAO:colunas}:require(ref),mod,mod.exports)
const {agruparKanbanObras,COLUNAS_KANBAN_CLIENTE}=mod.exports
const obra={id:'o1',numero:101,nome:'Obra A',status:'planejamento',cidade:'José Bonifácio',
 previsaoEntrega:null,fotoProjetoUrl:null,orcamentos:2}
const outra={...obra,id:'o2',numero:102,nome:'Obra B'}
const venda=(id,colunaId)=>({vendaId:id,numero:1,colunaId,etapaOperacional:colunaId,progresso:null,progressoDescricao:'Etapa real'})
assert.equal(new Set(COLUNAS_KANBAN_CLIENTE.map(c=>c.id)).size,COLUNAS_KANBAN_CLIENTE.length)
assert.equal(agruparKanbanObras([obra],{}).length,1)
assert.equal(agruparKanbanObras([obra],{})[0].colunaId,'orcamento')
assert.equal(agruparKanbanObras([obra],{})[0].progresso,null)
assert.equal(agruparKanbanObras([obra,outra],{o1:[venda('v1','compras')]}).length,2)
assert.equal(agruparKanbanObras([obra],{o1:[venda('v1','finalizado'),venda('v2','producao')]} )[0].colunaId,'producao')
assert.equal(agruparKanbanObras([obra],{o1:[venda('v1','finalizado'),venda('v2','compras')]} )[0].vendas.length,2)
assert.equal(agruparKanbanObras([obra],{x:[venda('sem-vinculo','finalizado')]} )[0].colunaId,'orcamento')
const endpoint=fs.readFileSync(path.join(root,'app/api/clientes/[id]/kanban-obras/route.ts'),'utf8')
assert.match(endpoint,/podeCliente360\(acesso,'obras'\)/)
assert.match(endpoint,/\.eq\('empresa_id',empresa\)\.eq\('cliente_id',clienteId\)/)
assert.match(endpoint,/export async function GET/)
assert.doesNotMatch(endpoint,/export async function (POST|PATCH|DELETE)/)
console.log('Kanban Cliente 360: 12 verificações aprovadas (agrupamento, vínculo, acesso e leitura).')
