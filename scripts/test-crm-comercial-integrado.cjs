const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const source=fs.readFileSync('app/api/crm/comercial/route.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText

const empresa='tenant-1'
let usuario={id:'u1',role:'funcionario',empresa_id:empresa}
let podeCRM=true,podeVerOrcamento=false,escopo='proprios',falha=false
const acessos=[]
const mock={
  orcamentos:[
    {id:'orc-u1',empresa_id:empresa,cliente_id:'c1',cliente_nome:'Cliente proprio',criado_por_id:'u1',criado_por_nome:'Vendedor 1',status:'enviado',valor_estimado:34000,updated_at:'2026-10-16T20:00:00Z'},
    {id:'orc-u2',empresa_id:empresa,cliente_id:'c2',cliente_nome:'Cliente colega',criado_por_id:'u2',criado_por_nome:'Vendedor 2',status:'rascunho',valor_estimado:78000,updated_at:'2026-10-16T18:00:00Z'},
    {id:'orc-tenant2',empresa_id:'tenant-2',cliente_nome:'Cliente outra empresa',criado_por_id:'u1',status:'enviado',valor_estimado:999999},
  ],
  prospeccoes:[
    {id:'pros-u1',empresa_id:empresa,nome_cliente:'Prospecção propria',responsavel_id:'u1',status:'nova',updated_at:'2026-10-16T19:00:00Z'},
    {id:'pros-u2',empresa_id:empresa,nome_cliente:'Prospecção colega',responsavel_id:'u2',status:'nova',updated_at:'2026-10-16T18:00:00Z'},
    {id:'pros-tenant2',empresa_id:'tenant-2',nome_cliente:'Prospecção outra empresa',responsavel_id:'u1',status:'nova'},
  ],
  crm_tarefas:[
    {id:'t-u1',empresa_id:empresa,cliente_nome:'Cliente proprio',titulo:'Retorno',responsavel_id:'u1',concluida:false,data_vencimento:'2026-10-16'},
    {id:'t-u2',empresa_id:empresa,cliente_nome:'Cliente colega',titulo:'Ligar',responsavel_id:'u2',concluida:false,data_vencimento:'2026-10-17'},
    {id:'t-tenant2',empresa_id:'tenant-2',cliente_nome:'Outro',titulo:'Ligar',responsavel_id:'u1',concluida:false},
  ]
}
function from(table){
  assert.ok(table in mock,'Tabela não autorizada: '+table)
  const filters=[]
  const q={
    select(){return q},
    eq(column,val){filters.push([column,val]);return q},
    or(){return q},
    order(){return q},
    limit(){return q},
    then(resolve,reject){
      acessos.push({table,filters})
      const data=mock[table].filter(row=>filters.every(([key,value])=>row[key]===value))
      return Promise.resolve(falha?{data:null,error:{message:'simulated'}}:{data,error:null}).then(resolve,reject)
    },
  }
  return q
}
const mods={
  'next/server':{NextResponse:{json:(data,opts={})=>({status:opts.status||200,data,headers:opts.headers})}},
  '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
  '@/lib/supabaseAdmin':{supabaseAdmin:{from}},
  '@/lib/acessoUsuarioServer':{
    lerAcessoConfigServer:async()=>({crmEscopo:escopo}),
    usuarioPodeAcaoServer:async p=>{
      assert.equal(p.empresaId,empresa)
      assert.equal(p.minimo,'consulta')
      if(p.acaoId==='comercial.crm.consultar')return podeCRM
      if(p.acaoId==='comercial.orcamento.consultar')return podeVerOrcamento
      throw Error('unexpected action')
    },
  }
}
const routeExports={}
vm.runInNewContext(js,{exports:routeExports,require:n=>{if(!(n in mods))throw Error('Import inesperado '+n);return mods[n]},console})
const route=routeExports.GET
;(async()=>{
  let r=await route({})
  assert.equal(r.status,200)
  assert.equal(r.data.escopo,'proprios')
  assert.equal(r.data.oportunidades.length,2)
  assert.equal(r.data.agenda.length,1)
  assert.equal(r.data.oportunidades.find(x=>x.id==='orc:orc-u1').valor,null)
  assert.ok(!r.data.oportunidades.some(x=>x.nome.includes('colega')||x.nome.includes('outra')))
  assert.equal(r.data.oportunidades.find(x=>x.id==='orc:orc-u1').link,null)
  assert.ok(acessos.every(x=>x.filters.some(y=>y[0]==='empresa_id'&&y[1]===empresa)))
  assert.ok(acessos.every(x=>x.filters.some(y=>y[0]==='criado_por_id'||y[0]==='responsavel_id')))
  escopo='todos';podeVerOrcamento=true;acessos.length=0
  r=await route({})
  assert.equal(r.status,200)
  assert.equal(r.data.escopo,'todos')
  assert.equal(r.data.oportunidades.length,4)
  assert.equal(r.data.agenda.length,2)
  assert.equal(r.data.oportunidades.find(x=>x.id==='orc:orc-u1').valor,34000)
  assert.ok(!r.data.oportunidades.some(x=>x.nome.includes('outra')))
  assert.ok(acessos.every(x=>x.filters.some(y=>y[0]==='empresa_id'&&y[1]===empresa)))
  podeCRM=false;acessos.length=0
  r=await route({})
  assert.equal(r.status,403);assert.equal(acessos.length,0)
  podeCRM=true;usuario=null;acessos.length=0
  r=await route({})
  assert.equal(r.status,401);assert.equal(acessos.length,0)
  usuario={id:'u1',role:'master',empresa_id:empresa};escopo='proprios';acessos.length=0
  r=await route({})
  assert.equal(r.status,200)
  assert.equal(r.data.escopo,'todos')
  falha=true
  r=await route({})
  assert.equal(r.status,503)
  assert.ok(!JSON.stringify(r.data).includes('simulated'))
  console.log('PASS: CRM própria/todos, preços restritos, isolamento tenant, Master, 401/403, erro seguro e ausência de escrita.')
})().catch(e=>{console.error(e);process.exitCode=1})