const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = function(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  module._compile(transpiled, filename)
}
const {calcularFormulasCorte,calcularFormulaCorteIsolada,FormulaCorteError} = require('../lib/formulasCorteEngine.ts')
const w = 'CEIL((LF - 162 - 19 * (Folhas - 2)) / Folhas)'
const variaveis=[{chave:'numero_folhas',label:'Folhas',opcoes:['2','3','4','5','6']}]
const pecas = [
  {codigo:'SU053',descricao:'Travessa superior',formula:w,formula_quantidade:'Folhas'},
  {codigo:'SU225',descricao:'Travessa inferior',formula:w,formula_quantidade:'Folhas'},
  {codigo:'SU102',descricao:'Baguete horizontal',formula:w,formula_quantidade:'2 * Folhas'},
  {codigo:'SU102',descricao:'Baguete vertical',formula:'HF - 181',formula_quantidade:'2 * Folhas'},
  {grupo:'marco_superior',descricao:'Marco superior',variaveis_chave:['numero_folhas'], mapa_codigo:{'2':'SU001','3':'SU010','4':'SU121','5':'SU605'},formula:'LF - 26'},
]
for (const [n, travessa] of [[2,1167],[3,772],[4,574],[5,456]]) {
  const out=calcularFormulasCorte({tipologia_id:'teste',variaveis,pecas},2500,2200,{numero_folhas:String(n)})
  const got=out.filter(p=>['SU053','SU225'].includes(p.codigo))
  assert.equal(got.length,2)
  for (const p of got) { assert.equal(p.tamanho,travessa, `${n} folhas ${p.codigo}`);assert.equal(p.quantidade,n) }
  assert.equal(calcularFormulaCorteIsolada(`${w} - 6`,2500,2200,n),travessa-6)
  assert.equal(out.find(p=>p.codigo==='SU102' && p.descricao==='Baguete vertical').tamanho,2015)
  console.log(`${n} folhas: travessa ${travessa}mm, vidro ${travessa-6} x 2033mm, marco confirmado`)
}
assert.throws(()=>calcularFormulasCorte({tipologia_id:'teste',variaveis,pecas},2500,2200,{numero_folhas:'6'}),e=>e instanceof FormulaCorteError && /codigo de perfil/.test(e.message))
const soTrav = pecas.filter(p=>['SU053','SU225'].includes(p.codigo))
const seis=calcularFormulasCorte({tipologia_id:'teste',variaveis,pecas:soTrav},2500,2200,{numero_folhas:'6'})
assert.equal(seis[0].tamanho,377)
assert.equal(seis[1].tamanho,377)
assert.equal(calcularFormulaCorteIsolada(`${w} - 6`,2500,2200,6),371)
assert.equal(calcularFormulasCorte({tipologia_id:'teste',variaveis:[],pecas:[{codigo:'SU053',formula:'FLOOR(574.3)'}]},2500,2200,{})[0].tamanho,575)
assert.equal(calcularFormulasCorte({tipologia_id:'teste',variaveis:[],pecas:[{codigo:'SU999',formula:'574.3'}]},2500,2200,{})[0].tamanho,574.3)
console.log('6 folhas: travessa 377mm, vidro 371 x 2033mm; marco sem referencia bloqueia plano completo.')
console.log('OK: 2-6 folhas, arredondamento, legado inalterado e bloqueio de marco desconhecido.')