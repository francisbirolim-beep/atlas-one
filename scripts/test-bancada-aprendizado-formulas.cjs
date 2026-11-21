const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const file = path.resolve(__dirname, '../lib/bancadaAprendizadoFormulas.ts')
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
}}).outputText
const m = new Module(file, module)
m.filename=file;m.paths=module.paths;m._compile(js,file)
const {inferirFormulasPorCasos} = m.exports
const criar = (largura,altura,medida,folha,quantidade=2) => ({caso:{
  largura_mm:largura,altura_mm:altura,opcoes:{},
  cortes:[
    {codigo:'SU001',eixo:'L',comprimento_mm:largura-48,quantidade:1},
    {codigo:'MN003',eixo:'H',comprimento_mm:altura-4,quantidade:2},
    {codigo:'SU053',eixo:'L',comprimento_mm:largura/2-96,quantidade:2},
    {codigo:'SU102',eixo:'L',comprimento_mm:largura/2-96,quantidade:4},
    {codigo:'SU102',eixo:'H',comprimento_mm:altura-395,quantidade:4},
    {codigo:'VZP-4558',eixo:'L',comprimento_mm:largura-124,quantidade},
  ]
}})
const um=criar(1500,2300)
const dois=criar(1700,2300)
const tres=criar(1500,2500)
let resultado=inferirFormulasPorCasos([um],{})
assert.equal(resultado.find(p=>p.codigo==='SU001').estado,'pendente','um PDF nao prova desconto')
resultado=inferirFormulasPorCasos([um,dois],{})
assert.equal(resultado.find(p=>p.codigo==='SU001').formula,'Largura - 48')
assert.equal(resultado.find(p=>p.codigo==='SU053').formula,'Largura / 2 - 96')
assert.equal(resultado.find(p=>p.codigo==='MN003').estado,'pendente','altura fixa nao permite validar regra H')
resultado=inferirFormulasPorCasos([um,dois,tres],{})
assert.equal(resultado.find(p=>p.codigo==='MN003').formula,'Altura - 4')
assert.equal(resultado.find(p=>p.codigo==='SU102'&&p.eixo==='H').formula,'Altura - 395')
assert.equal(resultado.find(p=>p.codigo==='SU053').estado,'consistente')
assert.equal(resultado.filter(p=>p.codigo==='SU102').length,2)
const errados=criar(1600,2400)
errados.caso.cortes.find(p=>p.codigo==='SU001').comprimento_mm=1300
resultado=inferirFormulasPorCasos([um,dois,tres,errados],{})
assert.equal(resultado.find(p=>p.codigo==='SU001').estado,'pendente','exemplo incoerente nao pode ser homologado')
const variante=criar(1900,2600)
variante.caso.opcoes={trilho:'alto'}
assert.equal(inferirFormulasPorCasos([um,dois,tres,variante],{}).find(p=>p.codigo==='SU001').amostras,3)
const ambiguos=criar(1500,2300); ambiguos.caso.cortes.push({codigo:'SU001',eixo:'L',comprimento_mm:1000,quantidade:1})
assert.equal(inferirFormulasPorCasos([ambiguos,dois],{}).find(p=>p.codigo==='SU001').estado,'pendente')
console.log('OK: aprendizagem supervisionada, 2-3 medidas, eixos repetidos, variantes e conflitos')
