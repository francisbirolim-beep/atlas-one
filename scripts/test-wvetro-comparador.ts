import { assinaturaComposicaoWVetro, classificarFamiliaPc1Suprema, classificarFamiliaPc2Suprema, classificarFamiliaPc4Suprema, classificarFamiliaPortinholaSuprema, compararItemWVetroComFormulaAtlas, ehPc2SupremaDominante, ehPc2SupremaPadraoSemReforco, ehPc4SupremaQuatroPlanosValidada, ehPortinholaSupremaVeneziana1fValidada, extrairVariantesPc2Suprema, extrairVariantesPortinholaSuprema, inferirOpcoesTecnicasWVetro } from '../lib/wvetroComparadorTecnico'
import { FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_GENERICA_ATLAS, FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_PADRAO_SEM_REFORCO_ATLAS_REFERENCIA, FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO, FIXTURE_PC4_SUPREMA_QUATRO_PLANOS_ATLAS_REFERENCIA, FIXTURES_PC4_SUPREMA_QUATRO_PLANOS_WVETRO, FIXTURE_PORTINHOLA_SUPREMA_VENEZIANA_1F_ATLAS_REFERENCIA, FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO, FIXTURE_PC2_SUPREMA_WVETRO, FIXTURES_JC2_SUPREMA_WVETRO, FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA, FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA, FIXTURES_PC3_SUPREMA_ATUAL_WVETRO, FIXTURE_PC3_SUPREMA_LEGADO_WVETRO, FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA, FIXTURES_JC3_SUPREMA_WVETRO, FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_LAMBRIL_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_WVETRO, FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_CM200_WVETRO, FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_MAX1_SUPREMA_SEM_ARREMATE_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_WVETRO, FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURES_PG1_VIDRO_SUPREMA_SEM_ARREMATE_WVETRO, FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA, FIXTURES_BAS3_SUPREMA_WVETRO } from '../lib/wvetroComparadorFixtures'
import { calcularFormulasCorte } from '../lib/formulasCorteEngine'

const variantesPc2 = [
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'*SUCB-PC2-08-EF*', Nome:'PORTA DE CORRER INTEGRADA 02 FOLHAS | SUPREMA' }, 'integrada_persiana'],
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'*SUCB-PC2-03-EF', Nome:'PORTA DE CORRER 02 FOLHAS MÓVEIS | VENEZIANA | SUPREMA' }, 'veneziana'],
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'*SUCB-PC2-04-EF', Nome:'PORTA DE CORRER 02 FOLHAS COM LAMBRI | SUPREMA' }, 'lambri'],
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'SUCB-PC2-05', Nome:'PORTA DE CORRER 02 FOLHAS MÓVEIS | BANDEIRA FIXA | SUPREMA' }, 'bandeira'],
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'SUCB-PC2-11', Nome:'PORTA DE CORRER 02 FOLHAS ABERTURA CENTRAL | SUPREMA' }, 'abertura_central'],
  [{ ...FIXTURE_PC2_SUPREMA_WVETRO, Codigo:'*SUCB-PC2-02-EF', Nome:'PORTA DE CORRER 02 FOLHAS | VIDRO SUPERIOR E VENEZIANA INFERIOR | SUPREMA' }, 'mista_vidro_veneziana'],
] as const

for (const [item, esperado] of variantesPc2) {
  const familia = classificarFamiliaPc2Suprema(item)
  if (familia !== esperado) throw new Error(`Regressão classificação PC2: esperado ${esperado}, obtido ${familia}.`)
}

if (classificarFamiliaPc2Suprema(FIXTURE_PC2_SUPREMA_WVETRO) !== 'vidro_padrao') {
  throw new Error('Regressão classificação PC2: fixture principal deveria ser vidro_padrao.')
}


