const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function carregar(path, mocks = {}) {
  const exports = {}
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(js, {exports, require:name => name in mocks ? mocks[name] : require(name), Buffer, Uint8Array, File: require('node:buffer').File})
  return exports
}
const base = require('node:path').join(__dirname, '..')
const {identificarFotoUpload} = carregar(base + '/lib/validarFotoUpload.ts')
const jpeg = Buffer.from([255,216,255,224,0,4,1,2])
assert.deepEqual({...identificarFotoUpload(jpeg)}, {mime:'image/jpeg', extensao:'jpg'})
assert.equal(identificarFotoUpload(Buffer.from('<svg onload="alert(1)"></svg>')), null)
assert.equal(identificarFotoUpload(Buffer.from('<html></html>')), null)
assert.equal(identificarFotoUpload(Buffer.alloc(0)), null)
assert.equal(identificarFotoUpload(Buffer.from('RIFFxxxxWAVE')), null)
for (const [brand, mime] of [['heic','image/heic'],['avif','image/avif']]) {
 const b=Buffer.alloc(16);b.writeUInt32BE(16);b.write('ftyp',4);b.write(brand,8)
 assert.equal(identificarFotoUpload(b).mime,mime)
 b.writeUInt32BE(200);assert.equal(identificarFotoUpload(b), null)
}
let uploads = []
let registro
const db = {
 from(table) {
  const q = { select(){return q},eq(){return q},insert(value){registro=value;return q},
   maybeSingle:async()=>({data:table==='medicoes_finais'?{status_operacional:'em_medicao'}:{id:'item'}}),
   single:async()=>({data:{id:'foto',url:registro.url}})}
  return q
 },
 storage:{from(){return {upload:async(...args)=>{uploads.push(args);return {}}, getPublicUrl:()=>({data:{publicUrl:'https://example.test/photo'}})}}}
}
const {POST}=carregar(base+'/app/api/medicao-final/acesso/[token]/foto/route.ts', {
 '@/lib/validarFotoUpload':{identificarFotoUpload},
 '@/lib/supabaseAdmin':{supabaseAdmin:db},
 '@/lib/medicaoAcessoExternoServer':{buscarAcessoValidoMedicao:async()=>({medicao_id:'medicao'})},
 'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}}
})
const {File} = require('node:buffer')
const request=file=>({formData:async()=>({get:key=>key==='file'?file:key==='itemId'?'item':null})})
;(async()=>{
 const rejected=await POST(request(new File(['<svg></svg>'],'photo.jpg',{type:'image/jpeg'})),{params:{token:'test'}})
 assert.equal(rejected.status,400);assert.equal(uploads.length,0)
 const accepted=await POST(request(new File([jpeg],'photo.svg',{type:'image/svg+xml'})),{params:{token:'test'}})
 assert.equal(accepted.status,200);assert.equal(uploads.length,1)
 assert.match(uploads[0][0],/\.jpg$/);assert.equal(uploads[0][2].contentType,'image/jpeg')
 console.log('PASS: conteúdo ativo rejeitado; formato e extensão derivados dos bytes; fotos móveis preservadas.')
})().catch(e=>{console.error(e);process.exitCode=1})
