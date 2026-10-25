const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (mod, file) => {
  const source = fs.readFileSync(file, 'utf8')
  mod._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, file)
}
const { permissaoExplicitaPainelGeral: permite } = require('../lib/painelGeralAcesso.ts')
const geral = 'visao-geral-projetos'
const instalacoes = 'relatorios-instalacoes'
for (const painel of [geral, instalacoes]) {
  assert.equal(permite('master', null, painel), true, 'Master sempre tem consulta')
  assert.equal(permite('funcionario', null, painel), false, 'Sem registro: negar')
  assert.equal(permite('funcionario', {}, painel), false, 'Sem ações: negar')
  assert.equal(permite('funcionario', { acoes: { setor_compras: 'edicao' } }, painel), false,
    'Permissão de outro setor não é suficiente')
}
for (const nivel of ['consulta', 'edicao']) {
  assert.equal(permite('funcionario', { acoes: { painel_visao_geral_projetos: nivel } }, geral), true)
  assert.equal(permite('funcionario', { acoes: { painel_visao_geral_projetos: nivel } }, instalacoes), false)
  assert.equal(permite('funcionario', { acoes: { painel_relatorio_instalacoes: nivel } }, instalacoes), true)
  assert.equal(permite('funcionario', { acoes: { painel_relatorio_instalacoes: nivel } }, geral), false)
}
for (const nivel of ['oculto', 'liberado', true, undefined, '']) {
  assert.equal(permite('funcionario', { acoes: { painel_visao_geral_projetos: nivel } }, geral), false)
  assert.equal(permite('funcionario', { acoes: { painel_relatorio_instalacoes: nivel } }, instalacoes), false)
}
assert.equal(permite('funcionario', { acoes: { painel_visao_geral_projetos: 'consulta' } }, geral), true)
assert.equal(permite('funcionario', { acoes: { painel_relatorio_instalacoes: 'consulta' } }, instalacoes), true)
console.log('PASS: ACL explícita, isolamento entre painéis, Master, oculto e negação padrão.')