const varianteIntegradaMotor = extrairVariantesPc2Suprema({
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo:'*SUCB-PC2-08-EF*',
  Nome:'PORTA DE CORRER INTEGRADA 02 FOLHAS MOVEIS COM TRILHOS EMBUTIDOS, MOTOR 220VT | SUPREMA COM CONTRAMARCO E ARREMATE',
})
if (
  varianteIntegradaMotor.familia !== 'integrada_persiana' ||
  varianteIntegradaMotor.montagem !== 'duas_moveis' ||
  varianteIntegradaMotor.contramarco !== 'com' ||
  varianteIntegradaMotor.arremate !== 'com' ||
  varianteIntegradaMotor.trilho !== 'embutido' ||
  varianteIntegradaMotor.persianaAcionamento !== 'motor_220v'
) {
  throw new Error(`Regressão variantes PC2 integrada motor: ${JSON.stringify(varianteIntegradaMotor)}`)
}

const varianteIntegradaFita = extrairVariantesPc2Suprema({
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo:'*SUCB-PC2-08-EF*',
  Nome:'PORTA DE CORRER INTEGRADA 02 FOLHAS MOVEIS EM TRILHOS EMBUTIDOS COM RECOLHEDOR NA FITA | SUPREMA SEM CONTRAMARCO',
})
if (
  varianteIntegradaFita.familia !== 'integrada_persiana' ||
  varianteIntegradaFita.contramarco !== 'sem' ||
  varianteIntegradaFita.trilho !== 'embutido' ||
  varianteIntegradaFita.persianaAcionamento !== 'fita'
) {
  throw new Error(`Regressão variantes PC2 integrada fita: ${JSON.stringify(varianteIntegradaFita)}`)
}

const varianteSequencial = extrairVariantesPc2Suprema({
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo:'*SUCB-PC2-01-EF',
  Nome:'PORTA DE CORRER 02 FOLHAS SEQUENCIAIS COM REF DE ABA E REF EXTERNO TRILHOS EMBUTIDOS | SUPREMA COM CONTRAMARCO',
})
if (
  varianteSequencial.familia !== 'vidro_padrao' ||
  varianteSequencial.montagem !== 'sequencial' ||
  varianteSequencial.contramarco !== 'com' ||
  !varianteSequencial.reforcoAba ||
  !varianteSequencial.reforcoExterno ||
  varianteSequencial.trilho !== 'embutido'
) {
  throw new Error(`Regressão variantes PC2 sequencial: ${JSON.stringify(varianteSequencial)}`)
}

if (!ehPc2SupremaDominante(FIXTURE_PC2_SUPREMA_WVETRO)) {
  throw new Error('Regressão PC2 reforço externo: a fixture histórica deveria ser reconhecida.')
}

const pc2SemVidro = { ...FIXTURE_PC2_SUPREMA_WVETRO, Vidros: [] }
if (ehPc2SupremaDominante(pc2SemVidro)) {
  throw new Error('Regressão PC2 reforço externo: composição sem vidro não pode ser classificada como vidro padrão.')
}

const pc2IntegradaFalsa = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo: '*SUCB-PC2-08-EF*',
  Nome: 'PORTA DE CORRER INTEGRADA 02 FOLHAS | SUPREMA',
}
if (ehPc2SupremaDominante(pc2IntegradaFalsa)) {
  throw new Error('Regressão PC2 reforço externo: variante integrada/persiana não pode cair na assinatura de vidro padrão.')
}

const pc2VenezianaFalsa = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Codigo: '*SUCB-PC2-03-EF',
  Nome: 'PORTA DE CORRER 02 FOLHAS MÓVEIS | VENEZIANA | SUPREMA',
}
if (ehPc2SupremaDominante(pc2VenezianaFalsa)) {
  throw new Error('Regressão PC2 reforço externo: variante veneziana não pode cair na assinatura de vidro padrão.')
}

for (const [item, familia] of variantesPc2) {
  if (ehPc2SupremaDominante(item)) {
    throw new Error(`Regressão PC2 reforço externo: variante especial ${familia} não pode cair na assinatura de vidro padrão.`)
  }
}

