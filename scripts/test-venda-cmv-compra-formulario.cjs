const fs = require('node:fs')
const assert = require('node:assert/strict')
const ui = fs.readFileSync('components/clientes/VendaCmvPainel.tsx', 'utf8')
const route = fs.readFileSync('app/api/vendas/cmv/route.ts', 'utf8')
const submit = ui.slice(ui.indexOf(' async function enviar(e:'), ui.indexOf(' async function revisarCusto('))
assert.ok(submit.length > 300)
const capturar = submit.indexOf('const form=e.currentTarget')
const construir = submit.indexOf('new FormData(form)')
const esperar = submit.indexOf('await tokenAtual()')
assert.ok(capturar > 0 && construir > capturar && esperar > construir,
 'FormData e currentTarget devem ser capturados antes do primeiro await')
assert.match(submit, /dadosEnvio\.set\('vendaId',vendaId\)/)
assert.match(submit, /enviandoRef\.current=true/)
assert.match(submit, /form\.reset\(\);setAdicionar\(null\)/)
assert.match(submit, /finally\{enviandoRef\.current=false;setSalvando\(false\)\}/)
for (const tag of [
  /<select required name="categoria"/,
  /<select required name="origem"/,
  /<input required name="valor"/,
  /<input required name="data" type="date"/,
  /<input required name="fornecedor"/,
]) assert.match(ui,tag)
for (const tag of [
 /<input name="descricao" maxLength=\{500\}/,
 /<input name="quantidade"/, /<input name="unidade"/,
 /<input name="documento"/, /<input name="arquivo" type="file"/,
 /<input name="observacoes"/,
]) assert.match(ui,tag)
assert.doesNotMatch(ui,/<input required name="descricao"/)
assert.match(route, /const fornecedor=txt\(form\.get\('fornecedor'\),150\)/)
assert.match(route, /if\(!fornecedor\)return erro\('Informe o fornecedor\.'\)/)
assert.match(route, /if\(!data_lancamento\)return erro\('Informe a data do custo\.'\)/)
assert.match(route, /if\(!categorias\.includes\(categoria\)\)/)
assert.match(route, /if\(!origens\.includes\(origem\)\)/)
assert.match(route, /if\(valor===null\|\|valor<=0\|\|valor>999999999\)/)
assert.match(route, /const descricao=descricaoInformada\|\|/)
assert.match(route, /fornecedor,documento:/)
assert.doesNotMatch(route, /if\(!descricao\)return erro/)
assert.match(route, /const anexo=form\.get\('arquivo'\)/)
assert.match(route, /anexo\.size>15\*1024\*1024/)
assert.match(route, /if\(!tipos\.includes\(anexo\.type\)\)/)
assert.match(route, /if\(error\)throw new Error\('Falha ao guardar comprovante/)
console.log('PASS: FormData antes do await; 5 obrigatórios no cliente e API; descrição opcional; anexo PDF/foto preservado.')
