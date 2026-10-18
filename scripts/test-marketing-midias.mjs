import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
const empresa='deba6b94-361e-4559-88fd-533ae6546685'
const estranho='a466e236-9403-48c8-9fe2-739242373510'
const uid='b01eaa8f-96b3-4ac8-ab04-baa09a6152ee'
const obraId='33333333-3333-4333-8333-333333333333'
const midiaId='11111111-1111-4111-8111-111111111111'
let usuario={id:uid,empresa_id:empresa,role:'master'}
let nivel='edicao', bancoFalha=false, storageFalha=false, removidos=[]
const tables={
  obras:[{id:obraId,empresa_id:empresa},{id:'44444444-4444-4444-8444-444444444444',empresa_id:estranho}],
  marketing_midias:[
    {id:midiaId,empresa_id:empresa,storage_path:empresa+'/original/file.jpg',tipo_mime:'image/jpeg',direitos_confirmados:false,versao:1},
    {id:'22222222-2222-4222-8222-222222222222',empresa_id:estranho,storage_path:estranho+'/original/file.jpg',versao:1},
  ],
}
let consultas=[], uploads=[]
function from(tab){
  const filters=[],q={}
  let modo='select',payload=null
  q.select=()=>q
  q.eq=(k,v)=>{filters.push([k,v]);return q}
  q.update=v=>{modo='update';payload=v;return q}
  q.insert=v=>{modo='insert';payload=v;return q}
  q.order=()=>q;q.limit=()=>q
  function result(unico){
    consultas.push({tab,filters,modo})
    if(bancoFalha)return {data:null,error:{message:'offline'}}
    const achados=(tables[tab]||[]).filter(x=>filters.every(([k,v])=>x[k]===v))
    if(modo==='insert'){
      const item={id:midiaId,versao:1,...payload}
      tables[tab].push(item)
      return {data:unico?item:[item],error:null}
    }
    if(modo==='update'){
      for(const r of achados)Object.assign(r,payload)
    }
    return {data:unico?achados[0]||null:achados,error:null}
  }
  q.maybeSingle=async()=>result(true)
  q.single=async()=>result(true)
  q.then=ok=>Promise.resolve(result(false)).then(ok)
  return q
}
const storage={
  from(name){
    assert.equal(name,'atlas-marketing')
    return {
      upload:async(path,bytes,config)=>{
        uploads.push({path,bytes,config})
        return {error:storageFalha?{message:'erro'}:null}
      },
      remove:async paths=>{removidos.push(paths);return {error:null}},
      createSignedUrl:async(path,ttl)=>{
        assert.equal(ttl,60)
        return {data:{signedUrl:'https://storage.invalid/preview'},error:null}
      }
    }
  },
}
const fakeNext={NextResponse:{json:(data,options={})=>({status:options.status||200,data,headers:options.headers,json:async()=>data})}}
function tsModule(path,imports={}){
  const mod={exports:{}}
  const txt=fs.readFileSync(path,'utf8')
  const code=ts.transpileModule(txt,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:name=>{
    if(name in imports)return imports[name]
    if(name.startsWith('node:'))return require(name)
    throw Error('Import inesperado: '+name)
  },Buffer,process:{env:{}},console,Date,Promise,Object,Set,Map,Number,String,Uint8Array})
  return mod.exports
}
const editorial=tsModule('lib/marketing/editorialRegras.ts')
const rules=tsModule('lib/marketing/midiaRegras.ts')
assert.equal(rules.conteudoMidiaValido('image/png',Buffer.from('89504e470d0a1a0a0000000000','hex')),true)
assert.equal(rules.conteudoMidiaValido('image/jpeg',Buffer.from('ffd8ff000000000000000000','hex')),true)
assert.equal(rules.conteudoMidiaValido('image/jpeg',Buffer.from('3c73766720736f6d657468696e67','hex')),false)
assert.equal(rules.conteudoMidiaValido('video/mp4',Buffer.from('000000186674797069736f6d','hex')),true)
assert.equal(rules.conteudoMidiaValido('video/webm',Buffer.from('1a45dfa30000000000000000','hex')),true)
assert.equal(rules.evidenciaDireitosValida('Autorização expressa confirmada'),true)
assert.equal(rules.evidenciaDireitosValida('sim'),false)
function load(enabled){
  const mod={exports:{}}
  const code=ts.transpileModule(fs.readFileSync('app/api/marketing/midias/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const imports={
    'node:crypto':require('node:crypto'),
    'next/server':fakeNext,
    '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
    '@/lib/acessoUsuarioServer':{nivelAcaoUsuarioServer:async args=>{
      assert.equal(args.empresaId,empresa)
      assert.equal(args.setorId,'marketing')
      return nivel
    }},
    '@/lib/supabaseAdmin':{supabaseAdmin:{from,storage}},
    '@/lib/marketing/editorialRegras':editorial,
    '@/lib/marketing/midiaRegras':rules,
  }
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:name=>{
    if(!(name in imports))throw Error('Import inesperado: '+name)
    return imports[name]
  },Buffer,process:{env:{MARKETING_BACKEND_ENABLED:enabled?'true':'false'}},
  console,Date,Promise,Object,Set,Map,Number,String,Uint8Array})
  return mod.exports
}
function request(body={},query=''){
 return {
  headers:new Map(),
  json:async()=>body,
  formData:async()=>({get:key=>body[key]??null}),
  nextUrl:{searchParams:new URLSearchParams(query)},
 }
}
const jpeg=Buffer.from('ffd8ff000000000000000000','hex')
const arquivo=(bytes=jpeg,tipo='image/jpeg')=>({
  name:'obra.jpg',type:tipo,size:bytes.length,
  arrayBuffer:async()=>bytes,
})
const appInativo=load(false)
let r=await appInativo.GET(request({},'id='+midiaId))
assert.equal(r.status,503)
assert.equal(consultas.length,0,'Desligado não acessa banco')
const app=load(true)
usuario=null
r=await app.GET(request({},'id='+midiaId));assert.equal(r.status,401)
usuario={id:uid,empresa_id:empresa,role:'master'}
nivel='oculto'
r=await app.GET(request({},'id='+midiaId));assert.equal(r.status,403)
nivel='consulta'
r=await app.GET(request({},'id='+midiaId));assert.equal(r.status,200)
assert.equal(r.data.expiraEmSegundos,60)
r=await app.GET(request({},'id=22222222-2222-4222-8222-222222222222'))
assert.equal(r.status,404,'Empresa estranha não recebe URL')
r=await app.POST(request({arquivo:arquivo()}))
assert.equal(r.status,403,'Consulta não grava mídia')
nivel='edicao'
r=await app.POST(request({arquivo:arquivo(),obra_id:'44444444-4444-4444-8444-444444444444'}))
assert.equal(r.status,404,'Obra de outra empresa bloqueada')
r=await app.POST(request({arquivo:arquivo(Buffer.from('3c73766720736f6d657468696e67','hex'))}))
assert.equal(r.status,415,'Formato declarado não corresponde ao conteúdo')
r=await app.POST(request({arquivo:arquivo(),obra_id:obraId}))
assert.equal(r.status,201)
assert.equal(r.data.midia.direitos_confirmados,false,'Upload não concede direitos')
assert.ok(uploads[0].path.startsWith(empresa+'/'))
assert.equal(uploads[0].config.upsert,false)
r=await app.PATCH(request({id:midiaId,versao:1,autorizado:true,evidencia:'sim'}))
assert.equal(r.status,422,'Evidência insuficiente bloqueia consentimento')
r=await app.PATCH(request({id:midiaId,versao:1,autorizado:true,evidencia:'Permissão expressa documentada em contato com cliente'}))
assert.equal(r.status,200)
assert.equal(r.data.midia.direitos_confirmados,true)
r=await app.PATCH(request({id:midiaId,versao:1,autorizado:false}))
assert.equal(r.status,409,'Versão concorrente impede alteração antiga')
r=await app.PATCH(request({id:midiaId,versao:2,autorizado:false}))
assert.equal(r.status,200)
assert.equal(r.data.midia.direitos_confirmados,false)
bancoFalha=true
r=await app.POST(request({arquivo:arquivo()}))
assert.equal(r.status,503)
assert.equal(removidos.length,1,'Upload compensado se metadados falharem')
bancoFalha=false
console.log('Marketing mídia: 6 validações binárias e 15 cenários de API simulada aprovados.')
