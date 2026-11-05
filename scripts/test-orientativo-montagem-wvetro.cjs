const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
function carregar(nome, substituicoes = {}) {
  const arquivo = path.resolve(__dirname, '..', nome)
  const js = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
  }}).outputText
  const m = new Module(arquivo, module)
  m.filename = arquivo
  m.paths = module.paths
  const original = m.require.bind(m)
  m.require = n => substituicoes[n] || original(n)
  m._compile(js, arquivo)
  return m.exports
}
const base = carregar('lib/bancadaCriacaoTipologia.ts')
const { extrairComponentesRelatorio, diagnosticarRelatorio, extrairDadosOrientativo } =
  carregar('lib/engenhariaImportacaoWvetro.ts', { './bancadaCriacaoTipologia': base })
const linhas = [
'MN001 MARCO DA INTEGRADA 1 1452 90/90 L 1,999',
'MN002 MARCO INFERIOR DA INTEGRADA 1 1452 90/90 L 0,971',
'SU001 MARCO SUPERIOR / CORRER 2 1 1452 90/90 L 1,106',
'TMC TRILHO MACARRÃO DE EMBUTIR MEIA-CAN 2 1452 90/90 L 0,531',
'MN003 MARCO 2 2296 90/90 H 5,019',
'SU008 MATA JUNTA / COMPLEMENTO DO MARCO 2 2074 90/90 H 1,012',
'MN039 TAMPA EXTERNA DA INTEGRADA 1 1452 90/90 L 2,033',
'MN032 TAMPA 1 1452 90/90 L 2,502',
'MN050 MARCO EMBUTIR RECOLHEDOR 1 2072 90/90 H 1,521',
'MN007 GUIA DA PERSIANA 2 2085 90/90 H 2,961',
'MD238 EIXO OCTOGONAL 40MM 1 1360 90/90 L 0,721',
'MN055 TERMINAL DA PERSIANA 1 1376 90/90 L 0,510',
'SU053 TRAVESSA DA FOLHA 2 654 90/90 L 0,664',
'SU225 TRAVESSA INFERIOR DA FOLHA 2 654 90/90 L 1,313',
'SU039 MONTANTE DE FOLHA 2 2056 90/90 H 2,138',
'SU040 MONTANTE MAO-DE-AMIGO INTERNO 1 2056 90/90 H 0,987',
'SU041 MONTANTE MÃO DE AMIGO 1 2056 90/90 H 1,042',
'SU102 BAGUETE 4 654 90/90 L 0,291',
'SU102 BAGUETE 4 1905 90/90 H 0,846',
'VZP-4558 PALHETA INTEGRADA VENTILADA PASSO 4 39 1376 90/90 L 5,366',
'VZC-4558 PALHETA INTEGRADA CEGA PASSO 45MM 10 1376 90/90 L 1,376',
].join('\n')
const orientativo = `Orientativo de Montagem
ORÇAMENTO Nro: 1278
Projeto: SUCB-PC2-08-EF
Nome: PORTA DE CORRER INTEGRADA 02 FOLHAS | SUPREMA
Qtde: 1      Largura 1500      Altura 2300
FOLGA NA LARGURA PARA ENCAIXE DA ESQUADRIA 4.00
FOLGA NA ALTURA PARA ENCAIXE DA ESQUADRIA 4.00
Perfil
Figura Código Descrição Qtde Tamanho Corte Pos Peso
${linhas}
Qtde.Pedaços: 81
Acessórios
ARR569 ARRUELA LISA Ø 4,3 X 9 MM - AÇO INOX UN 3,000 FIXAR FITA NO TUBO
FIT210 FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA MT 12,900 FITA P/ GUIA E TAMPA
CON370 CONTRAFECHO LATERAL UN 2,000 CONTRAFECHO
SIL-PU SILICONE DE POLIURETANO TB 1,267 VEDAÇÃO
Vidro
VIDRO INCOLOR 06MM - TEMPERADO 1 F 2 648 1923 2,49`
const nome = 'https:sistema.wvetro.com.br:concept:app.core.relorientativodecorte?token.pdf'
const items = extrairComponentesRelatorio(orientativo)
const perfis = items.filter(x => x.tipo === 'perfil')
const acessorios = items.filter(x => x.tipo === 'acessorio')
assert.equal(perfis.length, 21, '21 linhas distintas de perfis')
assert.equal(perfis.reduce((s,x) => s + x.quantidade,0),81,'81 cortes, sem inventar')
assert.equal(perfis.filter(x => x.codigo === 'SU102').length,2,'SU102 L e H')
assert.equal(perfis.find(x=>x.codigo==='TMC').comprimento_mm,1452,'perfil TMC sem digitos')
assert.equal(acessorios.length,4)
assert.equal(acessorios.find(x=>x.codigo==='FIT210').quantidade,12.9,'quantidade em metros')
assert.equal(acessorios.find(x=>x.codigo==='SIL-PU').unidade,'TB')
assert.equal(diagnosticarRelatorio(orientativo,nome).estado,'lista_corte','nome com URL nao invalida PDF')
const dados = extrairDadosOrientativo(orientativo)
assert.equal(dados.orcamento,'1278')
assert.equal(dados.largura_mm,1500)
assert.equal(dados.altura_mm,2300)
assert.equal(dados.folga_largura_mm,4)
assert.equal(dados.folga_altura_mm,4)
console.log('OK: orientativo W.Vetro reconhecido (21 linhas / 81 cortes / acessorios em unidades reais)')
