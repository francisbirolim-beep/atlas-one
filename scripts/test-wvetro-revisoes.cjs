// Regressão sem banco/rede: importação de revisões do mesmo orçamento WVetro.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')

const origem = fs.readFileSync(path.join(__dirname, '../lib/wvetroOrcamentoDiff.ts'), 'utf8')
const js = ts.transpileModule(origem, { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
}}).outputText
const modulo = { exports: {} }
vm.runInNewContext(js, { module: modulo, exports: modulo.exports, console })
const comparar = modulo.exports.compararVersoesOrcamentoWVetro

const janela = (id, largura, altura=1000, modelo='Janela veneziana') => ({
  Id: id, Modelo: modelo, Linha: 'Suprema', Ambiente: 'Quarto',
  Largura: largura, Altura: altura, Qtde: 1,
})
const original = { Nro: 1171, Itens: [janela(101, 1500)], Total: 1000, Situacao: 'Em aberto' }
function diff(outro) { return comparar(original, outro) }

assert.equal(diff(structuredClone(original)).length, 0, 'Mesmo número e itens iguais não gera alerta')
assert.equal(diff({ ...original, AtualizadoEm: '2026-10-13' }).length, 0, 'Ruído de integração não vira alteração')
const acrescentado = diff({ ...original, Itens: [...original.Itens, janela(102, 2000)] })
assert.equal(acrescentado.length, 1, 'Janela nova gera apenas um aviso')
assert.equal(acrescentado[0].tipo, 'incluido')
assert.match(acrescentado[0].depois, /2000 × 1000/)
const medida = diff({ ...original, Itens: [janela(101, 2000)] })
assert.equal(medida.length, 1, 'Mudança de medida não cria novo orçamento')
assert.equal(medida[0].campo, 'Largura (mm)')
assert.equal(medida[0].antes, '1500')
assert.equal(medida[0].depois, '2000')
const tipo = diff({ ...original, Itens: [janela(101, 1500, 1000, 'Janela de correr')] })
assert.equal(tipo.length, 1, 'Troca de tipologia é uma alteração')
assert.equal(tipo[0].campo, 'Tipologia')
const excluido = diff({ ...original, Itens: [] })
assert.equal(excluido.length, 1)
assert.equal(excluido[0].tipo, 'removido')
const preco = diff({ ...original, Total: 1500 })
assert.equal(preco.length, 1)
assert.equal(preco[0].campo, 'Valor total')
const reordenado = comparar({ ...original, Itens: [janela(101, 1500), janela(102, 2000)] },
  { ...original, Itens: [janela(102, 2000), janela(101, 1500)] })
assert.equal(reordenado.length, 0, 'Reordenação sem mudança não cria alerta')
console.log('OK: 8 cenários de revisão de orçamento W.Vetro')
