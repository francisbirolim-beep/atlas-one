const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function load(path, requireFn = () => ({})) {
  const context = { exports: {}, require: requireFn, console }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context)
  return context.exports
}
const regras = load('lib/medicaoChecklistRegras.ts')
const v2 = load('lib/medicaoChecklistV2.ts', name => name.includes('medicaoChecklistRegras') ? regras : {})
const item = {id:'a',tipo_esquadria:'l_suprema_janela_de_correr_02_folhas',quantidade:1,campos_extras:{}}
let campos = regras.camposAplicaveis([],item)
assert.ok(campos.some(c => c.chave === 'peitoril_mm' && c.obrigatorio))
assert.ok(!campos.some(c => c.chave === 'guarnicao'))
const comContramarco = {...item,campos_extras:{padrao_contramarco:'sim'}}
assert.ok(regras.camposAplicaveis([],comContramarco).some(c => c.chave === 'guarnicao' && c.obrigatorio))
assert.equal(regras.referenciaDaTipologia({...item,tipo_esquadria:'tela_mosquiteiro'}),'externa')
assert.equal(regras.referenciaDaTipologia({...item,tipo_esquadria:'porta_pivotante'}),'interna')
assert.ok(regras.camposAplicaveis([],{...item,tipo_esquadria:'l_30_porta_pivotante_01_folha'}).some(c=>c.chave==='lado_fechadura'))
const personalizado = {id:'f',tipo_esquadria:null,chave:'teste',nome:'teste',tipo_valor:'texto',ativo:true,ordem:100,regra_condicional:{item_id:'b'},opcoes:[],obrigatorio:true}
assert.ok(!regras.camposAplicaveis([personalizado],item).some(c=>c.chave==='teste'))
assert.ok(regras.camposAplicaveis([personalizado],{...item,id:'b'}).some(c=>c.chave==='teste'))
assert.equal(v2.statusItemChecklistV2(item,[],[]),'pendente')
const medidas = Object.fromEntries(['largura_baixo_mm','largura_meio_mm','largura_cima_mm','altura_direita_mm','altura_meio_mm','altura_esquerda_mm'].map(k=>[k,1200]))
assert.equal(v2.statusItemChecklistV2({...item,...medidas},[],[]),'em_andamento')
const extras = Object.fromEntries(campos.filter(c=>c.obrigatorio).map(c=>[c.chave,c.tipo_valor==='numero'?1200:c.tipo_valor==='foto'?'https://example.test/foto':'nao']))
assert.equal(v2.statusItemChecklistV2({...item,...medidas,campos_extras:extras},[],[]),'concluida')
assert.equal(v2.statusItemChecklistV2({...item,...medidas,altura_meio_mm:NaN,campos_extras:extras},[],[]),'em_andamento')
assert.equal(regras.valorValidoChecklist({tipo_valor:'numero'},Infinity),false)
assert.equal(regras.valorValidoChecklist({tipo_valor:'texto'},false),true)
assert.equal(regras.valorValidoChecklist({tipo_valor:'texto'},'  '),false)
console.log('PASS: tipologias reais, guarnição condicional, escopo da peça, seis medidas, conclusão e valores inválidos.')
