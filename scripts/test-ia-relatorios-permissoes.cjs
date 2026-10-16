const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function load(path,imports={},extra=''){
 const module={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(path,'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>{if(n in imports)return imports[n];throw Error(n)},console,Set,Map})
 return module.exports
}
const policy=load('lib/ai/acessoDominio.ts')
for(const value of ['invalid','__proto__','constructor',null,42,''])assert.equal(policy.restringirEscopoIA('setor',{permitido:true,escopo:value}),'nenhum')
assert.equal(policy.restringirEscopoIA('proprio',{permitido:true,escopo:'empresa'}),'proprio')
assert.equal(policy.restringirEscopoIA('setor',{permitido:true,escopo:'proprio'}),'proprio')
assert.equal(policy.restringirEscopoIA('setor',null),'setor')
assert.equal(policy.restringirEscopoIA('setor',{permitido:false,escopo:'empresa'}),'nenhum')
let calls=[],failure=null
function from(table){
 const filters=[];calls.push({table,filters})
 const q={}
 for(const method of ['select','eq','in','order','limit','or'])q[method]=(...args)=>{filters.push([method,...args]);return q}
 const result=()=>({data:table==='permissoes'?[{setor_id:'compras',nivel:'consulta'}]:[],error:table===failure?{message:'simulated'}:null})
 q.maybeSingle=async()=>result()
 q.then=(a,b)=>Promise.resolve(result()).then(a,b)
 return q
}
const context=load('lib/ai/contextoAtlasGlobal.ts',{
 '@/lib/supabaseAdmin':{supabaseAdmin:{from}},
 '@/lib/ai/acessoDominio':policy,
 '@/lib/ai/specialists':{AI_ESPECIALISTAS:[{modulo:'compras',setorIds:['compras']}]},
 '@/lib/ai/orcamentoEstimativaServer':{},
},'\nexport { carregarAcessos, buscarTabela, acessoAuxiliar }')
const user={id:'user',empresa_id:'tenant',role:'funcionario'}
let authUser=user,grants=true,permissionError=false
const route=load('app/api/relatorios/fornecedores/route.ts',{
 'next/server':{NextResponse:{json:(data,o={})=>({data,status:o.status||200})}},
 '@/lib/tenantServer':{autenticarTenant:async()=>authUser},
 '@/lib/supabaseAdmin':{supabaseAdmin:{from:()=>{throw Error('Dados consultados antes do bloqueio')}}},
 '@/lib/acessoUsuarioServer':{usuarioPodeAcaoServer:async p=>{assert.equal(p.empresaId,'tenant');if(permissionError)throw Error('offline');return grants}},
 '@/lib/relatorioFornecedores':{},
})
;(async()=>{
 for(const table of ['permissoes','ia_acessos_dominio']){
  failure=table;await assert.rejects(()=>context.carregarAcessos(user),/restrições/)
 }
 failure=null;calls=[]
 const access=await context.carregarAcessos(user)
 assert.equal(access.compras.escopo,'setor')
 for(const call of calls)assert.ok(call.filters.some(f=>f[0]==='eq'&&f[1]==='empresa_id'&&f[2]==='tenant'))
 calls=[]
 for(const opts of [{escopo:'nenhum'},{escopo:'proprio'},{escopo:'proprio',proprioColumn:'id'}]){
  assert.equal((await context.buscarTabela({table:'sensitive',select:'*',searchColumns:[],termos:[],...opts})).length,0)
 }
 assert.equal(calls.length,0,'Sem titularidade não consulta dados')
 await context.buscarTabela({table:'owned',select:'*',searchColumns:[],termos:[],escopo:'proprio',proprioColumn:'usuario_id',proprioValue:'user',empresaId:'tenant'})
 assert.ok(calls[0].filters.some(f=>f[0]==='eq'&&f[1]==='usuario_id'&&f[2]==='user'))
 failure='ia_acessos_dominio';await assert.rejects(()=>context.acessoAuxiliar(user,'custos_precos'))
 calls=[];await context.carregarAcessos({...user,role:'master'});assert.equal(calls.length,0,'Master preservado')
 const req={nextUrl:{searchParams:new URLSearchParams()}}
 authUser=null;assert.equal((await route.GET(req)).status,401)
 authUser=user;grants=false;assert.equal((await route.GET(req)).status,403)
 grants=true;permissionError=true;assert.equal((await route.GET(req)).status,503)
 permissionError=false;assert.equal((await route.GET(req)).status,400,'Autorizado segue validação original')
 console.log('OK: escopos inválidos, erros de permissão, titularidade, tenant e bloqueios do relatório.')
})().catch(e=>{console.error(e);process.exitCode=1})
