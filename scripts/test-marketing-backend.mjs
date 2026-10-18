import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const sql = readFileSync('supabase/migrations/20261018100000_marketing_inteligente_base_v1.sql', 'utf8')
for (const regra of ['enable row level security', 'revoke all', 'storage.buckets',
  'marketing_verificar_midia_v1', 'marketing_verificar_publicacao_v1',
  'marketing_reverter_aprovacoes_v1', 'marketing_registrar_post_v1',
  'marketing_registrar_midia_v1', 'marketing_eventos_immut']) {
  assert.ok(sql.includes(regra), 'SQL sem proteção: ' + regra)
}
assert.ok(!/\b(public\s*=\s*true|publish\s*=\s*true)\b/i.test(sql))
const usuario = { id:'b01eaa8f-96b3-4ac8-ab04-baa09a6152ee',empresa_id:'deba6b94-361e-4559-88fd-533ae6546685',role:'master' }
const outro = 'a466e236-9403-48c8-9fe2-739242373510'
const midiaId = '11111111-1111-4111-8111-111111111111'
const postId = '22222222-2222-4222-8222-222222222222'
const tables = {
 marketing_midias:[
  {id:midiaId,empresa_id:usuario.empresa_id,direitos_confirmados:false},
  {id:'33333333-3333-4333-8333-333333333333',empresa_id:outro,direitos_confirmados:true},
 ],
 marketing_publicacoes:[
  {id:postId,empresa_id:usuario.empresa_id,midia_id:midiaId,titulo:'Original',
    legenda:'Primeira',canal:'instagram',data_planejada:'2026-10-21',status:'rascunho',revisao:1}
 ],
}
let consultas=[]
function from(table){
 const filtros=[]
 let alteracao=null
 const q = {
  select(){return q}, eq(k,v){filtros.push([k,v]);return q},
  order(){return q}, limit(){return q},
  insert(v){alteracao=['insert',v];return q},
  update(v){alteracao=['update',v];return q},
  maybeSingle:async()=>resultado(true),
  single:async()=>resultado(true),
  then(ok,fail){return Promise.resolve(resultado(false)).then(ok,fail)},
 }
 function resultado(single){
  const linhas = (tables[table]||[]).filter(row=>filtros.every(([k,v])=>row[k]===v))
  consultas.push({table,filtros,acao:alteracao?.[0]||'select'})
  if (alteracao?.[0]==='insert'){
   const row={id:postId,revisao:1,...alteracao[1]}
   tables[table].push(row)
   return {data:single?row:[row],error:null}
  }
  if (alteracao?.[0]==='update'){
   for(const row of linhas)Object.assign(row,alteracao[1])
   return {data:single?linhas[0]||null:linhas,error:null}
  }
  return {data:single?linhas[0]||null:linhas,error:null}
 }
 return q
}
let autorizado='edicao'
let identidade=usuario
const next={NextResponse:{json:(data,options={})=>({
 data,status:options.status||200,headers:options.headers||{},
 json:async()=>data,
})}}
function load(enabled){
 const module={exports:{}}
 const source=readFileSync('app/api/marketing/editorial/route.ts','utf8')
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const rulesModule={exports:{}}
 const rulesCode=ts.transpileModule(readFileSync('lib/marketing/editorialRegras.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(rulesCode,{module:rulesModule,exports:rulesModule.exports,require})
 const mocks={
  'next/server':next,
  '@/lib/tenantServer':{autenticarTenant:async()=>identidade},
  '@/lib/acessoUsuarioServer':{nivelAcaoUsuarioServer:async p=>{
   assert.equal(p.empresaId,usuario.empresa_id)
   assert.equal(p.setorId,'marketing')
   return autorizado
  }},
  '@/lib/supabaseAdmin':{supabaseAdmin:{from}},
  '@/lib/marketing/editorialRegras':rulesModule.exports,
 }
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{
  if(!(name in mocks))throw Error('Import inesperado: '+name)
  return mocks[name]
 },process:{env:{MARKETING_BACKEND_ENABLED:enabled?'true':'false'}},
 console,Date,JSON,Promise,Object,Set,Map})
 return module.exports
}
const pedir=(body)=>({json:async()=>body,headers:new Map()})
const disabled=load(false)
let r=await disabled.GET(pedir({}))
assert.equal(r.status,503)
assert.equal(consultas.length,0,'Backend inativo não pode consultar dados')
const api=load(true)
identidade=null
r=await api.GET(pedir({}))
assert.equal(r.status,401)
identidade=usuario;autorizado='oculto'
r=await api.GET(pedir({}))
assert.equal(r.status,403)
autorizado='consulta'
r=await api.GET(pedir({}))
assert.equal(r.status,200)
assert.equal(r.data.midias.length,1,'Listagem restrita à empresa autenticada')
assert.ok(consultas.every(x=>x.filtros.some(([k,v])=>k==='empresa_id'&&v===usuario.empresa_id)))
r=await api.POST(pedir({acao:'criar_rascunho',midia_id:midiaId,titulo:'X',legenda:'',canal:'instagram',data_planejada:'2026-10-21'}))
assert.equal(r.status,403,'Consulta não permite gravar')
autorizado='edicao'
r=await api.POST(pedir({acao:'criar_rascunho',midia_id:'33333333-3333-4333-8333-333333333333',titulo:'X',legenda:'',canal:'instagram',data_planejada:'2026-10-21'}))
assert.equal(r.status,404,'Proibido usar mídia de outra empresa')
r=await api.POST(pedir({acao:'criar_rascunho',midia_id:midiaId,titulo:'X',legenda:'',canal:'instagram',data_planejada:'2026-10-21'}))
assert.equal(r.status,201)
assert.equal(tables.marketing_publicacoes.at(-1).status,'rascunho','Nunca publica na criação')
r=await api.POST(pedir({acao:'aprovar',id:postId,revisao:1}))
assert.equal(r.status,422,'Não aprovar sem consentimento')
tables.marketing_midias[0].direitos_confirmados=true
r=await api.POST(pedir({acao:'aprovar',id:postId,revisao:1}))
assert.equal(r.status,200)
assert.equal(r.data.publicacao.status,'aprovado')
r=await api.POST(pedir({acao:'editar_rascunho',id:postId,revisao:1,titulo:'Outra',legenda:'',canal:'facebook',data_planejada:'2026-10-22'}))
assert.equal(r.status,409,'Impede sobrescrita por versão antiga')
r=await api.POST(pedir({acao:'editar_rascunho',id:postId,revisao:2,titulo:'Outra',legenda:'',canal:'facebook',data_planejada:'2026-10-22'}))
assert.equal(r.status,200)
assert.equal(tables.marketing_publicacoes[0].status,'rascunho','Edição invalida aprovação')
console.log('Marketing backend: 9 invariantes SQL, 13 cenários de API autorizada e regressão aprovados.')
