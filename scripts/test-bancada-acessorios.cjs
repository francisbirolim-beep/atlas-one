const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const Module = require('node:module')
const resolverOriginal = Module._resolveFilename
Module._resolveFilename = function (requisicao, ...resto) {
  if (requisicao.startsWith('@/')) requisicao = path.resolve(__dirname, '..', requisicao.slice(2)) + '.ts'
  return resolverOriginal.call(this, requisicao, ...resto)
}

require.extensions['.ts'] = (mod, filename) => {
  const conteudo = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(conteudo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  mod._compile(js, filename)
}
const { conferirAcessorios, lerListaAcessorios } = require('../lib/bancadaAcessorios.ts')
const definicao = { tipologia_id: 'teste', variaveis: [], folgas: { largura_mm: 4, altura_mm: 4 },
  pecas: [{codigo:'SU001',formula:'Largura - 10',eixo:'L',formula_quantidade:'2'}] }
const caso = { nome:'porta integrada', largura_mm:1500,altura_mm:2300,opcoes:{},folgas:{largura_mm:4,altura_mm:4},
  cortes:[{codigo:'SU001',eixo:'L',comprimento_mm:1490,quantidade:2}],
  acessorios: lerListaAcessorios('AC001;4\nAC002;2') }
const formulas = [
  {codigo:'AC001', formula_quantidade:'4'},
  {codigo:'AC002', formula_quantidade:'2'},
]
assert.equal(conferirAcessorios(definicao,formulas,caso).ok,true)
assert.equal(conferirAcessorios(definicao,formulas,{...caso,acessorios:[]}).ok,false)
assert.equal(conferirAcessorios(definicao,formulas,{...caso,acessorios:[{codigo:'AC001',quantidade:4}]}).ok,false)
assert.equal(conferirAcessorios(definicao,formulas,{...caso,acessorios:[...caso.acessorios,{codigo:'EXTRA',quantidade:1}]}).ok,false)
assert.equal(conferirAcessorios(definicao,[{codigo:'AC001',formula_quantidade:'Folhas * 2'},formulas[1]],caso).ok,false)
assert.throws(()=>lerListaAcessorios('AC001;0'), /válida/)
assert.throws(()=>lerListaAcessorios('BAD NAME;2'), /válida/)
console.log('OK: acessórios conforme, ausentes, extras, fórmulas alteradas e entrada inválida.')
