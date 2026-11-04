// Teste isolado da ordenação de abas, sem navegador ou banco de dados.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const fonte = fs.readFileSync(path.join(__dirname, '../lib/ordemAbasObra.ts'), 'utf8')
const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const modulo = { exports: {} }
new Function('module', 'exports', codigo)(modulo, modulo.exports)
const { ORDEM_ABAS_OBRA_PADRAO: padrao, normalizarOrdemAbasObra: normalizar, moverAbaObra: mover, salvarOrdemAbasObra: salvar, lerOrdemAbasObra: ler } = modulo.exports

assert.equal(padrao.length, 12)
assert.deepEqual(normalizar(null), padrao)
assert.deepEqual(normalizar(['compras', 'compras', 'nao-existe', 'visao']).slice(0, 2), ['compras', 'visao'])
assert.equal(normalizar(['compras']).length, 12)
assert.deepEqual(mover(padrao, 'visao', 'historico').slice(-2), ['historico', 'visao'])
assert.deepEqual(mover(padrao, 'historico', 'visao').slice(0, 2), ['historico', 'visao'])
assert.deepEqual(mover(padrao, 'visao', 'visao'), padrao)

const dados = new Map()
global.window = { localStorage: {
  getItem: chave => dados.get(chave) ?? null,
  setItem: (chave, valor) => { dados.set(chave, valor) },
}}
const ordemFrancis = mover(padrao, 'compras', 'visao')
assert.equal(salvar('usuario-francis', ordemFrancis), true)
assert.deepEqual(ler('usuario-francis'), ordemFrancis)
assert.deepEqual(ler('outro-usuario'), padrao)
assert.equal(salvar('', ordemFrancis), false)
console.log('OK: ordenação, restauração, deduplicação e persistência separada por usuário.')
