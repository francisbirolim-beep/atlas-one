const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const medicaoId = '9ae953a7-df8e-4e1c-a87d-f10d5d0cd834'
const itemId = '11111111-1111-1111-1111-111111111111'
const fotoId = '22222222-2222-2222-2222-222222222222'
const source = fs.readFileSync('app/api/medicao-final/[id]/fotos/route.ts', 'utf8')
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText
async function run(options = {}) {
  const calls = []
  const db = {
    auth: {getUser: async () => ({data: {user: options.noAuth ? null : {id: 'verified-user'}}})},
    from(table) {
      const call = {table, action: 'read', filters: []}; calls.push(call)
      const q = {
        select: () => q, eq: (key, value) => {call.filters.push([key, value]);return q}, order: () => q, limit: () => q,
        insert: value => {call.action = 'insert';call.value = value;return q},
        update: value => {call.action = 'update';call.value = value;return q},
        delete: () => {call.action = 'delete';return q},
        maybeSingle: () => Promise.resolve(result()), single: () => Promise.resolve(result()),
        then: (yes, no) => Promise.resolve(result()).then(yes, no),
      }
      function result() {
        if (table === 'usuarios') return {data: {id: 'verified-user', nome: 'Nome verificado', role: options.readOnly ? 'usuario' : 'master', empresa_id: 'empresa-A'}}
        if (table === 'medicoes_finais') return {data: options.wrongTenant ? null : {id: medicaoId, status_operacional: options.approved ? 'aprovado' : 'em_medicao'}}
        if (table === 'setores') return {data: {id: 'setor'}}
        if (table === 'permissoes') return {data: {nivel: 'consulta'}}
        if (table === 'medicao_itens' && call.action === 'read') return {data: {id: itemId, descricao: 'Porta', foto_larguras_url: 'https://example.org/old.jpg', foto_alturas_url: 'height.jpg', largura_baixo_mm: 1234}}
        if (table === 'medicao_fotos' && call.action === 'read') return {data: {id: fotoId, url: 'https://example.org/old.jpg', categoria: options.checklist ? 'checklist:foto' : 'visao_geral'}}
        if (table === 'medicao_revisoes' && call.action === 'read') return {data: {versao: 4}}
        if (table === 'medicao_revisoes' && call.action === 'insert') return options.auditFails ? {error: {code: 'error'}} : {data: {id: 'audit-id'}}
        if (table === 'medicao_revisoes' && call.action === 'update') return {error: options.finishFails ? {} : null}
        if (['update','delete'].includes(call.action)) return {data: options.race ? [] : [{id: itemId}], error: null}
        throw Error('Unhandled '+table)
      }
      return q
    },
  }
  const context = {exports: {}, require: name => name === 'next/server' ? {NextResponse: {json: (body, init = {}) => ({body,status: init.status || 200})}} : {supabaseAdmin: db}}
  vm.runInNewContext(compiled, context)
  const body = {itemId, tipo: options.gallery ? 'galeria' : 'larguras', fotoId, url: options.stale ? 'different.jpg' : 'https://example.org/old.jpg', motivo: 'Foto na peça errada', criado_por_id: 'forged', ...options.body}
  const response = await context.exports.POST({headers: {get: () => 'Bearer token'}, json: async () => body}, {params: {id: medicaoId}})
  return {response, calls}
}
;(async () => {
  const ok = await run()
  assert.equal(ok.response.status, 200)
  const audit = ok.calls.find(c => c.action === 'insert')
  const change = ok.calls.find(c => c.table === 'medicao_itens' && c.action === 'update')
  assert.ok(ok.calls.indexOf(audit) < ok.calls.indexOf(change))
  assert.equal(audit.value.criado_por_id, 'verified-user')
  assert.equal(audit.value.snapshot.foto_anterior, 'https://example.org/old.jpg')
  assert.deepEqual(Object.keys(change.value), ['foto_larguras_url'])
  assert.equal(change.value.foto_larguras_url, null)
  assert.ok(change.filters.some(([k,v]) => k === 'empresa_id' && v === 'empresa-A'))
  assert.ok(change.filters.some(([k,v]) => k === 'foto_larguras_url' && v === 'https://example.org/old.jpg'))
  for (const options of [{auditFails:true}, {wrongTenant:true}, {readOnly:true}, {noAuth:true}, {approved:true}, {stale:true}, {body:{motivo:''}}, {gallery:true,checklist:true}]) {
    const r = await run(options)
    assert.ok(r.response.status >= 400)
    assert.equal(r.calls.filter(c => ['medicao_itens','medicao_fotos'].includes(c.table) && ['update','delete'].includes(c.action)).length, 0)
  }
  const race = await run({race:true})
  assert.equal(race.response.status,409)
  assert.equal(race.calls.at(-1).value.snapshot.resultado,'nao_realizada')
  const pending = await run({finishFails:true})
  assert.equal(pending.response.status,200)
  assert.match(pending.response.body.mensagem,/pendente/)
  const gallery = await run({gallery:true})
  assert.equal(gallery.response.status,200)
  assert.ok(gallery.calls.find(c => c.table === 'medicao_fotos' && c.action === 'delete'))
  console.log('PASS: server actor, tenant/access checks, audit-before-delete, audit failure preserves photo, stale/concurrent photo protection, numeric measures preserved, gallery and pending outcome.')
})().catch(e => {console.error(e);process.exitCode=1})

async function testInheritance() {
  for (const result of ['excluida', 'solicitada', 'read-error']) {
    let writes = 0
    const db = {from(table) {
      const q = {select: () => q, eq: () => q, order: () => q,
        update: () => {writes++;return q}, maybeSingle: async () => ({data: table === 'medicoes_finais' ? {orcamento_id:'budget'} : {tipo_medida:'final', itens:[{foto_larguras_url:'old.jpg'}]}}),
        then: (yes,no) => Promise.resolve(table === 'medicao_itens' ? {data:[{id:itemId}]} : {data:[{snapshot:{item_id:itemId,campo:'foto_larguras_url',foto_anterior:'old.jpg',resultado:result}}],error:result === 'read-error' ? {} : null}).then(yes,no)}
      return q
    }}
    const code = ts.transpileModule(fs.readFileSync('lib/medicaoChecklistV2.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
    const ctx = {exports:{},require: name => name === './supabase' ? {supabase:db} : {listarItensMedicao:async()=>[]}}
    vm.runInNewContext(code,ctx)
    assert.equal(await ctx.exports.herdarMedidasFinaisDoOrcamento(medicaoId),false)
    assert.equal(writes,0)
  }
  console.log('PASS: excluded photos are not reimported; unavailable audit history blocks inheritance.')
}
testInheritance().catch(e => {console.error(e);process.exitCode=1})
