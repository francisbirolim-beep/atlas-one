import { compararItemWVetroComFormulaAtlas, detectarAlertasTecnicosWVetro, inferirOpcoesTecnicasWVetro, type FormulaAtlasComparacao, type WVetroItemTecnico } from '../lib/wvetroComparadorTecnico'
import {
  FIXTURE_PC2_SUPREMA_GENERICA_ATLAS,
  FIXTURE_PC2_SUPREMA_WVETRO,
  FIXTURE_PC3_SUPREMA_CM060_WVETRO,
  FIXTURE_PC3_SUPREMA_GENERICA_ATLAS,
  FIXTURE_PC3_SUPREMA_WVETRO,
} from '../lib/wvetroComparadorFixtures'

const hard = ['medida_diferente','quantidade_diferente','ausente_atlas','ausente_wvetro'] as const

function validar(nome: string, item: WVetroItemTecnico, formula: FormulaAtlasComparacao, pendentesEsperados: number) {
  const inferencia = inferirOpcoesTecnicasWVetro(item, formula)
  const resultado = compararItemWVetroComFormulaAtlas({ item, formula, opcoes: inferencia.opcoes })

  for (const status of hard) {
    if (Number(resultado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({ nome, status, resumo: resultado.resumo, divergencias: resultado.linhas.filter(l => l.status !== 'igual') }, null, 2))
      throw new Error(`Regressão ${nome}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(resultado.resumo.regra_pendente_atlas || 0) !== pendentesEsperados) {
    console.error(JSON.stringify({ nome, resumo: resultado.resumo }, null, 2))
    throw new Error(`Regressão ${nome}: esperado ${pendentesEsperados} regras pendentes.`)
  }

  return {
    fixture: nome,
    iguais: resultado.resumo.igual,
    regrasPendentes: resultado.resumo.regra_pendente_atlas,
    opcoesInferidas: inferencia.opcoes,
  }
}

const resultados = [
  validar('PC2 Suprema', FIXTURE_PC2_SUPREMA_WVETRO, FIXTURE_PC2_SUPREMA_GENERICA_ATLAS, 8),
  validar('PC3 Suprema', FIXTURE_PC3_SUPREMA_WVETRO, FIXTURE_PC3_SUPREMA_GENERICA_ATLAS, 5),
]

const infCm = inferirOpcoesTecnicasWVetro(FIXTURE_PC3_SUPREMA_CM060_WVETRO, FIXTURE_PC3_SUPREMA_GENERICA_ATLAS)
const cm = compararItemWVetroComFormulaAtlas({
  item: FIXTURE_PC3_SUPREMA_CM060_WVETRO,
  formula: FIXTURE_PC3_SUPREMA_GENERICA_ATLAS,
  opcoes: infCm.opcoes,
})
if (cm.resumo.medida_diferente !== 0 || cm.resumo.quantidade_diferente !== 0 || cm.resumo.ausente_wvetro !== 0) {
  throw new Error(`Regressão PC3 CM060: o núcleo técnico voltou a divergir. ${JSON.stringify(cm.resumo)}`)
}
if (cm.resumo.ausente_atlas !== 6 || cm.resumo.regra_pendente_atlas !== 4) {
  throw new Error(`Regressão PC3 CM060: esperado subsistema isolado 6/4. ${JSON.stringify(cm.resumo)}`)
}
const alertasCm = detectarAlertasTecnicosWVetro(FIXTURE_PC3_SUPREMA_CM060_WVETRO)
if (!alertasCm.some(a => String(a.dados.familia).includes('envolvente') && a.dados.familia_quadro === 'quadro padrão')) {
  throw new Error('Regressão PC3 CM060: família histórica envolvente/quadro padrão não detectada.')
}

resultados.push({
  fixture: 'PC3 Suprema CM060 envolvente',
  iguais: cm.resumo.igual,
  regrasPendentes: cm.resumo.regra_pendente_atlas,
  opcoesInferidas: infCm.opcoes,
})

console.log(JSON.stringify({ ok: true, resultados, alertasCm }, null, 2))
