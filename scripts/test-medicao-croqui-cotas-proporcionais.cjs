/** Regressão geométrica: a personalização não pode jogar as cotas para baixo do croqui. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const ts = require('typescript')
const jsPDFReal = require('jspdf').jsPDF
const medidasCapturadas = []
const retangulosCapturados = []
const quadrosChecklist = []

function PdfEspiao(...args) {
  const doc = new jsPDFReal(...args)
  const textoOriginal = doc.text.bind(doc)
  const retanguloOriginal = doc.rect.bind(doc)
  doc.text = function(conteudo, x, y, ...resto) {
    if (typeof conteudo === 'string' && /^(Cima|Meio|Baixo|Esq\.|Dir\.) \d+ mm$/.test(conteudo)) {
      medidasCapturadas.push({ texto: conteudo, x, y, largura: doc.getTextWidth(conteudo), fonte: doc.getFontSize(), pagina: doc.getCurrentPageInfo().pageNumber })
    }
    return textoOriginal(conteudo, x, y, ...resto)
  }
  doc.rect = function(x, y, w, h, ...resto) {
    if (h === 23 && w >= 35 && w <= 60) retangulosCapturados.push({ x, y, w, h, pagina: doc.getCurrentPageInfo().pageNumber })
    if (x >= 101 && w >= 65 && h >= 39) quadrosChecklist.push({ x, y, w, h, pagina: doc.getCurrentPageInfo().pageNumber })
    return retanguloOriginal(x, y, w, h, ...resto)
  }
  return doc
}
const originalLoad = Module._load
const originalTs = require.extensions['.ts']
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
Module._load = function(request, parent, ...args) {
  if (parent?.filename.endsWith('/lib/medicaoFinalPdf.ts')) {
    if (request === 'jspdf') return { jsPDF: PdfEspiao }
    if (request === './auth') return { tokenAtual: async () => null }
    if (request === './medicaoFinalLayoutA4') return {
      carregarLayoutMedicaoA4: async () => null,
      LAYOUT_MEDICAO_A4_PADRAO: { itensPorPagina: 3, exibirCroqui: true, larguraCroquiMm: 58, fonteMedidasPt: 6, alturaFotoMm: 25, fotosPorLinha: 4, fonteChecklistPt: 6.2 },
    }
    if (request === './medicaoChecklistV2') return {
      carregarChecklistMedicaoV2: async () => ({campos: [], itens: [], respostas: [], fotos: []}),
      camposDoItemV2: () => [], valorRespostaItemV2: () => null, statusItemChecklistV2: () => 'concluida',
    }
  }
  return originalLoad.apply(this, [request, parent, ...args])
}
const {gerarPdfMedicaoFinal} = require('../lib/medicaoFinalPdf.ts')
Module._load = originalLoad
const medicao = {id:'medicao-teste', cliente_nome:'CLIENTE TESTE', tipo_medicao:'tipologia'}
const peca = (id, folhas) => ({
  id, medido: true, tipo_esquadria:'porta_correr', descricao:`PORTA DE CORRER ${folhas} FOLHAS`, ambiente:'Area gourmet', folhas:String(folhas), quantidade:1,
  largura_cima_mm: 3090, largura_meio_mm:3094, largura_baixo_mm:3091,
  altura_esquerda_mm:2168, altura_meio_mm:2172, altura_direita_mm:2177,
  campos_extras:{}, medido_por_nome:'MEDIDOR TESTE', medido_em: '2026-11-09T16:00:00-03:00',
})
const itens = [peca('item-1',3),peca('item-2',4)]
const igual = (a,b,tol=.04) => Math.abs(a-b) <= tol

async function main() {
  let casos = 0
  for (const larguraCroquiMm of [35, 42, 46, 48, 58, 60]) {
    for (const fonteMedidasPt of [6, 8.5, 10, 12]) {
      for (const fotosPorLinha of [2, 4]) {
        medidasCapturadas.length = 0
        retangulosCapturados.length = 0
        quadrosChecklist.length = 0
        const layout = {itensPorPagina:2,exibirCroqui:true,larguraCroquiMm,fonteMedidasPt,alturaFotoMm:25,fotosPorLinha,fonteChecklistPt:6.2}
        const doc = await gerarPdfMedicaoFinal(medicao, itens, false, layout)
        assert.equal(medidasCapturadas.length, 12, '2 peças, 6 cotas cada')
        assert.equal(retangulosCapturados.length, 2, 'croquis 3 e 4 folhas')
        assert.equal(quadrosChecklist.length, 2, 'quadro checklist separado do croqui')
        for (let idx=0;idx<2;idx++) {
          const { x, y, w, h, pagina } = retangulosCapturados[idx]
          const checklistX = quadrosChecklist[idx].x
          assert.ok(checklistX >= 101 && checklistX <= 135, `checklist mantém espaço suficiente (${checklistX})`)
          assert.ok(igual(w, larguraCroquiMm), 'o slider de largura altera o croqui, não as cotas')
          const anotacoes = medidasCapturadas.filter(t=>t.pagina===pagina && t.y>=y-0.1 && t.y<=y+h+8)
          const lado = anotacoes.filter(t=>['Cima','Meio','Baixo'].some(nome=>t.texto.startsWith(nome+' ')) && igual(t.x,x+w+3))
          const baixo = anotacoes.filter(t=>['Esq.','Meio','Dir.'].some(nome=>t.texto.startsWith(nome+' ')) && igual(t.y,y+h+5))
          assert.equal(lado.length, 3, `faltam cotas ao lado no croqui ${idx}, w=${w}, fonte=${fonteMedidasPt}`)
          assert.equal(baixo.length, 3, `faltam cotas embaixo no croqui ${idx}, w=${w}, fonte=${fonteMedidasPt}`)
          assert.ok(lado.every(t=>t.y>=y && t.y<y+h), 'larguras devem estar sempre na lateral do retângulo')
          assert.ok(baixo.every(t=>t.y>y+h), 'alturas devem estar embaixo do retângulo')
          assert.ok(baixo[0].x < baixo[1].x && baixo[1].x < baixo[2].x, 'ordem Esq./Meio/Dir. sob o croqui')
          for (const texto of anotacoes) {
            assert.ok(texto.x + texto.largura <= checklistX - 1.9, `cota invadiu o checklist (${texto.texto}): ${texto.x+texto.largura}`)
            assert.ok(igual(texto.fonte, fonteMedidasPt, .005), `tamanho da fonte precisa ser igual para TODAS as 6 cotas: ${texto.texto} ficou ${texto.fonte}pt ao invés de ${fonteMedidasPt}pt`)
          }
          for (let i=0;i<2;i++) assert.ok(baixo[i].x+baixo[i].largura < baixo[i+1].x, 'sem cotas inferiores sobrepostas')
        }
        assert.equal(doc.internal.pageSize.getWidth()>209, true)
        if (larguraCroquiMm===46 && fonteMedidasPt===10 && fotosPorLinha===2) {
          const arquivo=path.join(os.tmpdir(),'atlas-medida-croqui-cotas-proporcionais-20261109.pdf')
          fs.writeFileSync(arquivo, Buffer.from(doc.output('arraybuffer')))
          console.log('Amostra A4 para inspeção visual:',arquivo)
        }
        casos++
      }
    }
  }
  console.log(`PASS: ${casos} configurações A4, 2 tipologias: fonte exatamente igual em TODAS as cotas, sem colisão com checklist nem entre si.`)
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{require.extensions['.ts']=originalTs})
