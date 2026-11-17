const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

async function executar() {
  const { medicaoComprovada } = await import('../lib/medicaoComprovacao.ts')
  const comFoto = { foto_larguras_url: 'https://exemplo.invalid/trena.jpg' }
  const completa = {
    largura_baixo_mm: 1200, largura_meio_mm: 1201, largura_cima_mm: 1200,
    altura_direita_mm: 2000, altura_meio_mm: 2001, altura_esquerda_mm: 2000,
  }
  const parcial = { largura_baixo_mm: 1200, orcamento_largura_mm: 1200 }
  const cincoItens = [comFoto, comFoto, comFoto, completa, {}]
  const documentadas = cincoItens.filter(medicaoComprovada).length
  assert.equal(documentadas, 4)
  assert.equal(Math.round(documentadas / cincoItens.length * 100), 80)
  assert.equal(medicaoComprovada(parcial), false, 'Uma medida isolada não conta como registrada')
  assert.equal(medicaoComprovada({ orcamento_largura_mm: 1200 }), false, 'O orçamento não substitui a Medição Final')
  const resumo = fs.readFileSync(path.join(__dirname, '../lib/medicaoFinalV2.ts'), 'utf8')
  assert.match(resumo, /pecasComRegistro = itens\.filter\(item => medicaoComprovada\(item\)\)\.length/)
  assert.match(resumo, /Math\.round\(\(pecasComRegistro \/ totalPecas\) \* 100\)/)
  assert.doesNotMatch(resumo, /pecasEmAndamento \* 0\.5/)
  const lista = fs.readFileSync(path.join(__dirname, '../components/system/MedicaoParcialPanel.tsx'), 'utf8')
  assert.match(lista, /MiniCroquiTipologia peca=\{peca\}/)
  assert.match(lista, /Falta conferir:/)
  assert.match(lista, /mm · orçamento/)
  console.log('PASS: 4 de 5 com evidência = 80%; início parcial, orçamento e checklist pendente não geram progresso fictício.')
  console.log('PASS: tipologias incluem esquema identificado, informação de orçamento e pendências técnicas.')
}
executar().catch(erro => { console.error(erro); process.exit(1) })
