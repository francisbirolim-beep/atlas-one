const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modulo = { exports: {} }
const js = ts.transpileModule(fs.readFileSync('lib/enderecoObra.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
new Function('module', 'exports', js)(modulo, modulo.exports)
const { formatarEnderecoObra, coordenadasDaObra } = modulo.exports

assert.equal(formatarEnderecoObra('  Avenida   Brasil ', '  177 ', '15202420'), 'Avenida Brasil, 177 - CEP 15202-420')
assert.equal(formatarEnderecoObra('Rua Alfa', 'S/N', ''), 'Rua Alfa, S/N')
assert.equal(formatarEnderecoObra('Rua Alfa', ' 8A ', '15202-420'), 'Rua Alfa, 8A - CEP 15202-420')
assert.equal(formatarEnderecoObra('', '', '15202420'), '')
assert.equal(coordenadasDaObra(-21.05281234, -49.69011234), '-21.052812,-49.690112')
for (const coords of [[NaN,0], [0,Infinity], [91,0], [0,181], [-91,0]]) {
  assert.equal(coordenadasDaObra(...coords), null)
}
const pag = fs.readFileSync('app/orcamento-rapido/page.tsx', 'utf8')
const api = fs.readFileSync('app/api/geocodificacao/reversa/route.ts','utf8')
const persistence = fs.readFileSync('lib/orcamentos.ts','utf8')
for(const token of [
  'obraNome', 'obraRua', 'obraNumero', 'obraBairro', 'obraCep', 'obraLocalizacao',
  'setObraNome(d.obraNome', 'setObraRua(d.obraRua', 'setObraNumero(d.obraNumero',
  'setObraLocalizacao(d.obraLocalizacao', 'cidade, obraNome, obraRua, obraNumero, obraBairro, obraCep, obraLocalizacao',
  'obraEndereco: formatarEnderecoObra(', 'obraCidade: cidade.trim()', 'obraLocalizacao,',
  'capturarEnderecoDaObra', 'navigator.geolocation.getCurrentPosition',
  '/api/geocodificacao/reversa',
]) assert.ok(pag.includes(token), 'Falta campo ou integração: ' + token)
assert.match(pag,/if \(obraCep\.trim\(\) && !\/\^\\d\{5\}-\?\\d\{3\}\$\/\.test/)
assert.ok(api.includes('cep: address.postcode'))
assert.ok(persistence.includes('obraNome?.trim()'))
assert.ok(persistence.includes('endereco: obraEndereco?.trim()'))
assert.ok(persistence.includes('observacoes: obraLocalizacao?.trim()'))
assert.ok(pag.includes("salvarPendente({ id: uuidv4(), tipo: 'orcamento'"))
console.log('PASS: obra/endereco/GPS/número/CEP, autosave, fila offline e vínculo com obra.')
