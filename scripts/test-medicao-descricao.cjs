const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const source = fs.readFileSync('lib/medicaoDescricao.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { descricaoItemMedicao, identificarItensMedicao } = context.exports

const descricaoPdf = 'JANELA DE CORRER 02 FOLHAS | LINHA: SUPREMA | VIDRO: INCOLOR 6 MM'
assert.equal(descricaoItemMedicao({ descricao: descricaoPdf, ambiente: 'SALA' }), descricaoPdf)
assert.equal(descricaoItemMedicao({ tipo_outro_texto: 'JANELA DE CORRER', folhas: '2', ambiente: 'SALA' }), 'JANELA DE CORRER 2 folhas — SALA')
assert.equal(descricaoItemMedicao({ tipo_outro_texto: 'PORTA 3 FOLHAS', folhas: '3' }), 'PORTA 3 FOLHAS')

const origem = ['SALA', 'COZINHA'].map(ambiente => ({ tipo_esquadria: 'janela', tipo_outro_texto: 'Janela de correr', folhas: '2', ambiente, quantidade: 1 }))
const itens = origem.map((o, ordem) => ({ id: `peca-${ordem}`, ordem, tipo_esquadria: o.tipo_esquadria, quantidade: 1, descricao: `Item ${ordem + 1}`, largura_baixo_mm: 1234, medido: true, campos_extras: { padrao_arremate: 'sim' }, foto_larguras_url: 'foto-salva' }))
const resolvidos = identificarItensMedicao(itens, origem)
assert.match(resolvidos[0].descricao, /SALA$/)
assert.match(resolvidos[1].descricao, /COZINHA$/)
for (let i = 0; i < itens.length; i++) {
  assert.equal(resolvidos[i].id, itens[i].id)
  assert.equal(resolvidos[i].largura_baixo_mm, 1234)
  assert.equal(resolvidos[i].foto_larguras_url, 'foto-salva')
  assert.equal(resolvidos[i].campos_extras, itens[i].campos_extras)
  assert.equal(itens[i].descricao, `Item ${i + 1}`)
}
assert.equal(identificarItensMedicao([{ ...itens[0], descricao: descricaoPdf }], [origem[0]])[0].descricao, descricaoPdf)
// A split unit, missing row, changed type or changed quantity must not inherit another item's description.
for (const alterados of [[itens[0]], [{ ...itens[0], ordem: 1 }, itens[1]], [{ ...itens[0], tipo_esquadria: 'porta' }, itens[1]], [{ ...itens[0], quantidade: 2 }, itens[1]]]) {
  assert.ok(!identificarItensMedicao(alterados, origem)[0].descricao.includes('SALA'))
}
console.log('PASS: descrição do PDF, folhas, ambientes, preservação de respostas e pareamento conservador.')
