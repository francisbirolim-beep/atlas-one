/** Testes de regressão do PDF com dados sintéticos, sem banco nem acesso a clientes. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const tsReader = require.extensions['.ts']
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  module._compile(result.outputText, filename)
}
const originalLoad = Module._load
let fotosIncluidas = true
let checklistExtra = 0
const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGP4HOBIU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAPurEFvnhJLNAAAAAElFTkSuQmCC'
const fotoBlob = new Blob([Buffer.from(foto.split(',')[1], 'base64')], { type: 'image/png' })
global.FileReader = class FileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(data => { this.result = 'data:image/png;base64,' + Buffer.from(data).toString('base64'); this.onload?.() }).catch(() => this.onerror?.())
  }
}
global.fetch = async url => ({ ok: String(url).startsWith('https://fotos.local/'), blob: async () => fotoBlob })
Module._load = function (request, parent, ...rest) {
  if (parent && parent.filename.endsWith('/lib/medicaoFinalPdf.ts')) {
    if (request === './auth') return { tokenAtual: async () => null }
    if (request === './medicaoChecklistV2') return {
      carregarChecklistMedicaoV2: async () => ({
        campos: [], respostas: [],
        fotos: fotosIncluidas ? ['item-1', 'item-2'].map(id => ({ item_id: id, url: `https://fotos.local/${id}-vao.png`, legenda: 'Foto do vao' })) : [],
      }),
      camposDoItemV2: () => [],
      valorRespostaItemV2: () => null,
      statusItemChecklistV2: () => 'concluida',
    }
    if (request === './medicaoFinalLayoutA4') return {
      carregarLayoutMedicaoA4: async () => ({ itensPorPagina: 3, exibirCroqui: true, larguraCroquiMm: 58, fonteMedidasPt: 6, alturaFotoMm: 25, fotosPorLinha: 4, fonteChecklistPt: 6.2 }),
      LAYOUT_MEDICAO_A4_PADRAO: { itensPorPagina: 3, exibirCroqui: true, larguraCroquiMm: 58, fonteMedidasPt: 6, alturaFotoMm: 25, fotosPorLinha: 4, fonteChecklistPt: 6.2 },
    }
  }
  return originalLoad.apply(this, [request, parent, ...rest])
}
const { gerarPdfMedicaoFinal } = require('../lib/medicaoFinalPdf.ts')
Module._load = originalLoad
const medicao = { id: 'teste-medicao', cliente_nome: 'CLIENTE DE TESTE', tipo_medicao: 'tipologia' }
function peca(id, extras = {}) {
  return {
    id, medido: true, descricao: 'PORTA DE CORRER 03 FOLHAS', ambiente: 'Area Gourmet', quantidade: 1, tipo_esquadria: 'porta_correr', folhas: '3',
    largura_cima_mm: 3090, largura_meio_mm: 3094, largura_baixo_mm: 3090,
    altura_esquerda_mm: 2168, altura_meio_mm: 2172, altura_direita_mm: 2177,
    foto_larguras_url: fotosIncluidas ? `https://fotos.local/${id}-largura.png` : null,
    foto_alturas_url: fotosIncluidas ? `https://fotos.local/${id}-altura.png` : null,
    campos_extras: extras, medido_por_nome: 'TESTE', medido_em: '2026-11-09T14:43:00-03:00',
  }
}
function validarPapel(doc) {
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i)
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.2, 'largura A4')
    assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 297) < 0.2, 'altura A4')
  }
}
function salvarTemporario(doc, nome) {
  const destino = path.join(os.tmpdir(), `atlas-teste-layout-${nome}-20261109.pdf`)
  fs.writeFileSync(destino, Buffer.from(doc.output('arraybuffer')))
  return destino
}
async function executar() {
  const original = await gerarPdfMedicaoFinal(medicao, [peca('item-1'), peca('item-2')], false)
  validarPapel(original)
  assert.equal(original.getNumberOfPages(), 1, 'o PDF legado deve continuar exibindo duas pecas em uma folha')
  console.log(`OK original: ${original.getNumberOfPages()} página A4 — ${salvarTemporario(original, 'original')}`)

  const personalizado = await gerarPdfMedicaoFinal(medicao, [peca('item-1'), peca('item-2')], false, {
    itensPorPagina: 2, exibirCroqui: false, larguraCroquiMm: 40, fonteMedidasPt: 10,
    alturaFotoMm: 44, fotosPorLinha: 3, fonteChecklistPt: 7,
  })
  validarPapel(personalizado)
  const conteudo = personalizado.internal.pages.flat().join('\n')
  assert.match(conteudo, /MEDIDAS DO V/) // Mesmo sem croqui, as medidas aparecem.
  assert.match(conteudo, /3090/) // Valor original mantido.
  assert.match(conteudo, /CONFIRMA/) // Termo final mantido.
  console.log(`OK personalizado: ${personalizado.getNumberOfPages()} página(s) A4 — ${salvarTemporario(personalizado, 'personalizado')}`)

  fotosIncluidas = false
  const extras = Object.fromEntries(Array.from({length: 140}, (_, i) => [`campo_teste_${i + 1}`, `Resposta da conferencia ${i + 1}`]))
  const longo = await gerarPdfMedicaoFinal(medicao, [peca('item-1', extras)], false, {
    itensPorPagina: 1, exibirCroqui: true, larguraCroquiMm: 58, fonteMedidasPt: 9,
    alturaFotoMm: 58, fotosPorLinha: 2, fonteChecklistPt: 9,
  })
  validarPapel(longo)
  assert.ok(longo.getNumberOfPages() > 1, 'checklist grande deve paginar')
  const textoLongo = longo.internal.pages.flat().join('\n')
  assert.match(textoLongo, /campo teste 140/) // Última resposta não pode desaparecer.
  assert.match(textoLongo, /CONFIRMA/) // Confirmação final presente.
  console.log(`OK checklist extenso: ${longo.getNumberOfPages()} páginas A4, sem truncamento — ${salvarTemporario(longo, 'checklist')}`)
}
executar().catch(err => { console.error(err); process.exitCode = 1 }).finally(() => { require.extensions['.ts'] = tsReader })
