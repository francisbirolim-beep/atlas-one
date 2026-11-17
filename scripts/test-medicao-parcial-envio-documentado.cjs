const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

async function testar() {
  const { medicaoComprovada } = await import('../lib/medicaoComprovacao.ts')
  const seis = { largura_baixo_mm: 900, largura_meio_mm: 901, largura_cima_mm: 902,
    altura_direita_mm: 2100, altura_meio_mm: 2101, altura_esquerda_mm: 2102 }
  const cinco = [seis, seis, { foto_alturas_url: 'https://example.invalid/a.jpg' },
    { foto_larguras_url: 'https://example.invalid/b.jpg' }, { largura_meio_mm: 900 }]
  assert.equal(cinco.filter(medicaoComprovada).length, 4, '4 documentadas; 1 ainda não documentada')
  assert.equal(Math.round(cinco.filter(medicaoComprovada).length * 100 / cinco.length), 80)
  const rota = fs.readFileSync(path.join(__dirname, '../app/api/medicao-final/[id]/conferencia/route.ts'), 'utf8')
  const inicio = rota.indexOf("if (action === 'enviar_registro_parcial')")
  const fim = rota.indexOf("if (action === 'enviar')", inicio)
  assert.ok(inicio >= 0 && fim > inicio)
  const trecho = rota.slice(inicio, fim)
  assert.match(trecho, /medicaoComprovada/)
  assert.match(trecho, /usuario\.role !== 'master'/)
  assert.match(trecho, /validarDestinatariosParcial/)
  assert.match(trecho, /if \(process\.env\.VERCEL_ENV === 'preview'\)/)
  assert.ok(trecho.indexOf("VERCEL_ENV === 'preview'") < trecho.indexOf('criarSnapshot('),
    'Na prévia, a simulação ocorre ANTES de qualquer escrita')
  assert.doesNotMatch(trecho, /\.from\('medicao_itens'\)\s*\.update\(/,
    'Nenhum item deve ser marcado como concluído pelo simples envio parcial')
  assert.match(trecho, /avisarConferenciaParcial/)
  assert.match(trecho, /pecas_medidas: documentados\.length/)
  const pausa = fs.readFileSync(path.join(__dirname,'../lib/medicaoParcial.ts'),'utf8')
  const externo = fs.readFileSync(path.join(__dirname,'../app/api/medicao-final/acesso/[token]/parcial/route.ts'),'utf8')
  assert.match(pausa, /const medidas = itens\.reduce\(\(soma, item\) => soma \+ \(medicaoComprovada\(item\) \? 1 : 0\)/)
  assert.match(externo, /const medidas = lista\.reduce\(\(soma, item\) => soma \+ \(medicaoComprovada\(item\) \? 1 : 0\)/)
  const lista = fs.readFileSync(path.join(__dirname,'../components/system/MedicaoParcialPanel.tsx'),'utf8')
  assert.match(lista, /Parcial enviada para conferência/)
  assert.match(lista, /Pausada, mas ainda não enviada/)
  const painel = fs.readFileSync(path.join(__dirname,'../components/system/MedicaoFinalFieldSummary.tsx'),'utf8')
  assert.match(painel, /Enviar parcial para conferência/)
  assert.match(painel, /checklist técnico continua independente/)
  console.log('PASS: 4/5 documentadas, sem liberar a 5ª; separação pausa/envio e prévia sem gravação.')
  console.log('PASS: destinatários obrigatórios, comunicação e checklist continuam independentes.')
}
testar().catch(erro => { console.error(erro); process.exitCode = 1 })
