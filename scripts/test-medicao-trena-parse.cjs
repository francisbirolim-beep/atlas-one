const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const typescript = require('typescript')
const fonte = fs.readFileSync(path.resolve(__dirname, '../lib/medicaoTrenaParse.ts'), 'utf8')
const js = typescript.transpileModule(fonte, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 },
}).outputText
const mod = { exports: {} }
new Function('module', 'exports', js)(mod, mod.exports)
const ler = mod.exports.extrairMedidasMmDeResposta

assert.deepEqual(ler('{"medidas_mm":[1195,1195,1193]}'), [1195,1195,1193])
assert.deepEqual(ler('{"medidas_mm":["1.195 m","1.195 m","1.193 m"]}'), [1195,1195,1193])
assert.deepEqual(ler('{"medidas_mm":[1.195,1.195,1.193]}'), [1195,1195,1193])
assert.deepEqual(ler('{"medidas_mm":["2.373 m","2.373 m","2.373 m"]}'), [2373,2373,2373])
assert.deepEqual(ler('{"medidas_cm":[119.5,119.5,119.3]}'), [1195,1195,1193])
assert.deepEqual(ler('{"medidas_mm":[{"valor":"1.195","unidade":"m"},1195,"1.193 m"]}'), [1195,1195,1193])
assert.deepEqual(ler('{"medidas_mm":["1.195 m", "ilegivel", "1.193 m"]}'), [1195,1193])
assert.deepEqual(ler('{"medidas_mm":[-1,20000,null]}'), [])
assert.deepEqual(ler('{"medidas_mm":[1195,1195,1193,1194]}'), [])
assert.deepEqual(ler('Não consegui ver os números'), [])
console.log('OK: 10 cenários de regressão da trena.')
