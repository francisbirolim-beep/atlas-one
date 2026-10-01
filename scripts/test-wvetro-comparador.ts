import { compararItemWVetroComFormulaAtlas, inferirOpcoesTecnicasWVetro, type FormulaAtlasComparacao, type WVetroItemTecnico } from '../lib/wvetroComparadorTecnico'
import {
  FIXTURE_PC2_SUPREMA_GENERICA_ATLAS,
  FIXTURE_PC2_SUPREMA_WVETRO,
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

console.log(JSON.stringify({ ok: true, resultados }, null, 2))
