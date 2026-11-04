const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-tipologia-test-'))
try {
  execFileSync(process.execPath, [
    path.join(process.cwd(), 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node',
    '--esModuleInterop', '--skipLibCheck', '--outDir', temp,
    'lib/formulasCorteEngine.ts', 'lib/bancadaTipologias.ts', 'lib/planoCorteBancada.ts',
  ], { cwd: process.cwd(), stdio: 'pipe' })
  const { conferirCaso, listaCortesTexto, compararSimulacoes, assinaturaTecnica } =
    require(path.join(temp, 'bancadaTipologias.js'))
  const { simularBarras } = require(path.join(temp, 'planoCorteBancada.js'))
  const receita = {
    tipologia_id: 'teste',
    variaveis: [{ chave: 'perfil', label: 'Perfil', opcoes: ['normal', 'reforcado'] }],
    folgas: { largura_mm: 4, altura_mm: 4 },
    pecas: [
      { grupo: 'marco', variaveis_chave: ['perfil'], mapa_codigo: { normal: 'SU001', reforcado: 'SU002' }, formula: 'LF - 20', quantidade: 2 },
      { codigo: 'SU053', formula: 'HF - 10', quantidade: 2 },
    ],
  }
  const caso = {
    nome: 'Porta teste', largura_mm: 1800, altura_mm: 2200,
    opcoes: { perfil: 'normal' },
    folgas: { largura_mm: 4, altura_mm: 4 },
    cortes: listaCortesTexto('CÓDIGO;EIXO;COMPRIMENTO;QUANTIDADE\nSU001;;1776;2\nSU053;;2186;2'),
  }
  const resultado = conferirCaso(receita, caso)
  assert.equal(resultado.ok, true, JSON.stringify(resultado))
  assert.equal(resultado.avaliados, 2)
  assert.equal(conferirCaso(receita, { ...caso, cortes: [{ ...caso.cortes[0], quantidade: 1 }, caso.cortes[1]] }).ok, false)
  assert.equal(conferirCaso(receita, { ...caso, cortes: [{ ...caso.cortes[0], comprimento_mm: 1775.4 }, caso.cortes[1]] }).ok, false)
  assert.equal(conferirCaso(receita, { ...caso, cortes: [caso.cortes[0]] }).ok, false)
  assert.equal(conferirCaso(receita, { ...caso, cortes: [...caso.cortes, { codigo: 'SU999', comprimento_mm: 1200, quantidade: 1 }] }).ok, false)
  assert.equal(conferirCaso(receita, { ...caso, cortes: [{ ...caso.cortes[0], comprimento_mm: 1775.6 }, caso.cortes[1]] }).ok, true)
  assert.notEqual(assinaturaTecnica(receita), assinaturaTecnica({ ...receita, folgas: { largura_mm: 6, altura_mm: 4 } }))
  assert.throws(() => listaCortesTexto('SU001;L;1000;0'), /quantidade inválidos/)
  assert.throws(() => listaCortesTexto('SU001;L;abc;2'), /quantidade inválidos/)
  assert.throws(() => listaCortesTexto(''), /ao menos uma peça/)
  const b = conferirCaso(receita, { ...caso, opcoes: { perfil: 'reforcado' } })
  assert.equal(b.resultados[0].codigo, 'SU002')
  const dif = compararSimulacoes(resultado.resultados, b.resultados)
  assert.equal(dif.find(p => p.codigo === 'SU001').codigo_alternativo, 'SU002')
  const plano = simularBarras(resultado.resultados, 6000, 4)
  assert.equal(plano.barras.length, 2)
  assert.ok(plano.barras.every(p => p.sobra_mm >= 0))
  assert.ok(plano.aproveitamento > 60)
  assert.equal(simularBarras(resultado.resultados, 2000, 4).alertas.length > 0, true)
  console.log('OK: bancada de tipologias — cálculo, divergência, tolerância, quantidade, perfis, barras e assinatura.')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
