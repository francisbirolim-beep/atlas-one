import { assinaturaComposicaoWVetro, classificarFamiliaPc1Suprema, classificarFamiliaPc2Suprema, classificarFamiliaPc4Suprema, classificarFamiliaPortinholaSuprema, compararItemWVetroComFormulaAtlas, ehPc2SupremaDominante, ehPc2SupremaPadraoSemReforco, ehPortinholaSupremaVeneziana1fValidada, extrairVariantesPc2Suprema, inferirOpcoesTecnicasWVetro } from '../lib/wvetroComparadorTecnico'
import { FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_GENERICA_ATLAS, FIXTURE_PC2_SUPREMA_WVETRO, FIXTURES_JC2_SUPREMA_WVETRO, FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA, FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA, FIXTURES_PC3_SUPREMA_ATUAL_WVETRO, FIXTURE_PC3_SUPREMA_LEGADO_WVETRO, FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA, FIXTURES_JC3_SUPREMA_WVETRO, FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_LAMBRIL_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_CM200_WVETRO, FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_SEM_ARREMATE_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_SEM_ARREMATE_WVETRO, FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA, FIXTURES_BAS3_SUPREMA_WVETRO, FIXTURE_PC4_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PC4_SUPREMA_WVETRO, FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_PADRAO_SEM_REFORCO_ATLAS_REFERENCIA, FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO, FIXTURE_PORTINHOLA_SUPREMA_VENEZIANA_1F_ATLAS_REFERENCIA, FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO } from '../lib/wvetroComparadorFixtures'
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

