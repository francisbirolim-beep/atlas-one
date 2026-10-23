const assert = require('node:assert/strict')

async function testar() {
  const { medicaoComprovada, medicaoRequerConferencia } = await import('../lib/medicaoComprovacao.ts')

  const vazio = {
    largura_baixo_mm: null, largura_meio_mm: null, largura_cima_mm: null,
    altura_direita_mm: null, altura_meio_mm: null, altura_esquerda_mm: null,
    foto_larguras_url: null, foto_alturas_url: null,
  }
  const soLargura = { ...vazio, largura_baixo_mm: 1789, largura_meio_mm: 1701, largura_cima_mm: 1700 }
  const todas = { ...soLargura, altura_direita_mm: 2148, altura_meio_mm: 2149, altura_esquerda_mm: 2152 }
  const casos = [
    ['sem foto e sem medidas', vazio, false, false],
    ['tres larguras sem altura nem foto', soLargura, false, false],
    ['somente foto da altura', { ...vazio, foto_alturas_url: 'https://exemplo.com/trena-altura.jpg' }, true, true],
    ['larguras preenchidas e foto com leitura falha de altura', { ...soLargura, foto_alturas_url: 'https://exemplo.com/trena-altura.jpg' }, true, true],
    ['somente foto da largura', { ...vazio, foto_larguras_url: 'https://exemplo.com/trena-largura.jpg' }, true, true],
    ['seis medidas manuais', todas, true, false],
    ['seis medidas e foto', { ...todas, foto_larguras_url: 'https://exemplo.com/trena.jpg' }, true, false],
  ]
  for (const [nome, item, podeConcluir, conferir] of casos) {
    assert.equal(medicaoComprovada(item), podeConcluir, nome)
    assert.equal(medicaoRequerConferencia(item), conferir, nome)
    process.stdout.write('PASS: ' + nome + '\n')
  }
}

testar().catch(erro => { console.error(erro); process.exitCode = 1 })
