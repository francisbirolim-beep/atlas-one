const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const raiz = path.resolve(__dirname, '..')
const auxiliar = fs.readFileSync(path.join(raiz, 'lib/wvetroBuscaHistoricaCliente.ts'), 'utf8')
const compilado = ts.transpileModule(auxiliar, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const modulo = { exports: {} }
vm.runInNewContext(compilado, { module: modulo, exports: modulo.exports, require })
const intervalos = modulo.exports.intervalosHistoricosClienteWVetro

for (const total of [90, 365]) {
  const datas = intervalos(total, new Date('2026-10-27T11:30:00Z'))
  const dias = []
  for (const data of datas) {
    assert.ok(data.inicio <= data.fim, 'Janela cronologicamente correta')
    const msInicial = Date.parse(`${data.inicio}T00:00:00Z`)
    const msFinal = Date.parse(`${data.fim}T00:00:00Z`)
    assert.ok((msFinal - msInicial) / 86400000 <= 6, 'W.Vetro só admite até 7 dias por requisição')
    for (let d = msInicial; d <= msFinal; d += 86400000) dias.push(new Date(d).toISOString().slice(0, 10))
  }
  assert.equal(dias.length, total - 7, 'Toda a busca histórica está coberta')
  assert.equal(new Set(dias).size, total - 7, 'Sem repetir dias em chamadas diferentes')
  assert.equal([...dias].sort().at(-1), '2026-10-20', 'Termina imediatamente antes da semana recente')
  const maisAntigo = new Date(Date.parse('2026-10-27T00:00:00Z') - (total - 1) * 86400000).toISOString().slice(0, 10)
  assert.equal([...dias].sort()[0], maisAntigo, 'Começa exatamente no limite da pesquisa')
}
const rota = fs.readFileSync(path.join(raiz, 'app/api/integracoes/wvetro/orcamentos/sincronizar-cliente/route.ts'), 'utf8')
const tela = fs.readFileSync(path.join(raiz, 'components/clientes/Cliente360DashboardV2.tsx'), 'utf8')
const motor = fs.readFileSync(path.join(raiz, 'app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts'), 'utf8')
assert.match(rota, /validarPeriodoWVetro\(inicioSolicitado, fimSolicitado, 7\)/, 'Períodos acima de sete dias são rejeitados no servidor')
assert.match(rota, /if \(!inicioSolicitado\) \{\s*for \(const \[data, numeros\]/, 'A consulta manual não repete históricos antigos vinculados')
assert.match(rota, /clienteAlvoId: clienteId/, 'Busca fica restrita ao cliente correto')
assert.ok(motor.indexOf('const existenteEmOutroCliente = clienteAlvo') < motor.indexOf('const clienteResolvido = clienteAlvo'), 'Evita hidratar cadastro do cliente errado antes do bloqueio')
assert.doesNotMatch(rota, /vinculoManualValidado:\s*true/, 'Pesquisa não libera nomes incompatíveis sem autorização')
assert.match(tela, /intervalosHistoricosClienteWVetro\(diasHistorico\)/, 'Interface chama pesquisa histórica paginada')
assert.match(tela, /if\(!resp\.ok\)throw new Error/, 'Falhas são apresentadas')
assert.match(tela, /NÃO foram vinculados/, 'Outros clientes não são tratados como orçamentos deste cliente')
console.log('PASSOU: 90/365 dias sem lacunas/duplicações; 7 dias por chamada; vínculo seguro e falhas visíveis')