const bas3Resultados = FIXTURES_BAS3_SUPREMA_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA,
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
      throw new Error(`Regressão BAS3 Suprema ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 6) {
    throw new Error(`Regressão BAS3 Suprema ${item.Largura}x${item.Altura}: esperadas 6 regras pendentes.`)
  }

  return {
    medida:`${item.Largura}x${item.Altura}`,
    iguais:comparado.resumo.igual,
    pendentes:comparado.resumo.regra_pendente_atlas,
  }
})

console.log(JSON.stringify({
  ok:true,
  fixture:'BAS3 Suprema - composição dominante',
  amostras:bas3Resultados,
},null,2))

const pc4Resultados = FIXTURES_PC4_SUPREMA_WVETRO.map(item => {
  const comparado = compararItemWVetroComFormulaAtlas({
    item,
    formula: FIXTURE_PC4_SUPREMA_ATLAS_REFERENCIA,
    opcoes: {},
  })

  for (const status of hard) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        fixture:item.Codigo,
        medida:`${item.Largura}x${item.Altura}`,
        status,
        resumo:comparado.resumo,
        divergencias:comparado.linhas.filter(l=>l.status!=='igual'),
      },null,2))
      throw new Error(`Regressão PC4 Suprema ${item.Largura}x${item.Altura}: status ${status} deveria ser zero.`)
    }
  }

  if (Number(comparado.resumo.regra_pendente_atlas || 0) !== 0) {
    console.error(JSON.stringify({
      fixture:item.Codigo,
      medida:`${item.Largura}x${item.Altura}`,
      resumo:comparado.resumo,
      pendencias:comparado.linhas.filter(l=>l.status==='regra_pendente_atlas'),
    },null,2))
    throw new Error(`Regressão PC4 Suprema ${item.Largura}x${item.Altura}: não deveria existir regra pendente.`)
  }

  if (!comparado.aprovado) {
    throw new Error(`Regressão PC4 Suprema ${item.Largura}x${item.Altura}: comparação deveria estar aprovada.`)
  }

  return {
    fixture:item.Codigo,
    medida:`${item.Largura}x${item.Altura}`,
    iguais:comparado.resumo.igual,
    aprovado:comparado.aprovado,
  }
})

console.log(JSON.stringify({
  ok:true,
  fixture:'PC4 Suprema - 4 móveis em 4 planos - composição dominante com vidro',
  amostras:pc4Resultados,
},null,2))



function exigirSemDivergencia(nome:string, item:any, formula:any) {
  const inferida = inferirOpcoesTecnicasWVetro(item, formula, { cor:'PRETO', vidro:'INCOLOR 06MM - TEMPERADO' })
  const comparado = compararItemWVetroComFormulaAtlas({ item, formula, opcoes: inferida.opcoes })
  for (const status of [...hard, 'regra_pendente_atlas'] as const) {
    if (Number(comparado.resumo[status] || 0) !== 0) {
      console.error(JSON.stringify({
        nome,
        status,
        resumo: comparado.resumo,
        opcoes: inferida.opcoes,
        divergencias: comparado.linhas.filter(l => l.status !== 'igual'),
      }, null, 2))
      throw new Error(`Regressão ${nome}: status ${status} deveria ser zero.`)
    }
  }
  if (!comparado.aprovado) throw new Error(`Regressão ${nome}: comparação deveria estar aprovada.`)
  return comparado
}

for (const item of FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO) {
  if (!ehPc2SupremaPadraoSemReforco(item)) {
    throw new Error(`Regressão PC2 sem reforço: assinatura ${item.Codigo} não foi reconhecida.`)
  }
  exigirSemDivergencia(
    `PC2 sem reforço ${item.Codigo}`,
    item,
    FIXTURE_PC2_SUPREMA_PADRAO_SEM_REFORCO_ATLAS_REFERENCIA,
  )
}

if (!ehPc2SupremaDominante(FIXTURE_PC2_SUPREMA_WVETRO)) {
  throw new Error('Regressão PC2 reforço externo: fixture histórica principal não foi reconhecida.')
}
exigirSemDivergencia(
  'PC2 mão-de-amigo comum com reforço externo',
  FIXTURE_PC2_SUPREMA_WVETRO,
  FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA,
)

for (const item of FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO) {
  if (!ehPortinholaSupremaVeneziana1fValidada(item)) {
    throw new Error(`Regressão Portinhola: assinatura ${item.Codigo} não foi reconhecida.`)
  }
  exigirSemDivergencia(
    `Portinhola veneziana 1F ${item.Codigo}`,
    item,
    FIXTURE_PORTINHOLA_SUPREMA_VENEZIANA_1F_ATLAS_REFERENCIA,
  )
}

const assinaturaPc2 = assinaturaComposicaoWVetro(FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0])
const assinaturaPc2OutraMedida = assinaturaComposicaoWVetro({
  ...FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0],
  Largura: 1900,
  Altura: 2400,
  Perfil: (FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0].Perfil || []).map(p => ({
    ...p,
    Medida: Number(p.Medida || 0) + 0.123,
  })),
  Vidros: (FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0].Vidros || []).map(v => ({
    ...v,
    Largura: Number(v.Largura || 0) + 100,
    Altura: Number(v.Altura || 0) + 100,
  })),
})
if (assinaturaPc2.chave !== assinaturaPc2OutraMedida.chave) {
  throw new Error('Regressão matriz histórica: medidas não devem fragmentar a mesma composição estrutural.')
}

const assinaturaPc2ComExtra = assinaturaComposicaoWVetro({
  ...FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0],
  Acessorios: [
    ...(FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO[0].Acessorios || []),
    { Codigo:'EXTRA-REGRESSAO', Qtde:1 },
  ],
})
if (assinaturaPc2.chave === assinaturaPc2ComExtra.chave) {
  throw new Error('Regressão matriz histórica: composição com acessório extra precisa gerar outra assinatura.')
}

const pc2Integrada = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo:'*SUCB-PC2-08-EF*',
  Nome:'PORTA DE CORRER INTEGRADA 02 FOLHAS MÓVEIS COM MOTOR 220V | SUPREMA',
}
if (classificarFamiliaPc2Suprema(pc2Integrada) !== 'integrada_persiana') {
  throw new Error('Regressão família PC2: integrada/persiana não reconhecida.')
}
if (ehPc2SupremaDominante(pc2Integrada) || ehPc2SupremaPadraoSemReforco(pc2Integrada)) {
  throw new Error('Regressão família PC2: integrada não pode cair em receita de vidro padrão.')
}

const varianteIntegrada = extrairVariantesPc2Suprema({
  ...pc2Integrada,
  Nome:'PORTA DE CORRER INTEGRADA 02 FOLHAS MÓVEIS EM TRILHOS EMBUTIDOS COM MOTOR 220V | SUPREMA COM CONTRAMARCO E ARREMATE',
})
if (
  varianteIntegrada.trilho !== 'embutido' ||
  varianteIntegrada.persianaAcionamento !== 'motor_220v' ||
  varianteIntegrada.contramarco !== 'com' ||
  varianteIntegrada.arremate !== 'com'
) {
  throw new Error(`Regressão variantes PC2 integrada: ${JSON.stringify(varianteIntegrada)}`)
}

const pc4Sintetica = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Modelo:'PORTA DE CORRER 04 FOLHAS',
  Codigo:'*SUCB-PC4-02-EF',
  Nome:'PORTA DE CORRER 04 FOLHAS MÓVEIS EM 04 PLANOS | SUPREMA',
}
if (classificarFamiliaPc4Suprema(pc4Sintetica) !== 'quatro_planos') {
  throw new Error('Regressão família PC4: quatro planos não reconhecido.')
}

const pc1Sintetica = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Modelo:'PORTA DE CORRER 01 FOLHA',
  Codigo:'*SUCB-PC1-04-EF*',
  Nome:'PORTA DE CORRER 01 FOLHA SUSPENSA | LAMBRI | SUPREMA SEM CONTRAMARCO',
}
if (classificarFamiliaPc1Suprema(pc1Sintetica) !== 'lambri_suspensa') {
  throw new Error('Regressão família PC1: lambri suspensa não reconhecida.')
}

const portinhola2fSintetica = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Modelo:'PORTINHOLA',
  Codigo:'SUCB-PTA-04',
  Nome:'PORTINHOLA DE GIRO 02 FOLHAS COM VENEZIANA VENTILADA | SUPREMA',
  Vidros:[],
}
if (classificarFamiliaPortinholaSuprema(portinhola2fSintetica) !== 'veneziana_2f') {
  throw new Error('Regressão família Portinhola: veneziana 2F não reconhecida.')
}

console.log(JSON.stringify({
  ok:true,
  fixture:'Homologação adicional W.Vetro',
  pc2SemReforco:FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO.length,
  pc2ReforcoExterno:1,
  portinholaVeneziana1f:FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO.length,
  matrizAssinatura:true,
  familiasSeguras:true,
}, null, 2))
