import { compararItemWVetroComFormulaAtlas, inferirOpcoesTecnicasWVetro } from '../lib/wvetroComparadorTecnico'
import { FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_GENERICA_ATLAS, FIXTURE_PC2_SUPREMA_WVETRO, FIXTURES_JC2_SUPREMA_WVETRO, FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA, FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA, FIXTURES_PC3_SUPREMA_ATUAL_WVETRO, FIXTURE_PC3_SUPREMA_LEGADO_WVETRO, FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA, FIXTURES_JC3_SUPREMA_WVETRO, FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_LAMBRIL_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_CM200_WVETRO, FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_SEM_ARREMATE_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_SEM_ARREMATE_WVETRO } from '../lib/wvetroComparadorFixtures'
import { calcularFormulasCorte } from '../lib/formulasCorteEngine'

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


const jc2Resultados = FIXTURES_JC2_SUPREMA_WVETRO.map(item => {
  const inferida = inferirOpcoesTecnicasWVetro(item, FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA)
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA,
    opcoes: inferida.opcoes,
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture: item.Codigo,
        status,
        opcoes: inferida.opcoes,
        resumo: comparado.resumo,
        divergencias: comparado.linhas.filter(l => l.status !== 'igual'),
      }, null, 2))
      throw new Error(`Regressão JC2 ${item.Codigo}: status ${status} deveria ser zero.`)
    }
  }

  return {
    fixture: item.Codigo,
    medida: `${item.Largura}x${item.Altura}`,
    iguais: comparado.resumo.igual,
    opcoesInferidas: inferida.opcoes,
  }
})

console.log(JSON.stringify({
  ok: true,
  fixture: 'JC2 Suprema - matriz histórica',
  amostras: jc2Resultados,
}, null, 2))


const testeQuantidadeVariavel = calcularFormulasCorte({
  tipologia_id: 'teste-formula-quantidade',
  variaveis: [],
  pecas: [
    {
      codigo: 'GS-034',
      eixo: 'L',
      formula: 'Largura-173',
      formula_quantidade: 'CEIL((Altura-28)/108.2)',
    },
  ],
}, 800, 2200, {})

if (testeQuantidadeVariavel.length !== 1 || testeQuantidadeVariavel[0].quantidade !== 21) {
  console.error(JSON.stringify(testeQuantidadeVariavel, null, 2))
  throw new Error('Regressão motor: formula_quantidade deveria calcular 21 perfis GS-034.')
}

const testeQuantidadeLegada = calcularFormulasCorte({
  tipologia_id: 'teste-quantidade-fixa',
  variaveis: [],
  pecas: [
    { codigo: 'SU001', eixo: 'L', formula: 'Largura-30', quantidade: 2 },
  ],
}, 1000, 1000, {})

if (testeQuantidadeLegada[0]?.quantidade !== 2) {
  console.error(JSON.stringify(testeQuantidadeLegada, null, 2))
  throw new Error('Regressão motor: quantidade fixa legada deveria permanecer 2.')
}

console.log(JSON.stringify({
  ok: true,
  fixture: 'Motor de perfis - quantidade variável',
  gs034_2200: testeQuantidadeVariavel[0].quantidade,
  quantidadeFixaLegada: testeQuantidadeLegada[0].quantidade,
}, null, 2))


const pc3Atual = FIXTURES_PC3_SUPREMA_ATUAL_WVETRO.map(item => {
  const inferida = inferirOpcoesTecnicasWVetro(item, FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA)
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA,
    opcoes: inferida.opcoes,
  })
  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture:item.Codigo,status,opcoes:inferida.opcoes,resumo:comparado.resumo,
        divergencias:comparado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas'),
      },null,2))
      throw new Error(`Regressão PC3 atual ${item.Codigo}: status ${status} deveria ser zero.`)
    }
  }
  return { fixture:item.Codigo,medida:`${item.Largura}x${item.Altura}`,iguais:comparado.resumo.igual,pendentes:comparado.resumo.regra_pendente_atlas,opcoesInferidas:inferida.opcoes }
})