const pc4Base = {
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Modelo:'PORTA DE CORRER 04 FOLHAS',
}
const familiasPc4 = [
  [{...pc4Base,Codigo:'*SUCB-PC4-02-EF',Nome:'PORTA DE CORRER 04 FOLHAS MÓVEIS EM 04 PLANOS | SUPREMA'},'quatro_planos'],
  [{...pc4Base,Codigo:'*SUCB-PC4-02-EF',Nome:'PORTA DE CORRER 04 FOLHAS SEQUENCIAIS COM REF DE ABA | SUPREMA'},'sequencial'],
  [{...pc4Base,Codigo:'*SUCB-PC4-01-EF',Nome:'PORTA DE CORRER 04 FOLHAS ABERTURA CENTRAL | SUPREMA'},'abertura_central'],
  [{...pc4Base,Codigo:'*SUCB-PC4-01-EF',Nome:'PORTA DE CORRER 04 FOLHAS - 02 FIXAS E 02 MÓVEIS | SUPREMA'},'fixas_moveis'],
  [{...pc4Base,Codigo:'*SUCB-PC4-09-EF',Nome:'PORTA DE CORRER 04 FOLHAS MÓVEIS | VENEZIANA 01 VENTILADA / 01 CEGA - 01 VIDRO - 01 TELA | SUPREMA'},'veneziana_mista'],
] as const

for (const [item, esperado] of familiasPc4) {
  const familia = classificarFamiliaPc4Suprema(item)
  if (familia !== esperado) throw new Error(`Regressão classificação PC4: esperado ${esperado}, obtido ${familia}.`)
}

const pc1Base = { ...FIXTURE_PC2_SUPREMA_WVETRO, Modelo:'PORTA DE CORRER 01 FOLHA' }
const familiasPc1 = [
  [{...pc1Base,Codigo:'*SUCB-PC1-01-EF*',Nome:'PORTA DE CORRER 01 FOLHA | VIDRO | SUPREMA'},'vidro'],
  [{...pc1Base,Codigo:'*SUCB-PC1-01-EF*',Nome:'PORTA DE CORRER 01 FOLHA SUSPENSA | VIDRO | SUPREMA SEM CONTRAMARCO'},'vidro_suspensa'],
  [{...pc1Base,Codigo:'*SUCB-PC1-04-EF*',Nome:'PORTA DE CORRER 01 FOLHA | LAMBRI | SUPREMA'},'lambri'],
  [{...pc1Base,Codigo:'*SUCB-PC1-04-EF*',Nome:'PORTA DE CORRER 01 FOLHA SUSPENSA | LAMBRI | SUPREMA SEM CONTRAMARCO'},'lambri_suspensa'],
  [{...pc1Base,Codigo:'*SUCB-PC1-03-EF',Nome:'PORTA DE CORRER 01 FOLHA | VENEZIANA | SUPREMA'},'veneziana'],
  [{...pc1Base,Codigo:'*SUCB-PC1-02-EF',Nome:'PORTA DE CORRER 01 FOLHA | VIDRO SUPERIOR E VENEZIANA INFERIOR VENTILADA | SUPREMA'},'mista_vidro_veneziana'],
  [{...pc1Base,Codigo:'*SUCB-PC1-01-EF*',Nome:'ESTRUTURA PORTA DE CORRER 01 FOLHA PARA RECEBER O RIPADO DE AMBOS OS LADOS | SUPREMA'},'estrutura_ripado'],
  [{...pc1Base,Codigo:'SUCB-PC1-04',Nome:'KIT PORTA PRONTA SINCOL SINIKIT - PORTA DE CORRER'},'kit_porta_pronta'],
] as const
for (const [item, esperado] of familiasPc1) {
  const familia = classificarFamiliaPc1Suprema(item)
  if (familia !== esperado) throw new Error(`Regressão classificação PC1: esperado ${esperado}, obtido ${familia}.`)
}

