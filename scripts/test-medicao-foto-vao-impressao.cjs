/** Regressão do PDF de conferência com fotos reais dos vãos, inclusive peças em rascunho. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const originalTs = require.extensions['.ts']
require.extensions['.ts'] = (mod, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  mod._compile(code, filename)
}
const imagem = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGP4HOBIU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAPurEFvnhJLNAAAAAElFTkSuQmCC', 'base64')
const blob = new Blob([imagem], { type: 'image/png' })
global.FileReader = class {
  readAsDataURL(b) { b.arrayBuffer().then(d => { this.result = 'data:image/png;base64,' + Buffer.from(d).toString('base64'); this.onload?.() }).catch(() => this.onerror?.()) }
}
let urls = []
global.fetch = async url => ({ok: String(url).startsWith('https://fotos.local/'), blob: async () => blob})
const originalLoad = Module._load
Module._load = function(request, parent, ...args) {
  if (parent?.filename.endsWith('/lib/medicaoFinalPdf.ts')) {
    if (request === './auth') return {tokenAtual: async () => null}
    if (request === './medicaoChecklistV2') return {
      carregarChecklistMedicaoV2: async () => ({ campos: [], respostas: [], fotos: urls }),
      camposDoItemV2: () => [], valorRespostaItemV2: () => null,
      statusItemChecklistV2: () => 'pendente',
    }
    if (request === './medicaoFinalLayoutA4') return {
      carregarLayoutMedicaoA4: async () => ({itensPorPagina:3,exibirCroqui:true,larguraCroquiMm:58,fonteMedidasPt:6,alturaFotoMm:25,fotosPorLinha:4,fonteChecklistPt:6.2}),
      LAYOUT_MEDICAO_A4_PADRAO: {itensPorPagina:3,exibirCroqui:true,larguraCroquiMm:58,fonteMedidasPt:6,alturaFotoMm:25,fotosPorLinha:4,fonteChecklistPt:6.2},
    }
  }
  return originalLoad.apply(this,[request,parent,...args])
}
const {gerarPdfMedicaoFinalComFotosDoVao, gerarPdfMedicaoFinal} = require('../lib/medicaoFinalPdf.ts')
Module._load = originalLoad
const medicao = {id:'medicao-teste',cliente_nome:'CLIENTE TESTE',tipo_medicao:'tipologia'}
const itens = [
 {id:'i1',descricao:'PORTA DE CORRER 2 FOLHAS', ambiente:'SALA',quantidade:1, campos_extras:{},medido:false},
 {id:'i2',descricao:'JANELA 3 FOLHAS', ambiente:'QUARTO',quantidade:1, campos_extras:{},medido:false},
]
async function main() {
  urls = [{item_id:'i1',url:'https://fotos.local/vao-1.png',legenda:'Foto do vão / local',categoria:'checklist:foto_vao'}]
  const doc = await gerarPdfMedicaoFinalComFotosDoVao(medicao,itens,false)
  assert.equal(doc.getNumberOfPages(),2,'uma folha por tipologia, incluindo a que não tem foto')
  const texto = doc.internal.pages.flat().join('\n')
  assert.match(texto,/MEDIDAS PENDENTES/,'rascunhos devem ser identificados')
  assert.match(texto,/N.O LIBERA FABRICA/,'impressão não deve equivaler a liberação')
  assert.match(texto,/PORTA DE CORRER/)
  assert.match(texto,/JANELA 3 FOLHAS/)
  assert.match(texto,/Foto do v.o ainda n.o cadastrada/,'peça sem foto deve ser declarada')
  assert.match(doc.output(),/\/Subtype \/Image/,'a foto real precisa ser incorporada ao PDF')
  assert.equal(Math.round(doc.internal.pageSize.getWidth()),210)
  assert.equal(Math.round(doc.internal.pageSize.getHeight()),297)
  const oficial = await gerarPdfMedicaoFinal(medicao,itens,false)
  assert.match(oficial.internal.pages.flat().join('\n'),/Nenhuma tipologia conclu/,'PDF oficial não deve passar a liberar rascunhos')

  urls = []
  await assert.rejects(gerarPdfMedicaoFinalComFotosDoVao(medicao,itens,false),/Nenhuma foto do v.o/, 'não imprimir sem foto como se estivesse tudo certo')
  urls = [{item_id:'i1',url:'https://fotos-indisponiveis.local/vao-1.jpg',legenda:'Foto do vão / local',categoria:'checklist:foto_vao'}]
  await assert.rejects(gerarPdfMedicaoFinalComFotosDoVao(medicao,itens,false),/Não foi possível carregar uma foto/, 'falha na foto não pode gerar PDF aparentemente completo')
  const editor=fs.readFileSync('components/medicao-final/EditorLayoutA4.tsx','utf8')
  assert.match(editor,/href=\{pdfExibidoUrl\}/,'botão de impressão precisa abrir o PDF exibido')
  assert.match(editor,/src=\{pdfExibidoUrl\}/,'prévia precisa exibir o mesmo PDF com fotos')
  assert.match(editor,/setPreviaFotoVaoUrl\(URL.createObjectURL/,'botão de fotos precisa ativar a prévia com fotos')
  console.log('PASS: fotos embutidas, arquivo incompleto bloqueado, prévia e impressão sincronizadas, A4 e emissão final preservada.')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{require.extensions['.ts']=originalTs})