const pc3LegadoInferido = inferirOpcoesTecnicasWVetro(FIXTURE_PC3_SUPREMA_LEGADO_WVETRO, FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA)
const pc3Legado = compararItemWVetroComFormulaAtlas({
  item:FIXTURE_PC3_SUPREMA_LEGADO_WVETRO,
  formula:FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA,
  opcoes:pc3LegadoInferido.opcoes,
})
for (const status of hard) {
  if (Number(pc3Legado.resumo[status] || 0) !== 0) {
    console.error(JSON.stringify({status,resumo:pc3Legado.resumo,divergencias:pc3Legado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas')},null,2))
    throw new Error(`Regressão PC3 legada: status ${status} deveria ser zero.`)
  }
}

const atualContraLegado = compararItemWVetroComFormulaAtlas({
  item:FIXTURES_PC3_SUPREMA_ATUAL_WVETRO[0],
  formula:FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA,
  opcoes:inferirOpcoesTecnicasWVetro(FIXTURES_PC3_SUPREMA_ATUAL_WVETRO[0],FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA).opcoes,
})
if (Number(atualContraLegado.resumo.medida_diferente || 0) < 1) {
  throw new Error('A regressão PC3 deveria distinguir a versão atual da versão legada pelo SU008.')
}

console.log(JSON.stringify({
  ok:true,
  fixture:'PC3 Suprema - matriz histórica atual + legada',
  atual:pc3Atual,
  legado:{fixture:FIXTURE_PC3_SUPREMA_LEGADO_WVETRO.Codigo,iguais:pc3Legado.resumo.igual,pendentes:pc3Legado.resumo.regra_pendente_atlas,opcoesInferidas:pc3LegadoInferido.opcoes},
  discriminacaoVersao:{medidasDiferentesAoUsarLegadoEmAtual:atualContraLegado.resumo.medida_diferente},
},null,2))


const jc3Resultados = FIXTURES_JC3_SUPREMA_WVETRO.map(item => {
  const inferida = inferirOpcoesTecnicasWVetro(item, FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA)
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA,
    opcoes: inferida.opcoes,
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture:item.Codigo,
        status,
        opcoes:inferida.opcoes,
        resumo:comparado.resumo,
        divergencias:comparado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas'),
      },null,2))
      throw new Error(`Regressão JC3 ${item.Codigo}: status ${status} deveria ser zero.`)
    }
  }

  return {
    fixture:item.Codigo,
    medida:`${item.Largura}x${item.Altura}`,
    iguais:comparado.resumo.igual,
    pendentes:comparado.resumo.regra_pendente_atlas,
    opcoesInferidas:inferida.opcoes,
  }
})

console.log(JSON.stringify({
  ok:true,
  fixture:'JC3 Suprema - matriz histórica moderna',
  amostras:jc3Resultados,
},null,2))

const pg1Resultados = FIXTURES_PG1_LAMBRIL_SUPREMA_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA,
    opcoes: {},
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture: item.Codigo,
        status,
        resumo: comparado.resumo,
        divergencias: comparado.linhas.filter(l => l.status !== 'igual'),
      }, null, 2))
      throw new Error(`Regressão PG1 Lambril ${item.Codigo}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 1) {
    console.error(JSON.stringify({
      fixture: item.Codigo,
      resumo: comparado.resumo,
      pendencias: comparado.linhas.filter(l => l.status === 'regra_pendente_atlas'),
    }, null, 2))
    throw new Error(`Regressão PG1 Lambril ${item.Codigo}: deveria existir apenas a regra pendente do rebite.`)
  }

  const pendente = comparado.linhas.find(l => l.status === 'regra_pendente_atlas')
  if (String(pendente?.codigo || '').toUpperCase() !== 'REBACA4X10') {
    throw new Error(`Regressão PG1 Lambril ${item.Codigo}: a única pendência esperada é REBACA4X10.`)
  }

  return {
    fixture: item.Codigo,
    medida: `${item.Largura}x${item.Altura}`,
    iguais: comparado.resumo.igual,
    regrasPendentes: comparado.resumo.regra_pendente_atlas,
    lambris: comparado.linhas.find(l => l.tipo === 'perfil' && l.codigo === 'GS-034')?.atlas?.quantidade,
  }
})

console.log(JSON.stringify({
  ok: true,
  fixture: 'PG1 Lambril Suprema - matriz histórica',
  amostras: pg1Resultados,
}, null, 2))

const max1Resultados = FIXTURES_MAX1_SUPREMA_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA,
    opcoes: {},
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture: item.Codigo,
        medida: `${item.Largura}x${item.Altura}`,
        quantidade: item.Qtde,
        status,
        resumo: comparado.resumo,
        divergencias: comparado.linhas.filter(l => l.status !== 'igual'),
      }, null, 2))
      throw new Error(`Regressão MAX1 Suprema ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 0) {
    throw new Error(`Regressão MAX1 Suprema ${item.Largura}x${item.Altura}: não deveria existir regra pendente.`)
  }

  return {
    medida: `${item.Largura}x${item.Altura}`,
    quantidade: item.Qtde,
    iguais: comparado.resumo.igual,
  }
})

