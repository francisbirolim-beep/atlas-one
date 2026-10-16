const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
function carregar(path,imports={}){
  const modulo={exports:{}}
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(js,{exports:modulo.exports,module:modulo,require:n=>{if(n in imports)return imports[n];throw Error('Import inesperado: '+n)},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test'}},console})
  return modulo.exports
}
const p=carregar('lib/cliente360Permissoes.ts')
const basico={role:'funcionario',setores:{},acoes:{}}
for(const [id] of p.CLIENTE_360_RECURSOS)assert.equal(p.nivelCliente360({...basico,role:'master',cliente360:p.matrizCompletaCliente360('oculto')},id),'edicao')
assert.equal(p.podeCliente360(basico,'cadastro'),true,'Cadastro legado preservado')
assert.equal(p.podeCliente360(basico,'financeiro'),false,'Sem setor não consulta financeiro')
const vendedor={...basico,setores:{orcamentos:'edicao','assistencia-abrir':'edicao'},cliente360:{...p.matrizCompletaCliente360('oculto'),pedido_orcamento:'edicao',abrir_assistencia:'edicao'}}
assert.equal(p.podeCliente360(vendedor,'pedido_orcamento',true),true)
assert.equal(p.podeCliente360(vendedor,'abrir_assistencia',true),true)
for(const id of ['financeiro','vendas','compras','medicoes','balcao'])assert.equal(p.podeCliente360(vendedor,id),false,id)
assert.equal(p.podeCliente360({...vendedor,setores:{orcamentos:'consulta'}},'pedido_orcamento',true),false,'Leitura não cria pedido')
assert.equal(p.podeCliente360({...vendedor,acoes:{'comercial.pedido_orcamento.criar':'oculto'}},'pedido_orcamento',true),false,'Ação específica bloqueia setor')
assert.equal(p.podeCliente360({...basico,cliente360:{financeiro:'edicao'}},'financeiro'),false,'Matriz não amplia setor oculto')
assert.equal(p.podeCliente360({...basico,setores:{financeiro:'edicao'},cliente360:{financeiro:'consulta'}},'financeiro',true),false,'Somente leitura não edita')
assert.equal(p.podeCliente360({...basico,setores:{'medida-final-msdwtt9y':'consulta'}},'medicoes'),true,'Setor oficial da Medida Final')
assert.equal(p.podeCliente360({...basico,setores:{compras:'edicao'},acoes:{'compras.geral.consultar':'oculto','compras.geral.ver_proprios':'consulta'}},'compras'),true,'Solicitante acompanha pedidos próprios sem acesso geral')
assert.equal(JSON.stringify(p.normalizarMatrizCliente360({financeiro:'admin',compras:'oculto',inexistente:'edicao'})),JSON.stringify({compras:'oculto'}))
let consultas=[]
let falharTabela=null
function query(tabela){
 consultas.push(tabela)
 const q={}
 for(const metodo of ['select','eq','or','order','limit','in'])q[metodo]=()=>q
 const retorno=()=>({data:tabela==='clientes'?{id:'cliente-1',nome:'Cliente de teste',observacoes:'Restrito'}:[],error:tabela===falharTabela?{message:'Falha simulada'}:null})
 q.maybeSingle=async()=>retorno()
 q.then=(a,b)=>Promise.resolve(retorno()).then(a,b)
 return q
}
let usuario={id:'usuario-1',nome:'Vendedor',role:'funcionario',empresa_id:'empresa-1'}
let contexto=vendedor
const route=carregar('app/api/clientes/[id]/painel/route.ts',{
 'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200,headers:options.headers})}},
 '@supabase/supabase-js':{createClient:()=>({from:query})},
 '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
 '@/lib/cliente360AcessoServer':{contextoCliente360Server:async()=>contexto},
 '@/lib/cliente360Permissoes':p,
})
const req={headers:{get:()=> 'Bearer token-de-teste'}}
;(async()=>{
 let resp=await route.GET(req,{params:{id:'cliente-1'}})
 assert.equal(resp.status,200)
 assert.equal(consultas.join(','),'clientes','Vendedor não consulta nenhuma tabela de setor bloqueado')
 assert.equal(resp.data.contas.length,0)
 assert.equal(resp.data.recebimentos.length,0)
 assert.equal(resp.data.cliente.observacoes,undefined,'Observações ocultas não saem no payload')
 contexto={...basico,cliente360:p.matrizCompletaCliente360('oculto')};consultas=[]
 resp=await route.GET(req,{params:{id:'cliente-1'}})
 assert.equal(resp.status,403);assert.equal(consultas.length,0,'Bloqueio total antes de consultar cliente')
 usuario=null
 resp=await route.GET(req,{params:{id:'cliente-1'}})
 assert.equal(resp.status,401)
 usuario={id:'master-1',role:'master',empresa_id:'empresa-1'};contexto={...basico,role:'master'};consultas=[]
 resp=await route.GET(req,{params:{id:'cliente-1'}})
 assert.equal(resp.status,200)
 assert.ok(consultas.includes('financeiro_contas_receber'),'Master preserva consulta financeira')
 falharTabela='financeiro_contas_receber'
 resp=await route.GET(req,{params:{id:'cliente-1'}})
 assert.equal(resp.status,503,'Falha de consulta não produz sucesso falso')
 console.log('PASS: Master, vendedor limitado, herança, leitura, bloqueio total, teto do setor, projeção, API sem token e falha fechada.')
})().catch(e=>{console.error(e);process.exitCode=1})
