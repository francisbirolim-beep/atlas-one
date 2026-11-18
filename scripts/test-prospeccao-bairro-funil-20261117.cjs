const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const origem = fs.readFileSync(path.join(__dirname, '../lib/prospeccaoMapa.ts'), 'utf8')
const javascript = ts.transpileModule(origem, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText
const sandbox = { exports: {}, require: () => ({}) }
vm.runInNewContext(javascript, sandbox, { filename: 'prospeccaoMapa.js' })
const { classificacaoDoStatus, pontosValidos, agruparPontosPorBairro } = sandbox.exports

assert.equal(classificacaoDoStatus('nova'), 'identificada')
assert.equal(classificacaoDoStatus('convertido'), 'convertida')
assert.equal(classificacaoDoStatus('convertido', 'orcamento'), 'orcamento')
assert.equal(classificacaoDoStatus('convertido', 'venda'), 'venda')
assert.equal(classificacaoDoStatus('sem_interesse'), 'sem_interesse')

const registros = [
  { id: '1', status: 'nova', cidade: 'José Bonifácio', bairro: 'Jardim das Flores', latitude: -21.1, longitude: -49.8 },
  { id: '2', status: 'convertido', cidade: 'Jose Bonifacio', bairro: ' jardim  das flores ', latitude: -21.11, longitude: -49.8 },
  { id: '3', status: 'nova', cidade: 'Rio Preto', bairro: 'Jardim das Flores', latitude: -20.8, longitude: -49.4 },
  { id: '4', status: 'nova', cidade: 'José Bonifácio', bairro: 'Jardim das Flores', latitude: null, longitude: null },
]
const pontos = pontosValidos(registros, { '2': 'venda' })
assert.equal(pontos.length, 3, 'Registros sem GPS não viram pinos')
assert.equal(pontos[1].classificacao, 'venda')
const bairros = agruparPontosPorBairro(pontos)
assert.equal(bairros.length, 2, 'Bairro igual em cidades diferentes continua separado')
assert.equal(bairros[0].pontos.length, 2, 'Acentos e espaços não duplicam o bairro')
console.log('OK: cores do funil, GPS e agrupamento por cidade/bairro.')
