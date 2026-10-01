import { compararItemWVetroComFormulaAtlas, inferirOpcoesTecnicasWVetro } from '../lib/wvetroComparadorTecnico'
import { FIXTURE_PC2_SUPREMA_GENERICA_ATLAS, FIXTURE_PC2_SUPREMA_WVETRO } from '../lib/wvetroComparadorFixtures'

const inferencia = inferirOpcoesTecnicasWVetro(
  FIXTURE_PC2_SUPREMA_WVETRO,
  FIXTURE_PC2_SUPREMA_GENERICA_ATLAS,
)

const resultado = compararItemWVetroComFormulaAtlas({
  item: FIXTURE_PC2_SUPREMA_WVETRO,
  formula: FIXTURE_PC2_SUPREMA_GENERICA_ATLAS,
  opcoes: inferencia.opcoes,
})

const hard = [
  'medida_diferente',
  'quantidade_diferente',
  'ausente_atlas',
  'ausente_wvetro',
] as const

for (const status of hard) {
  if (Number(resultado.resumo[status] || 0) !== 0) {
    console.error(JSON.stringify({ status, resumo: resultado.resumo, divergencias: resultado.linhas.filter(l => l.status !== 'igual') }, null, 2))
    throw new Error(`Regressão PC2: status ${status} deveria ser zero.`)
  }
}

if (Number(resultado.resumo.regra_pendente_atlas || 0) !== 8) {
  console.error(JSON.stringify(resultado.resumo, null, 2))
  throw new Error('Regressão PC2: quantidade esperada de regras pendentes mudou.')
}

console.log(JSON.stringify({
  ok: true,
  fixture: 'PC2 Suprema',
  iguais: resultado.resumo.igual,
  regrasPendentes: resultado.resumo.regra_pendente_atlas,
  opcoesInferidas: inferencia.opcoes,
}, null, 2))
