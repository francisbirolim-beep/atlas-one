// Regressão: um remate F42-014 nunca deve herdar o desenho do batente F42-012.
// Não acessa o banco nem altera produtos aplicados.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const mod = {exports: {}}
const script = ts.transpileModule(
  fs.readFileSync('lib/ai/catalogoImagemReferencia.ts','utf8'),
  {compilerOptions:{module: ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}
).outputText
vm.runInNewContext(script,{module:mod,exports:mod.exports})
const {mesmaReferenciaCatalogo} = mod.exports

assert.equal(mesmaReferenciaCatalogo('F42-014','F42-014'), true)
assert.equal(mesmaReferenciaCatalogo('f42 - 014','F42-014'), true)
assert.equal(mesmaReferenciaCatalogo('F42-014','F42-012'), false,
  'Remate não pode herdar imagem do batente')
assert.equal(mesmaReferenciaCatalogo('F42-012','F42-014'), false)
assert.equal(mesmaReferenciaCatalogo('FLG-162','FLG-164'), false)
assert.equal(mesmaReferenciaCatalogo('F42-014',''), false)
assert.equal(mesmaReferenciaCatalogo('','F42-014'), false)
assert.equal(mesmaReferenciaCatalogo('',''), false)
console.log('PASS: fotos reaproveitadas só para o mesmo código individual, sem herdar desenhos vizinhos.')
