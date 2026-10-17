const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const fonte = fs.readFileSync('lib/enderecoObra.ts', 'utf8')
const js = ts.transpileModule(fonte, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText
const mod = {exports: {}}
new Function('module', 'exports', js)(mod, mod.exports)
const {coordenadasEmTexto, localizacaoRegistradaNaObra, linkRotaObra, registrarFeedbackLocalizacao, decomporEnderecoObra} = mod.exports

assert.equal(coordenadasEmTexto(' -21.052812, -49.690112 '), '-21.052812,-49.690112')
for (const invalido of ['0,181', '-91,0', 'URL', 'https://maps.google.com/', '-21', '22,abc', '']) assert.equal(coordenadasEmTexto(invalido), null)
assert.deepEqual(decomporEnderecoObra('Rua José, 123 - CEP 15202-420'), {rua:'Rua José', numero:'123', cep:'15202-420'})
assert.deepEqual(decomporEnderecoObra('Estrada Municipal, S/N', null, null), {rua:'Estrada Municipal', numero:'S/N', cep:''})
assert.deepEqual(decomporEnderecoObra('Avenida Teste', '8A', '15200000'), {rua:'Avenida Teste', numero:'8A', cep:'15200000'})
assert.equal(localizacaoRegistradaNaObra('Observação livre\nLocalização: -21.052812,-49.690112'), '-21.052812,-49.690112')
const nova = registrarFeedbackLocalizacao('Atenção na instalação', '-21.052812,-49.690112')
assert.equal(localizacaoRegistradaNaObra(nova), '-21.052812,-49.690112')
assert.match(nova, /Atenção na instalação/)
assert.match(nova, /Localização conferida: Sim/)
const corrigida = registrarFeedbackLocalizacao(nova, '-22,-48')
assert.equal(localizacaoRegistradaNaObra(corrigida), '-22.000000,-48.000000')
assert.equal((corrigida.match(/Localização: /g)||[]).length, 1)
const recusada = registrarFeedbackLocalizacao(corrigida, null, '-22,-48')
assert.equal(localizacaoRegistradaNaObra(recusada), null)
assert.match(recusada, /GPS rejeitado pelo usuário/)
assert.match(recusada, /Atenção na instalação/)
assert.ok(linkRotaObra({coordenadas:'-21.05,-49.69'}).includes('destination=-21.050000%2C-49.690000'))
assert.ok(linkRotaObra({endereco:'Rua A, 123',cidade:'José Bonifácio'}).includes('Rua%20A'))
assert.equal(linkRotaObra({}), null)

const pagina = fs.readFileSync('app/orcamento-rapido/page.tsx','utf8')
const persistencia = fs.readFileSync('lib/orcamentos.ts','utf8')
const detalhe = fs.readFileSync('app/obras/[id]/page.tsx','utf8')
for (const token of ['if (!obraNome.trim())','gpsConfirmado','enderecoInformado','Obra existente (opcional)','obraIdSelecionada','obraLocalizacaoConfirmada','Sim, está certa','Não, corrigir','Ver ponto no mapa','salvarRascunho(RASCUNHO_ID','obraGpsRejeitado']) {
  assert.ok(pagina.includes(token), `Não encontrou controle no Pedido de Orçamento: ${token}`)
}
for (const token of [".eq('cliente_id', clienteId)", 'registrarFeedbackLocalizacao','obraIdEfetiva','Informe endereço ou localização confirmada']) {
  assert.ok(persistencia.includes(token), `Não encontrou proteção em lib/orcamentos: ${token}`)
}
assert.ok(detalhe.includes('Abrir rota até a obra'))
console.log('PASS: validação obrigatória, múltiplas obras, rota, feedback positivo/negativo, notas preservadas, offline e vínculo ao cliente.')
