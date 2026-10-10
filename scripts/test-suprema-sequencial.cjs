const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const path = require('node:path')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(process.cwd(), request.slice(2)) : request, ...args)
}
require.extensions['.ts'] = function(module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename)
}
const { calcularFormulasCorte, calcularFormulaCorteIsolada } = require('../lib/formulasCorteEngine.ts')
const { calcularAcessoriosTecnicos } = require('../lib/formulasAcessoriosEngine.ts')
const regra = 'CEIL((LF - 162 - 19 * (Folhas - 2)) / Folhas)'
const variaveis = [{ chave: 'numero_folhas', label: 'Quantidade de folhas', opcoes: ['2','3','4','5','6'] }]
const cond6 = { numero_folhas: ['6'] }
const cond2a5 = { numero_folhas: ['2','3','4','5'] }
const pecas = [
  { grupo: 'marco_superior', mapa_codigo: { '2':'SU001','3':'SU010','4':'SU121','5':'SU605' },
    variaveis_chave: ['numero_folhas'], formula: 'LF - 26', quantidade: 1, condicao_ativa: cond2a5 },
  { codigo: 'TMC', formula: 'LF - 26', formula_quantidade: 'Folhas' },
  { grupo: 'marco_lateral', mapa_codigo: { '2':'SU007','3':'SU012','4':'SU123','5':'SU607' },
    variaveis_chave: ['numero_folhas'], formula: 'HF', quantidade: 2, condicao_ativa: cond2a5 },
  { codigo: 'SU008', formula: 'HF - 13', quantidade: 2, condicao_ativa: cond2a5 },
  { codigo: 'SU053', descricao: 'Travessa superior', formula: regra, formula_quantidade: 'Folhas' },
  { codigo: 'SU225', descricao: 'Travessa inferior', formula: regra, formula_quantidade: 'Folhas' },
  { codigo: 'SU280', formula: 'HF - 30', quantidade: 2 },
  { codigo: 'SU040', formula: 'HF - 30', formula_quantidade: 'Folhas - 1' },
  { codigo: 'SU041', formula: 'HF - 30', formula_quantidade: 'Folhas - 1' },
  { codigo: 'SU102', descricao: 'Baguete horizontal', formula: regra, formula_quantidade: '2 * Folhas' },
  { codigo: 'SU102', descricao: 'Baguete vertical', formula: 'HF - 181', formula_quantidade: '2 * Folhas' },
  { codigo: 'SU018', formula: 'LF - 26', quantidade: 2, condicao_ativa: cond6 },
  { codigo: 'SU271', formula: 'LF - 26', quantidade: 6, condicao_ativa: cond6 },
  { codigo: 'SU012', formula: 'HF', quantidade: 4, condicao_ativa: cond6 },
  { codigo: 'SU291', formula: 'HF - 17', quantidade: 2, condicao_ativa: cond6 },
  { codigo: 'SU107', formula: '21', quantidade: 20, condicao_ativa: cond6 },
  { codigo: 'SU107', formula: '32', quantidade: 4, condicao_ativa: cond6 },
]
const def = { tipologia_id: 'teste-2a6', variaveis, pecas, folgas: { largura_mm: 4, altura_mm: 4 } }
function encontrar(linhas, codigo, tamanho, quantidade) {
  return linhas.some(p => p.codigo === codigo && p.tamanho === tamanho && p.quantidade === quantidade)
}
for (const [folhas, corte] of [[2,1167],[3,772],[4,574],[5,456],[6,377]]) {
  const linhas = calcularFormulasCorte(def, 2500, 2200, { numero_folhas: String(folhas) })
  assert.ok(encontrar(linhas, 'SU053', corte, folhas), folhas + 'F superior')
  assert.ok(encontrar(linhas, 'SU225', corte, folhas), folhas + 'F inferior')
  assert.ok(encontrar(linhas, 'SU102', corte, 2 * folhas), folhas + 'F baguete horizontal')
  assert.ok(encontrar(linhas, 'SU102', 2015, 2 * folhas), folhas + 'F baguete vertical')
  assert.equal(calcularFormulaCorteIsolada(regra + ' - 6', 2500, 2200, folhas, def.folgas), corte - 6)
  assert.equal(calcularFormulaCorteIsolada('HF - 163', 2500, 2200, folhas, def.folgas), 2033)
  if (folhas === 6) {
    for (const [codigo, tamanho, quantidade] of [
      ['SU018',2470,2],['SU271',2470,6],['TMC',2470,6],['SU012',2196,4],
      ['SU291',2179,2],['SU280',2166,2],['SU040',2166,5],['SU041',2166,5],
      ['SU107',21,20],['SU107',32,4]
    ]) assert.ok(encontrar(linhas,codigo,tamanho,quantidade), '6F perfil '+codigo+' '+tamanho)
    assert.equal(linhas.length,14)
    const acessorios = [
      ['NYL332','4 * Folhas'],['NYL414','4 * (Folhas - 1)'],
      ['FRA820','2'],['CON409','2'],['RPCS100','2 * Folhas'],
      ['FIT206','(HF - 30) * (Folhas - 1) / 1000'],['FIT246','(HF - 30) * 4 / 1000'],
      ['FIT212','Largura * 4 / 1000'],['GUA258','(HF - 30) * 2 * Folhas / 1000'],
      ['GUA171','SU053 * 2 * Folhas / 1000'],['GUA259','GUA258 + GUA171'],
      ['PAR435','8'],['PAR435','6 * Folhas'],['NYL042','6 * Folhas'],
      ['PAR1023','12'],['PAR1037','CEIL(Largura / 500) + 2 * CEIL(Altura / 500)'],
      ['BUC755','CEIL(Largura / 500) + 2 * CEIL(Altura / 500)'],['SIL-PU','(Largura * 2 + Altura * 2) / 6000']
    ].map(([codigo,formula_quantidade]) => ({codigo, formula_quantidade,status:'validada'}))
    const calculados = calcularAcessoriosTecnicos(acessorios,2500,2200,6,linhas,{numero_folhas:'6'},def.folgas)
    assert.equal(calculados.length,18)
    assert.ok(calculados.every(a=>a.ativo!==false&&!a.erro&&Number.isFinite(a.valor)))
    const esp=[24,20,2,2,12,10.83,8.664,10,25.992,4.524,30.516,8,36,36,12,15,15,1.5666666667]
    calculados.forEach((a,i)=>assert.ok(Math.abs(a.valor-esp[i])<0.00001, '6F acessorio '+acessorios[i].codigo))
  }
  console.log(folhas + 'F: travessa ' + corte + ' mm, vidro ' + (corte-6) + ' × 2033 mm')
}
assert.throws(()=>calcularFormulasCorte(def,2500,2200,{numero_folhas:'7'}))
assert.equal(calcularFormulasCorte({tipologia_id:'legada',variaveis:[],pecas:[{codigo:'SU999',formula:'574.3'}]},2500,2200,{})[0].tamanho,574.3)
assert.equal(calcularFormulasCorte({tipologia_id:'teste-folga',variaveis,pecas:[{codigo:'SU040',formula:'HF - 30'}],folgas:{largura_mm:5,altura_mm:6}},2500,2200,{numero_folhas:'2'})[0].tamanho,2164)
console.log('OK: 2–6 folhas, 6 planos, 14 perfis, 18 acessórios, CEIL, 4 mm de folga configurável e legado intacto.')