console.log(JSON.stringify({
  ok: true,
  fixture: 'MAX1 Suprema - referência histórica dominante BRA702 sem contramarco',
  amostras: max1Resultados,
}, null, 2))

function validarMax1Variante(
  nome:string,
  itens: typeof FIXTURES_MAX1_SUPREMA_CM200_WVETRO,
  formula: typeof FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA,
  pendenciasEsperadas:number,
) {
  const amostras = itens.map(item => {
    const comparado = compararItemWVetroComFormulaAtlas({item,formula,opcoes:{}})
    for (const status of hard) {
      if (Number(comparado.resumo[status] || 0) !== 0) {
        console.error(JSON.stringify({
          nome,medida:`${item.Largura}x${item.Altura}`,status,
          resumo:comparado.resumo,
          divergencias:comparado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas'),
        },null,2))
        throw new Error(`Regressão ${nome} ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
      }
    }
    if (Number(comparado.resumo.regra_pendente_atlas || 0) !== pendenciasEsperadas) {
      throw new Error(`Regressão ${nome} ${item.Largura}x${item.Altura}: esperadas ${pendenciasEsperadas} regras pendentes.`)
    }
    return {
      medida:`${item.Largura}x${item.Altura}`,
      quantidade:item.Qtde,
      iguais:comparado.resumo.igual,
      pendentes:comparado.resumo.regra_pendente_atlas,
    }
  })
  console.log(JSON.stringify({ok:true,fixture:nome,amostras},null,2))
}

validarMax1Variante(
  'MAX1 Suprema - CM200 + arremate',
  FIXTURES_MAX1_SUPREMA_CM200_WVETRO,
  FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA,
  3,
)

validarMax1Variante(
  'MAX1 Suprema - sem arremate/contramarco',
  FIXTURES_MAX1_SUPREMA_SEM_ARREMATE_WVETRO,
  FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA,
  2,
)

const pg1VidroResultados = FIXTURES_PG1_VIDRO_SUPREMA_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA,
    opcoes: {},
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture:item.Codigo,
        medida:`${item.Largura}x${item.Altura}`,
        quantidade:item.Qtde,
        status,
        resumo:comparado.resumo,
        divergencias:comparado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas'),
      },null,2))
      throw new Error(`Regressão PG1 Vidro ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 6) {
    throw new Error(`Regressão PG1 Vidro ${item.Largura}x${item.Altura}: esperadas 6 regras pendentes.`)
  }

  return {
    medida:`${item.Largura}x${item.Altura}`,
    quantidade:item.Qtde,
    iguais:comparado.resumo.igual,
    pendentes:comparado.resumo.regra_pendente_atlas,
  }
})

console.log(JSON.stringify({
  ok:true,
  fixture:'PG1 Suprema Vidro - kit unitário dominante',
  amostras:pg1VidroResultados,
},null,2))

const pg1SemArremateResultados = FIXTURES_PG1_VIDRO_SUPREMA_SEM_ARREMATE_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA,
    opcoes:{},
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture:item.Codigo,
        medida:`${item.Largura}x${item.Altura}`,
        status,
        resumo:comparado.resumo,
        divergencias:comparado.linhas.filter(l=>l.status!=='igual'&&l.status!=='regra_pendente_atlas'),
      },null,2))
      throw new Error(`Regressão PG1 sem arremate ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 3) {
    throw new Error(`Regressão PG1 sem arremate ${item.Largura}x${item.Altura}: esperadas 3 regras pendentes.`)
  }

  return {
    medida:`${item.Largura}x${item.Altura}`,
    iguais:comparado.resumo.igual,
    pendentes:comparado.resumo.regra_pendente_atlas,
  }
})

console.log(JSON.stringify({
  ok:true,
  fixture:'PG1 Suprema Vidro - sem arremate/contramarco',
  amostras:pg1SemArremateResultados,
},null,2))

