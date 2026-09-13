const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')
function load(file, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, console, require: name => dependencies[name] || {} })
  return exports
}
const helpers = load('lib/wvetroSyncDados.ts')
test('percorre os 1177 produtos sem perder o final do catálogo', async () => {
  const rows = Array.from({ length: 1177 }, (_, id) => ({ id }))
  const actual = await helpers.lerTodasPaginas(async (a, b) => ({ data: rows.slice(a, b + 1), error: null }))
  assert.equal(actual.length, 1177)
  assert.equal(actual[1176].id, 1176)
})
test('erro na segunda página não retorna sucesso parcial', async () => {
  await assert.rejects(helpers.lerTodasPaginas(async a => a ? { error: new Error('offline') } : { data: Array(500).fill({}) }), /offline/)
})
test('aliases do mesmo produto não criam ambiguidade; produtos diferentes sim', () => {
  assert.equal(helpers.candidatosUnicos([{ id: 'a' }, { id: 'a' }]).length, 1)
  assert.equal(helpers.candidatosUnicos([{ id: 'a' }, { id: 'b' }]).length, 2)
})
test('preserva a mensagem de erro retornada pelo PostgREST como objeto', () => {
  assert.equal(helpers.mensagemErroWVetro({ message: 'constraint violation' }), 'constraint violation')
})
test('linha exata é associada sem sobrescrever linha existente nem inferir Suprema pelo nome', async () => {
  const rows = {
    linhas: [{ id: 'suprema', nome: 'L. SUPREMA' }],
    wvetro_produtos_snapshot: [
      { produto_atlas_id: 'sem-linha', linha_nome_wvetro: 'L. SUPREMA' },
      { produto_atlas_id: 'manual', linha_nome_wvetro: 'L. SUPREMA' },
      { produto_atlas_id: 'geral', linha_nome_wvetro: 'GERAL' },
      { produto_atlas_id: 'ambiguo', linha_nome_wvetro: 'L. SUPREMA' },
      { produto_atlas_id: 'ambiguo', linha_nome_wvetro: 'GERAL' },
    ],
  }
  const products = { 'sem-linha': null, manual: 'outra', geral: null, ambiguo: null }
  const admin = { from(table) {
    let patch, id
    const q = {
      select() { return q }, order() { return q }, not() { return q },
      eq(key, value) { if (key === 'id') id = value; return q },
      range(a, b) { return Promise.resolve({ data: rows[table].slice(a, b + 1), error: null }) },
      update(value) { patch = value; return q },
      is(key, value) { assert.equal(key, 'linha_id'); assert.equal(value, null); return q },
      then(resolve) {
        if (products[id] === null) { products[id] = patch.linha_id; resolve({ data: [{ id }], error: null }) }
        else resolve({ data: [], error: null })
      },
    }
    return q
  } }
  const module = load('lib/wvetroCatalogoCompletoServer.ts', {
    '@/lib/supabaseAdmin': { supabaseAdmin: admin }, './wvetroSyncDados': helpers,
  })
  assert.equal((await module.reconciliarLinhasCatalogoWVetro()).atualizadas, 1)
  assert.deepEqual(products, { 'sem-linha': 'suprema', manual: 'outra', geral: null, ambiguo: null })
})