const portinholaBase = { ...FIXTURE_PC2_SUPREMA_WVETRO, Modelo:'PORTINHOLA' }
const familiasPortinhola = [
  [{...portinholaBase,Codigo:'SUCB-PTA-03',Nome:'PORTINHOLA DE GIRO 01 FOLHA COM VENEZIANA | SUPREMA'},'veneziana_1f'],
  [{...portinholaBase,Codigo:'SUCB-PTA-04',Nome:'PORTINHOLA DE GIRO 02 FOLHAS COM VENEZIANA VENTILADA | SUPREMA'},'veneziana_2f'],
  [{...portinholaBase,Codigo:'SUCB-PTA-01',Nome:'PORTINHOLA DE GIRO 01 FOLHA | SUPREMA'},'lisa_1f'],
] as const
for (const [item, esperado] of familiasPortinhola) {
  const familia = classificarFamiliaPortinholaSuprema(item)
  if (familia !== esperado) throw new Error(`Regressão classificação Portinhola: esperado ${esperado}, obtido ${familia}.`)
}
const portinholaDetalhada = extrairVariantesPortinholaSuprema({
  ...portinholaBase,
  Codigo:'SUCB-PTA-03',
  Nome:'PORTINHOLA DE GIRO 01 FOLHA COM VENEZIANA CEGA COM TRANQUETA | SUPREMA SEM CONTRAMARCO E ARREMATE',
})
if (
  portinholaDetalhada.familia !== 'veneziana_1f' ||
  portinholaDetalhada.veneziana !== 'cega' ||
  portinholaDetalhada.contramarco !== 'sem' ||
  portinholaDetalhada.arremate !== 'sem' ||
  portinholaDetalhada.fechamento !== 'tranqueta'
) throw new Error(`Regressão variantes Portinhola: ${JSON.stringify(portinholaDetalhada)}`)

const assinaturaBasePc2 = assinaturaComposicaoWVetro(FIXTURE_PC2_SUPREMA_WVETRO)
const assinaturaMesmoEsqueletoOutraMedida = assinaturaComposicaoWVetro({
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Largura: 2500,
  Altura: 2100,
  Perfil: (FIXTURE_PC2_SUPREMA_WVETRO.Perfil || []).map(p => ({ ...p, Medida: Number(p.Medida || 0) + 0.123 })),
  Vidros: (FIXTURE_PC2_SUPREMA_WVETRO.Vidros || []).map(v => ({ ...v, Largura: Number(v.Largura || 0) - 100, Altura: Number(v.Altura || 0) - 100 })),
})
if (assinaturaBasePc2.chave !== assinaturaMesmoEsqueletoOutraMedida.chave) {
  throw new Error('Regressão assinatura W.Vetro: medidas não devem fragmentar o mesmo esqueleto técnico.')
}

const assinaturaComAcessorioExtra = assinaturaComposicaoWVetro({
  ...FIXTURE_PC2_SUPREMA_WVETRO,
  Acessorios: [...(FIXTURE_PC2_SUPREMA_WVETRO.Acessorios || []), { Codigo:'EXTRA-TESTE', Qtde:1 }],
})
if (assinaturaBasePc2.chave === assinaturaComAcessorioExtra.chave) {
  throw new Error('Regressão assinatura W.Vetro: acessório extra deve gerar outra assinatura.')
}

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


const inferenciaDominante = inferirOpcoesTecnicasWVetro(
  FIXTURE_PC2_SUPREMA_WVETRO,
  FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA,
)
const resultadoDominante = compararItemWVetroComFormulaAtlas({
  item: FIXTURE_PC2_SUPREMA_WVETRO,
  formula: FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA,
  opcoes: inferenciaDominante.opcoes,
})
for (const status of [...hard, 'regra_pendente_atlas'] as const) {
  if (Number(resultadoDominante.resumo[status] || 0) !== 0) {
    console.error(JSON.stringify({
      status,
      resumo: resultadoDominante.resumo,
      divergencias: resultadoDominante.linhas.filter(l => l.status !== 'igual'),
    }, null, 2))
    throw new Error(`Regressão PC2 reforço externo validada: status ${status} deveria ser zero.`)
  }
}
if (!resultadoDominante.aprovado) {
  throw new Error('Regressão PC2 reforço externo validada: resultado deveria estar aprovado.')
}

