import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
const empresa='deba6b94-361e-4559-88fd-533ae6546685'
const externo='a466e236-9403-48c8-9fe2-739242373510'
const userId='b01eaa8f-96b3-4ac8-ab04-baa09a6152ee'
const obraId='33333333-3333-4333-8333-333333333333'
let usuario={id:userId,empresa_id:empresa,role:'master'},nivel='edicao'
const fotos=new Map(), consultas=[], solicitacoes=[]
const tables={
 obras:[{id:obraId,empresa_id:empresa},{id:'44444444-4444-4444-8444-444444444444',empresa_id:externo}],
 marketing_uploads_pendentes:[],
 marketing_midias:[],
}
const jpeg=Buffer.from('ffd8ff000000000000000000','hex')
function from(table){
 const filtros=[]
 let action='select',payload=null,head=false,selectCount=false
 const q={
  select:(cols,opts={})=>{head=opts.head||false;selectCount=opts.count==='exact';return q},
  eq:(key,val)=>{filtros.push(r=>r[key]===val);return q},
  gt:(key,val)=>{filtros.push(r=>String(r[key])>String(val));return q},
  insert:v=>{action='insert';payload=v;return q},
  update:v=>{action='update';payload=v;return q},
 }
 function get(single){
  consultas.push({table,action})
  const rows=(tables[table]||[]).filter(row=>filtros.every(fn=>fn(row)))
  if(action==='insert'){
   const row={id:'11111111-1111-4111-8111-111111111111',versao:1,...payload}
   tables[table].push(row);return {data:single?row:[row],error:null,count:1}
  }
  if(action==='update'){for(const row of rows)Object.assign(row,payload)}
  return {data:head?null:single?rows[0]||null:rows,error:null,count:selectCount?rows.length:null}
 }
 q.maybeSingle=async()=>get(true)
 q.single=async()=>get(true)
 q.then=fn=>Promise.resolve(get(false)).then(fn)
 return q
}
const store={
 from(name){
  assert.equal(name,'atlas-marketing')
  return {
   createSignedUploadUrl:async(path,options)=>{
    assert.equal(options.upsert,false)
    solicitacoes.push(path)
    return {data:{token:'signed-only-upload',signedUrl:'https://private.invalid/signed-upload'},error:null}
   },
   download:async path=>{
    if(!fotos.has(path))return {data:null,error:{message:'missing'}}
    return {data:new Blob([fotos.get(path)],{type:'image/jpeg'}),error:null}
   }
  }
 }
}
const next={NextResponse:{json:(data,options={})=>({data,status:options.status||200,headers:options.headers,json:async()=>data})}}
function loadModule(path,imports={}){
 const module={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{
  if(name in imports)return imports[name]
  if(name.startsWith('node:'))return require(name)
  throw Error('unexpected import '+name)
 },console,Buffer,Date,Promise,Set,Map,JSON,Object,Number,String,Uint8Array,process:{env:{}}})
 return module.exports
}
const editorial=loadModule('lib/marketing/editorialRegras.ts')
const media=loadModule('lib/marketing/midiaRegras.ts')
function app(enabled){
 return loadModule('app/api/marketing/upload-direto/route.ts',{
  'next/server':next,
  '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
  '@/lib/acessoUsuarioServer':{nivelAcaoUsuarioServer:async args=>{
   assert.equal(args.empresaId,empresa)
   assert.equal(args.acaoId,'marketing.biblioteca')
   return nivel
  }},
  '@/lib/supabaseAdmin':{supabaseAdmin:{from,storage:store}},
  '@/lib/marketing/editorialRegras':editorial,
  '@/lib/marketing/midiaRegras':media,
 })
}
const envOriginal=process.env.MARKETING_BACKEND_ENABLED
// Read the route with explicit mock env; the function reads process.env dynamically.
const nextResponseReq=body=>({json:async()=>body})
process.env.MARKETING_BACKEND_ENABLED='false'
const api=app(false)
let r=await api.POST(nextResponseReq({acao:'solicitar_url'}))
assert.equal(r.status,503)
assert.equal(consultas.length,0)
process.env.MARKETING_BACKEND_ENABLED='true'
// VM's environment needs to see live status (do not read production env).
// Rebuild the app using an alternate loader that supplies controlled env.
function enabledApp(){
 const module={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('app/api/marketing/upload-direto/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const imports={
  'node:crypto':require('node:crypto'),'next/server':next,
  '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
  '@/lib/acessoUsuarioServer':{nivelAcaoUsuarioServer:async args=>{
   assert.equal(args.empresaId,empresa);return nivel
  }},
  '@/lib/supabaseAdmin':{supabaseAdmin:{from,storage:store}},
  '@/lib/marketing/editorialRegras':editorial,
  '@/lib/marketing/midiaRegras':media,
 }
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>imports[name]??(()=>{throw Error(name)})(),
  console,Buffer,Date,Promise,JSON,Object,Number,String,process:{env:{MARKETING_BACKEND_ENABLED:'true'}}})
 return module.exports
}
const ligado=enabledApp()
usuario=null
r=await ligado.POST(nextResponseReq({acao:'solicitar_url'}));assert.equal(r.status,401)
usuario={id:userId,empresa_id:empresa,role:'master'}
nivel='consulta'
r=await ligado.POST(nextResponseReq({acao:'solicitar_url'}));assert.equal(r.status,403)
nivel='edicao'
const dados={acao:'solicitar_url',nome:'obra-001.jpg',tipo_mime:'image/jpeg',tamanho_bytes:jpeg.length,obra_id:obraId}
r=await ligado.POST(nextResponseReq({...dados,tamanho_bytes:30*1024*1024+1}));assert.equal(r.status,422)
r=await ligado.POST(nextResponseReq({...dados,tipo_mime:'image/svg+xml'}));assert.equal(r.status,422)
r=await ligado.POST(nextResponseReq({...dados,obra_id:'44444444-4444-4444-8444-444444444444'}));assert.equal(r.status,404)
r=await ligado.POST(nextResponseReq(dados))
assert.equal(r.status,201)
const id=r.data.upload_id,path=r.data.path
assert.ok(path.startsWith(empresa+'/')&&r.data.token)
assert.equal(tables.marketing_uploads_pendentes[0].status,'pendente')
r=await ligado.POST(nextResponseReq({acao:'finalizar',upload_id:id}))
assert.equal(r.status,409,'Nada foi enviado ainda')
fotos.set(path,Buffer.from('3c73766720736f6d65746869','hex'))
r=await ligado.POST(nextResponseReq({acao:'finalizar',upload_id:id}))
assert.equal(r.status,415,'Não aceitar arquivo diferente do declarado')
fotos.set(path,jpeg)
r=await ligado.POST(nextResponseReq({acao:'finalizar',upload_id:id}))
assert.equal(r.status,201)
assert.equal(r.data.midia.direitos_confirmados,false,'Upload nunca autoriza publicação')
assert.equal(tables.marketing_midias.length,1)
assert.equal(tables.marketing_midias[0].upload_id,id)
assert.equal(tables.marketing_uploads_pendentes[0].status,'confirmado')
r=await ligado.POST(nextResponseReq({acao:'finalizar',upload_id:id}))
assert.equal(r.status,200)
assert.equal(tables.marketing_midias.length,1,'Reenvio idempotente')
const own=usuario
usuario={...usuario,id:'d833a22e-a7b0-4263-a3a4-3b926c61e941'}
r=await ligado.POST(nextResponseReq({acao:'finalizar',upload_id:id}))
assert.equal(r.status,404,'Um segundo usuário não apropria upload')
usuario=own
process.env.MARKETING_BACKEND_ENABLED=envOriginal
console.log('Marketing upload direto: bloqueio, credenciais, formato, tenant, consentimento e idempotência simulados com sucesso.')
