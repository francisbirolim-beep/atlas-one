const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../app/api/restaurar-backup/route.ts'), 'utf8')
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const operator = '11111111-1111-4111-8111-111111111111'
const backupId = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const now = Date.parse('2026-10-24T23:00:00Z')
function scenario(options = {}) {
  const calls = []
  const env = {...options.env}
  const user = options.user === undefined ? {id:operator} : options.user
  const db = {
    auth:{getUser:async token => {calls.push(['auth',token]);return {data:{user},error:null}}},
    from(table) {
      calls.push(['from',table])
      const q = {select(){return q},eq(){return q},async maybeSingle(){
        return {data:table === 'usuarios' ? {nome:'Operator',role:options.role || 'master'} : {id:backupId,tabelas:{}},error:null}
      }}
      return q
    }
  }
  const exports = {}
  const mocks = {
    'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status || 200})}},
    '@/lib/supabaseAdmin':{supabaseAdmin:db},
    '@/lib/backupServer':{
      salvarBackup:async()=>{calls.push(['save']);if(options.saveFailure)throw Error('snapshot failed')},
      restaurarSnapshot:async()=>{calls.push(['restore'])}
    }
  }
  class Clock extends Date {static now(){return now}}
  vm.runInNewContext(js,{exports,require:n=>mocks[n],process:{env},Date:Clock})
  const body = options.body || {backupId,confirmacao:`RESTAURAR_GLOBAL:${backupId}`}
  const req={headers:{get:()=>options.noToken?'':'Bearer mock-token'},json:async()=>{calls.push(['json']);return body}}
  return {run:()=>exports.POST(req),calls}
}
const enabled = {
  ATLAS_LEGACY_RESTORE_ENABLED:'true',
  ATLAS_LEGACY_RESTORE_UNTIL:'2026-10-24T23:30:00Z',
  ATLAS_LEGACY_RESTORE_OPERATOR_ID:operator,
  ATLAS_LEGACY_RESTORE_BACKUP_ID:backupId
}
;(async()=>{
  let count = 0
  for(const env of [
    {}, {...enabled,ATLAS_LEGACY_RESTORE_ENABLED:'false'},
    {...enabled,ATLAS_LEGACY_RESTORE_UNTIL:'invalid'},
    {...enabled,ATLAS_LEGACY_RESTORE_UNTIL:'2026-10-24T22:59:00Z'},
    {...enabled,ATLAS_LEGACY_RESTORE_UNTIL:'2026-10-25T23:00:00Z'},
    {...enabled,ATLAS_LEGACY_RESTORE_OPERATOR_ID:''},
    {...enabled,ATLAS_LEGACY_RESTORE_BACKUP_ID:'invalid'}
  ]){
    const s=scenario({env});assert.equal((await s.run()).status,503);assert.equal(s.calls.length,0);count++
  }
  for(const [opts,status] of [
    [{noToken:true},401], [{user:null},401], [{user:{id:other}},403],
    [{role:'funcionario'},403], [{body:{backupId}},403],
    [{body:{backupId:other,confirmacao:`RESTAURAR_GLOBAL:${other}`}},403],
    [{body:{backupId:123}},400]
  ]){
    const s=scenario({...opts,env:enabled});assert.equal((await s.run()).status,status)
    assert.equal(s.calls.some(c=>c[0]==='save'||c[0]==='restore'),false);count++
  }
  const good=scenario({env:enabled});assert.equal((await good.run()).status,200)
  assert.deepEqual(good.calls.slice(-2),[['save'],['restore']]);count++
  const failed=scenario({env:enabled,saveFailure:true});assert.equal((await failed.run()).status,500)
  assert.equal(failed.calls.some(c=>c[0]==='restore'),false);count++
  console.log(`PASS: ${count} synthetic restore cases; default makes no database calls; maintenance operator, backup, expiry, confirmation enforced; pre-backup failure blocks restore.`)
})().catch(error=>{console.error(error);process.exitCode=1})