console.log(JSON.stringify({
  ok: true,
  fixture: 'PC2 Suprema - referência histórica com reforço externo aprovada',
  iguais: resultadoDominante.resumo.igual,
  aprovado: resultadoDominante.aprovado,
}, null, 2))


function validarReferenciaHistorica(
  nome: string,
  itens: typeof FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO,
  formula: typeof FIXTURE_PC2_SUPREMA_PADRAO_SEM_REFORCO_ATLAS_REFERENCIA,
) {
  return itens.map(item => {
    const inferida = inferirOpcoesTecnicasWVetro(item, formula)
    const comparado = compararItemWVetroComFormulaAtlas({ item, formula, opcoes: inferida.opcoes })
    for (const status of [...hard, 'regra_pendente_atlas'] as const) {
      if (Number(comparado.resumo[status] || 0) !== 0) {
        console.error(JSON.stringify({ nome, fixture:item.Codigo, status, resumo:comparado.resumo, divergencias:comparado.linhas.filter(l=>l.status!=='igual') }, null, 2))
        throw new Error(`Regressão ${nome} ${item.Codigo}: status ${status} deveria ser zero.`)
      }
    }
    if (!comparado.aprovado) throw new Error(`Regressão ${nome} ${item.Codigo}: deveria estar aprovado.`)
    return { fixture:item.Codigo, medida:`${item.Largura}x${item.Altura}`, iguais:comparado.resumo.igual }
  })
}

for (const item of FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO) {
  if (!ehPc2SupremaPadraoSemReforco(item)) throw new Error(`PC2 padrão sem reforço não reconhecida: ${item.Codigo}`)
  if (ehPc2SupremaDominante(item)) throw new Error(`PC2 padrão sem reforço caiu na assinatura de reforço externo: ${item.Codigo}`)
}
const pc2PadraoResultados = validarReferenciaHistorica(
  'PC2 padrão sem reforço',
  FIXTURES_PC2_SUPREMA_PADRAO_SEM_REFORCO_WVETRO,
  FIXTURE_PC2_SUPREMA_PADRAO_SEM_REFORCO_ATLAS_REFERENCIA,
)
console.log(JSON.stringify({ok:true,fixture:'PC2 Suprema - padrão sem reforço',amostras:pc2PadraoResultados},null,2))

for (const item of FIXTURES_PC4_SUPREMA_QUATRO_PLANOS_WVETRO) {
  if (!ehPc4SupremaQuatroPlanosValidada(item)) throw new Error(`PC4 quatro planos não reconhecida: ${item.Codigo}`)
}
const pc4Resultados = validarReferenciaHistorica(
  'PC4 quatro planos',
  FIXTURES_PC4_SUPREMA_QUATRO_PLANOS_WVETRO,
  FIXTURE_PC4_SUPREMA_QUATRO_PLANOS_ATLAS_REFERENCIA,
)
console.log(JSON.stringify({ok:true,fixture:'PC4 Suprema - quatro planos',amostras:pc4Resultados},null,2))

for (const item of FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO) {
  if (!ehPortinholaSupremaVeneziana1fValidada(item)) throw new Error(`Portinhola veneziana 1F não reconhecida: ${item.Codigo}`)
}
const portinholaResultados = validarReferenciaHistorica(
  'Portinhola veneziana 1F H=1630',
  FIXTURES_PORTINHOLA_SUPREMA_VENEZIANA_1F_WVETRO,
  FIXTURE_PORTINHOLA_SUPREMA_VENEZIANA_1F_ATLAS_REFERENCIA,
)
console.log(JSON.stringify({ok:true,fixture:'Portinhola Suprema - veneziana 1F H=1630',amostras:portinholaResultados},null,2))


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
