const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const file = path.resolve(__dirname, '../lib/bancadaCriacaoTipologia.ts')
const source = fs.readFileSync(file, 'utf8')
const transpiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
}}).outputText
const m = new Module(file, module)
m.filename = file
m.paths = module.paths
m._compile(transpiled, file)
const { normalizarComponentes, extrairCortesTexto, extrairRespostaIA, formulaHipotese, tipoCroquiSeguro } = m.exports

assert.equal(normalizarComponentes([{codigo:' SU005 ',tipo:'perfil',eixo:'L',quantidade:2,comprimento_mm:'1496,5'}])[0].comprimento_mm,1496.5)
assert.equal(normalizarComponentes([{codigo:'bad code',eixo:'L',comprimento_mm:1000,quantidade:1}]).length,0)
assert.equal(normalizarComponentes([{codigo:'SU005',eixo:'L',comprimento_mm:1000,quantidade:0}]).length,0)
assert.equal(normalizarComponentes([{codigo:'SU005',eixo:'L',comprimento_mm:999999,quantidade:1}]).length,0)
const cortes = extrairCortesTexto('SU001;L;1492;2\nSU002;H;2294;2\ntelefone 1722')
assert.equal(cortes.length,2)
assert.equal(cortes[0].codigo,'SU001')
assert.equal(cortes[1].eixo,'H')
const ia = extrairRespostaIA('```json\n{"componentes":[{"codigo":"SU010","descricao":"marco","tipo":"perfil","eixo":"L","comprimento_mm":1450,"quantidade":2}],"tipo_croqui":"integrada"}\n```')
assert.equal(ia.componentes.length,1)
assert.equal(ia.tipo_croqui,'integrada')
assert.equal(tipoCroquiSeguro('Porta Integrada'),'integrada')
assert.equal(formulaHipotese(cortes[0],1500,2300).formula,'Largura - 8')
assert.equal(formulaHipotese(cortes[1],1500,2300).formula,'Altura - 6')
assert.match(formulaHipotese(cortes[0],1500,2300).composicao_desconto,/HIPÓTESE/)
console.log('OK: normalização, extração, hipótese e croqui paramétrico seguros.')
