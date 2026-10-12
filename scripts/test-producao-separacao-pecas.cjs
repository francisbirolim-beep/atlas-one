const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mod = { exports: {} }
const transpiled = ts.transpileModule(fs.readFileSync('lib/producaoSeparacaoRegras.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
new Function('module', 'exports', transpiled)(mod, mod.exports)
const { pecaAprovadaParaSeparacao, conferirPacoteDaPeca, podeConcluirSeparacao, assinaturaListaSeparacao, vincularMateriaisGerados } = mod.exports

const item = { id: 'medicao-1', medido: true, status_medicao: 'aprovada', quantidade: 1 }
assert.equal(pecaAprovadaParaSeparacao(item), true)
assert.equal(pecaAprovadaParaSeparacao({ ...item, medido: false }), false)
assert.equal(pecaAprovadaParaSeparacao({ ...item, status_medicao: 'aguardando_conferencia' }), false)
assert.equal(pecaAprovadaParaSeparacao({ ...item, status_medicao: 'rascunho' }), false)
assert.equal(pecaAprovadaParaSeparacao({ ...item, quantidade: 2 }), false)

const snapshot = [
  { id: 'tipo-janela-1', medicao_final: { medicao_item_id: 'medicao-1' } },
  { id: 'tipo-porta-2', medicao_final: { medicao_item_id: 'medicao-2' } },
]
const mats = [
  { id: 'su007', item_ref: 'tipo-janela-1', quantidade_ajustada: 1 },
  { id: 'su280', item_ref: 'tipo-janela-1', quantidade_ajustada: 1 },
  { id: 'porta-vidro', item_ref: 'tipo-porta-2', quantidade_ajustada: 1 },
  { id: 'cancelado', item_ref: 'tipo-janela-1', quantidade_ajustada: 5, excluido: true },
]
const janela = conferirPacoteDaPeca('medicao-1', snapshot, mats)
assert.equal(janela.disponivel, true)
assert.deepEqual(janela.materiais.map(m => m.id), ['su007', 'su280'])
assert.equal(podeConcluirSeparacao(janela.materiais, ['su007'], true), false)
assert.equal(podeConcluirSeparacao(janela.materiais, ['su007', 'su280'], true), true)
assert.equal(podeConcluirSeparacao(janela.materiais, ['su007', 'su280'], false), false)
assert.equal(conferirPacoteDaPeca('medicao-3', snapshot, mats).disponivel, false)
assert.equal(conferirPacoteDaPeca('medicao-1', snapshot, []).disponivel, false)
// Com lista legada compartilhada, bloquear; com medicao_item_id, separar cada unidade.
const repetidas = [
  ...snapshot, { id: 'tipo-janela-1', medicao_final: { medicao_item_id: 'medicao-3' } },
]
assert.equal(conferirPacoteDaPeca('medicao-1', repetidas, mats).disponivel, false)
const vinculados = vincularMateriaisGerados([
  { id: 'janela-a', item_ref: 'tipo-janela-1', quantidade_ajustada: 2 },
  { id: 'janela-b', item_ref: 'tipo-janela-1', quantidade_ajustada: 2 },
  { id: 'porta-c', item_ref: 'tipo-porta-2', quantidade_ajustada: 1 },
], [
  { inicio: 0, medicaoItemId: 'medicao-1' },
  { inicio: 1, medicaoItemId: 'medicao-3' },
  { inicio: 2, medicaoItemId: 'medicao-2' },
])
assert.deepEqual(vinculados.map(m => m.medicao_item_id), ['medicao-1', 'medicao-3', 'medicao-2'])
assert.deepEqual(vinculados.map(m => m.item_ref), ['tipo-janela-1', 'tipo-janela-1', 'tipo-porta-2'])
assert.deepEqual(conferirPacoteDaPeca('medicao-1', repetidas, vinculados).materiais.map(m => m.id), ['janela-a'])
assert.deepEqual(conferirPacoteDaPeca('medicao-3', repetidas, vinculados).materiais.map(m => m.id), ['janela-b'])
assert.equal(conferirPacoteDaPeca('medicao-1', repetidas, vinculados).disponivel, true)
assert.equal(conferirPacoteDaPeca('medicao-1', repetidas, [...vinculados,
  { id: 'perfil-manual-nao-vinculado', item_ref: 'tipo-janela-1', quantidade_ajustada: 1 },
]).disponivel, false, 'Material manual sem unidade identificada não pode ser ignorado')
// Nenhuma peça fica totalmente conferida com receita técnica pendente ou quantidade zero.
assert.equal(conferirPacoteDaPeca('medicao-1', snapshot, [
  ...mats, { id: 'sem-formula', item_ref: 'tipo-janela-1', status_calculo: 'pendente_formula', quantidade_ajustada: 0 },
]).disponivel, false)
assert.equal(conferirPacoteDaPeca('medicao-1', snapshot, [
  ...mats, { id: 'zero', item_ref: 'tipo-janela-1', quantidade_ajustada: 0 },
]).disponivel, false)
assert.equal(conferirPacoteDaPeca('medicao-1', snapshot, [
  ...mats, { id: 'perfil-orfao', item_ref: 'tipo-janela-1', categoria: 'perfil', quantidade_ajustada: 1 },
]).disponivel, false)
const assinatura = assinaturaListaSeparacao('pacote-A', mats.slice(0, 2))
assert.equal(assinatura, assinaturaListaSeparacao('pacote-A', mats.slice(0, 2).reverse()))
assert.notEqual(assinatura, assinaturaListaSeparacao('pacote-B', mats.slice(0, 2)))
assert.notEqual(assinatura, assinaturaListaSeparacao('pacote-A', [
  { ...mats[0], quantidade_ajustada: 2 }, mats[1],
]))
console.log('PASS: peças aprovadas, material exclusivo, pendência independente e invalidação de listas alteradas.')
