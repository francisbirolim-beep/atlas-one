const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename,'utf8')
  mod._compile(ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
  }}).outputText,filename)
}
const { diagnosticarRelatorio, extrairComponentesRelatorio, pareceAtalhoWeb } =
  require('../lib/engenhariaImportacaoWvetro.ts')

const padrao = 'CÓDIGO;EIXO;COMPRIMENTO;QUANTIDADE\nSU001;L;1492;2\nSU053;H;2294;2'
let resultado=diagnosticarRelatorio(padrao,'lista-corte.pdf')
assert.equal(resultado.estado,'lista_corte')
assert.equal(resultado.componentes.length,2)
assert.deepEqual(resultado.componentes.map(c=>c.comprimento_mm),[1492,2294])
assert.deepEqual(resultado.componentes.map(c=>c.quantidade),[2,2])
assert.deepEqual(resultado.componentes.map(c=>c.eixo),['L','H'])

const wvetro = 'Código\tDescrição\tQtd\tComprimento (mm)\nSU-001\tMarco lateral\t2\t2.294,0'
const comPonto=extrairComponentesRelatorio(wvetro)
assert.equal(comPonto.length,1, 'Medida brasileira com milhar deve ser reconhecida')
assert.equal(comPonto[0].comprimento_mm,2294)
const wvetro2 = 'Código\tDescrição\tQtd\tComprimento (mm)\nSU-001\tMarco lateral\t2\t2294,0\nSU-002\tTravessa\t3\t1492,5'
const lidas=extrairComponentesRelatorio(wvetro2)
assert.equal(lidas.length,2)
assert.equal(lidas[0].codigo,'SU-001')
assert.equal(lidas[0].comprimento_mm,2294)
assert.equal(lidas[0].quantidade,2)
assert.equal(lidas[1].comprimento_mm,1492.5)
assert.equal(diagnosticarRelatorio(wvetro2,'lista.pdf').estado,'lista_corte')

const simples='SU003;Marco lateral;H;2294;2\nSU004;Travessa;L;1492;1'
assert.equal(extrairComponentesRelatorio(simples).length,2)
assert.equal(extrairComponentesRelatorio(simples)[0].eixo,'H')

assert.equal(pareceAtalhoWeb('orcamento.webloc','<plist><string>https://sistema.wvetro.com.br/concept/report?id=1</string></plist>'),true)
assert.equal(diagnosticarRelatorio('https://sistema.wvetro.com.br/concept/app.core.relori?rel=abc','relatorio.pdf').estado,'link_wvetro')
assert.equal(diagnosticarRelatorio('W VETRO\nCliente: Maria\nOrçamento nº 1234\nValor total 123','orcamento.pdf').estado,'orcamento_comercial')
assert.equal(diagnosticarRelatorio('','escaneado.pdf').estado,'pdf_digitalizado')
assert.equal(extrairComponentesRelatorio('Texto de orçamento sem perfil\nPorta integrada 1500 x 2300').length,0)
assert.ok(extrairComponentesRelatorio('SU001;L;1492;2\nSU001;L;1492;2').length===1)
assert.ok(extrairComponentesRelatorio('SU001;L;1492;2\nSU001;L;1493;2').length===2)
assert.equal(extrairComponentesRelatorio('PORTA;L;1492;2').length,0,'Texto genérico não pode virar código')
// Relatório comercial em tabelas, com números de pedidos, clientes e URLs:
// nenhuma combinação sem eixo e comprimento comprovados pode virar perfil.
const extrato = Array.from({length:50}, (_,i)=>
  'ORCAMENTO' + (100+i) + '\\tCLIENTE' + i + '\\t1500\\t2300').join('\\n')
assert.equal(extrairComponentesRelatorio(extrato).length,0,
  '50 linhas comerciais não podem se tornar 50 perfis falsos')
assert.equal(extrairComponentesRelatorio('SU001\\tMarco lateral\\t1500\\t2').length,0,
  'Sem cabeçalho e sem eixo: comprimento não é comprovado')
assert.equal(diagnosticarRelatorio(extrato,'relatorio.pdf').componentes.length,0)
assert.equal(extrairComponentesRelatorio('https://sistema.wvetro.com.br/relori?123\\t1492\\t2\\t99').length,0)
assert.equal(extrairComponentesRelatorio('SU001;L;1492;2').length,1)
console.log('OK: atalhos do W.Vetro, orçamento comercial, PDF sem texto, cabeçalhos, cortes, eixos e deduplicação.')
