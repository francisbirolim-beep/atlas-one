// Teste comportamental das APIs existentes com banco/Auth simulados, sem rede.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function route(relative,db){
 const exports={}
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 vm.runInNewContext(js,{exports,require:n=>n==='@/lib/supabaseAdmin'?{supabaseAdmin:db}:n==='next/server'?{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}}:require(n)})
 return exports.POST
}
const req=body=>({headers:{get:()=> 'Bearer fake-token'},json:async()=>body})
function backend(role='master',targetCompany='company-a'){
 const writes=[],actors={actor:{id:'actor',role,empresa_id:'company-a'},target:{id:'target',role:'funcionario',empresa_id:targetCompany}}
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}}),admin:{createUser:async payload=>{writes.push({kind:'auth-create',payload});return {data:{user:{id:'created'}}}},updateUserById:async(id,payload)=>{writes.push({kind:'auth-update',id,payload});return{}},deleteUser:async()=>({})}},from:table=>{
  const filters={},q={select(){return q},eq(key,value){filters[key]=value;return q},maybeSingle:async()=>({data:actors[filters.id]&&(!filters.empresa_id||actors[filters.id].empresa_id===filters.empresa_id)?actors[filters.id]:null}),update(payload){writes.push({kind:'profile-update',table,payload,filters});return q},insert:async payload=>{writes.push({kind:'profile-insert',table,payload});return{}},then(resolve,reject){return Promise.resolve({}).then(resolve,reject)}}
  return q
 }}
 return {db,writes}
}
;(async()=>{
 for(const file of ['app/api/atualizar-usuario/route.ts','app/api/criar-usuario/route.ts']){
  const b=backend('funcionario'),r=await route(file,b.db)(req({id:'target',nome:'Teste',senha:'ficticia-123',role:'master'}))
  assert.equal(r.status,403);assert.equal(b.writes.length,0,'Funcionario nao chama backend privilegiado')
 }
 let b=backend('master','company-b'),post=route('app/api/atualizar-usuario/route.ts',b.db)
 assert.equal((await post(req({id:'target',nome:'Outro'}))).status,404);assert.equal(b.writes.length,0,'Master nao edita outra empresa')
 b=backend();post=route('app/api/atualizar-usuario/route.ts',b.db)
 assert.equal((await post(req({id:'actor',role:'funcionario'}))).status,400);assert.equal(b.writes.length,0,'Master nao remove proprio acesso')
 assert.equal((await post(req({id:'target',nome:'Nome novo',empresa_id:'company-b',role:'master'}))).status,200)
 const update=b.writes.find(w=>w.kind==='profile-update')
 assert.equal(update.payload.nome,'Nome novo');assert.equal(update.payload.role,'master');assert.equal(update.payload.empresa_id,undefined);assert.equal(update.filters.empresa_id,'company-a')
 b=backend();post=route('app/api/criar-usuario/route.ts',b.db)
 assert.equal((await post(req({nome:'Pessoa ficticia',email:'fixture@example.test',senha:'ficticia-123',role:'funcionario',empresa_id:'company-b'}))).status,200)
 assert.equal(b.writes.find(w=>w.kind==='profile-insert').payload.empresa_id,'company-a','Empresa de criacao vem do autor autorizado')
 console.log('PASS: APIs existentes negam funcionario e outra empresa, preservam criacao/edicao Master por backend e bloqueiam autodespromocao; mocks sem rede.')
})().catch(e=>{console.error(e);process.exitCode=1})
