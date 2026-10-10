// Regressão determinística da leitura de cotações, sem chamadas de IA ou de banco.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const file = path.resolve(__dirname, '../lib/cotacaoAnalise.ts')
const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText
const mod={exports:{}}
new Function('module','exports',js)(mod,mod.exports)
const {conferirProposta}=mod.exports

const lista=[
  {material_id:'1',codigo:'SU010',descricao:'Perfil A',quantidade_cotar:2,unidade:'BR',comprimento_corte_mm:600},
  {material_id:'2',codigo:'SU019',descricao:'Perfil B',quantidade_cotar:3,unidade:'BR',comprimento_corte_mm:800},
]
const itens=[
  {material_id:'1',codigo:'SU-010',descricao:'Perfil A',quantidade:2,unidade:'BR',comprimento_corte_mm:600,valor_unitario:10},
  {material_id:'2',codigo:'SU-019',descricao:'Perfil B',quantidade:3,unidade:'BR',comprimento_corte_mm:800,valor_unitario:20},
]
let a=conferirProposta(lista,itens)
assert.equal(a.resumo.completo,true)
assert.equal(a.resumo.total_comparavel,80)
assert.equal(a.resumo.conformes,2)
a=conferirProposta(lista,[itens[0]])
assert.equal(a.resumo.completo,false)
assert.equal(a.resumo.ausentes,1)
assert.equal(a.resumo.total_comparavel,null)
a=conferirProposta(lista,[{...itens[0],codigo:'SU011'},itens[1]])
assert.equal(a.resumo.codigos_divergentes,1)
a=conferirProposta(lista,[{...itens[0],quantidade:5},itens[1]])
assert.equal(a.resumo.quantidades_divergentes,1)
a=conferirProposta(lista,[{...itens[0],valor_unitario:null},itens[1]])
assert.equal(a.resumo.sem_preco,1)
a=conferirProposta(lista,[...itens,{codigo:'INTRUSO',descricao:'Item extra',quantidade:1,unidade:'UN',valor_unitario:99}])
assert.equal(a.resumo.completo,false)
assert.equal(a.resumo.extras,1)
// SKU repetido com dois cortes deve ser identificado individualmente.
a=conferirProposta([
  {...lista[0],material_id:'a'},
  {...lista[0],material_id:'b',comprimento_corte_mm:700},
],[
  {...itens[0],material_id:'a'},
  {...itens[0],material_id:'b',comprimento_corte_mm:700},
])
assert.equal(a.resumo.completo,true)
console.log('PASS: cotações — itens, códigos, quantidades, preço, faltas, extras e cortes.')
