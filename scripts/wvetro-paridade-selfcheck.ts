import assert from 'node:assert/strict'
import {
  calcularFormulaCorteIsolada,
  calcularFormulasCorte,
  calcularVidroFormula,
  type OpcoesEscolhidas,
  type TipologiaFormulasCorte,
  type VidroFormulaDeclarativa,
} from '../lib/formulasCorteEngine'

function mapaResultado(resultado: ReturnType<typeof calcularFormulasCorte>) {
  return new Map(resultado.map(p => [`${p.codigo}:${p.eixo || ''}`, p]))
}

function validarPeca(
  mapa: Map<string, ReturnType<typeof calcularFormulasCorte>[number]>,
  chave: string,
  tamanho: number,
  quantidade: number,
) {
  const atual = mapa.get(chave)
  assert.ok(atual, `Peça ausente: ${chave}`)
  assert.equal(atual.tamanho, tamanho, `Corte divergente em ${chave}`)
  assert.equal(atual.quantidade ?? 1, quantidade, `Quantidade divergente em ${chave}`)
}

const portaSuprema2Folhas: TipologiaFormulasCorte = {
  tipologia_id: '58c23780-b110-48ca-b478-0942573d3dd4',
  variaveis: [],
  pecas: [
    { eixo: 'L', codigo: 'CM060', formula: 'LF - 20', quantidade: 1 },
    { eixo: 'H', codigo: 'CM060', formula: 'HF - 8', quantidade: 2 },
    { eixo: 'L', codigo: 'MP347', formula: 'LF + 48', quantidade: 1 },
    { eixo: 'H', codigo: 'MP347', formula: 'HF + 26', quantidade: 2 },
    { eixo: 'L', codigo: 'SU001', formula: 'LF - 26', quantidade: 1 },
    { eixo: 'L', codigo: 'TMC', formula: 'LF - 26', quantidade: 2 },
    { eixo: 'H', codigo: 'SU007', formula: 'HF', quantidade: 2 },
    { eixo: 'H', codigo: 'SU008', formula: 'HF - 13', quantidade: 2 },
    { eixo: 'L', codigo: 'SU053', formula: 'CEIL((LF - 162) / 2)', quantidade: 2 },
    { eixo: 'L', codigo: 'SU225', formula: 'CEIL((LF - 162) / 2)', quantidade: 2 },
    { eixo: 'H', codigo: 'SU280', formula: 'HF - 30', quantidade: 2 },
    { eixo: 'H', codigo: 'SU040', formula: 'HF - 30', quantidade: 1 },
    { eixo: 'H', codigo: 'SU041', formula: 'HF - 30', quantidade: 1 },
    { eixo: 'L', codigo: 'SU102', formula: 'CEIL((LF - 162) / 2)', quantidade: 4 },
    { eixo: 'H', codigo: 'SU102', formula: 'HF - 181', quantidade: 4 },
  ],
}

const portaSuprema3FolhasNucleo: TipologiaFormulasCorte = {
  tipologia_id: 'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e',
  variaveis: [
    { chave: 'perfil_mao_amigo', label: 'Perfil Mão-de-Amigo', opcoes: ['comum', 'largo'] },
    { chave: 'reforco_mao_amigo', label: 'Reforço Mão-de-Amigo', opcoes: ['sem', 'interno', 'externo', 'interno_e_externo'] },
    { chave: 'contramarco', label: 'Contramarco', opcoes: ['nao', 'cm200', 'cm060'] },
    { chave: 'arremate_face_interna', label: 'Arremate Face Interna', opcoes: ['nao', 'sim'] },
    { chave: 'reforco_aba', label: 'Reforço de aba', opcoes: ['nao', 'sim'] },
  ],
  pecas: [
    { codigo: 'SU010', eixo: 'L', quantidade: 1, formula: 'Largura - 30' },
    { codigo: 'TMC', eixo: 'L', quantidade: 3, formula: 'SU010' },
    { codigo: 'SU012', eixo: 'H', quantidade: 2, formula: 'Altura - 4' },
    { codigo: 'SU280', eixo: 'H', quantidade: 2, formula: 'Altura - 34', condicao_ativa: { reforco_aba: ['sim'] } },
    {
      grupo: 'mao_amigo_interno',
      eixo: 'H',
      quantidade: 2,
      formula: 'Altura - 34',
      variaveis_chave: ['perfil_mao_amigo', 'reforco_mao_amigo'],
      mapa_codigo: {
        'comum|sem': 'SU040',
        'comum|interno': 'SU047',
        'comum|externo': 'SU040',
        'comum|interno_e_externo': 'SU047',
        'largo|sem': 'SU243',
        'largo|interno': 'SU289',
        'largo|externo': 'SU243',
        'largo|interno_e_externo': 'SU289',
      },
    },
    {
      grupo: 'mao_amigo_externo',
      eixo: 'H',
      quantidade: 2,
      formula: 'Altura - 34',
      variaveis_chave: ['perfil_mao_amigo', 'reforco_mao_amigo'],
      mapa_codigo: {
        'comum|sem': 'SU041',
        'comum|interno': 'SU041',
        'comum|externo': 'SU049',
        'comum|interno_e_externo': 'SU049',
        'largo|sem': 'SU242',
        'largo|interno': 'SU242',
        'largo|externo': 'SU290',
        'largo|interno_e_externo': 'SU290',
      },
    },
    {
      codigo: 'SU053',
      eixo: 'L',
      quantidade: 3,
      formula: 'ROUND(((SU010 - 130) / 3) * 100) / 100',
      condicoes: [
        { quando: { perfil_mao_amigo: ['comum'], reforco_aba: ['sim'] }, formula: 'ROUND(((SU010 - 154.4) / 3) * 100) / 100' },
        { quando: { perfil_mao_amigo: ['largo'] }, formula: 'ROUND(((SU010 - 199.2) / 3) * 100) / 100' },
      ],
    },
    {
      codigo: 'SU225',
      eixo: 'L',
      quantidade: 3,
      formula: 'SU053',
    },
    {
      codigo: 'SU102',
      eixo: 'L',
      quantidade: 6,
      formula: 'SU053',
    },
    {
      codigo: 'SU102',
      eixo: 'H',
      quantidade: 6,
      formula: 'Altura - 185',
    },
    {
      codigo: 'MP347',
      eixo: 'L',
      quantidade: 1,
      formula: 'Largura + 44',
      condicao_ativa: { arremate_face_interna: ['sim'] },
    },
    {
      codigo: 'MP347',
      eixo: 'H',
      quantidade: 2,
      formula: 'Altura + 22',
      condicao_ativa: { arremate_face_interna: ['sim'] },
    },
  ],
}

const vidroPortaSuprema3Folhas: VidroFormulaDeclarativa = {
  formula_largura: 'CEIL((Largura - 180) / 3)',
  formula_altura: 'Altura - 167',
  quantidade: 3,
  condicoes_largura: [
    {
      quando: { perfil_mao_amigo: ['comum'], reforco_aba: ['sim'] },
      formula: 'CEIL((Largura - 205) / 3)',
    },
    {
      quando: { perfil_mao_amigo: ['largo'] },
      formula: 'CEIL((Largura - 250) / 3)',
    },
  ],
}

const largura2 = 1500
const altura2 = 2200
const resultado2 = calcularFormulasCorte(portaSuprema2Folhas, largura2, altura2, {})
const mapa2 = mapaResultado(resultado2)

const esperado2: Record<string, { tamanho: number; quantidade: number }> = {
  'CM060:L': { tamanho: 1476, quantidade: 1 },
  'CM060:H': { tamanho: 2188, quantidade: 2 },
  'MP347:L': { tamanho: 1544, quantidade: 1 },
  'MP347:H': { tamanho: 2222, quantidade: 2 },
  'SU001:L': { tamanho: 1470, quantidade: 1 },
  'TMC:L': { tamanho: 1470, quantidade: 2 },
  'SU007:H': { tamanho: 2196, quantidade: 2 },
  'SU008:H': { tamanho: 2183, quantidade: 2 },
  'SU053:L': { tamanho: 667, quantidade: 2 },
  'SU225:L': { tamanho: 667, quantidade: 2 },
  'SU280:H': { tamanho: 2166, quantidade: 2 },
  'SU040:H': { tamanho: 2166, quantidade: 1 },
  'SU041:H': { tamanho: 2166, quantidade: 1 },
  'SU102:L': { tamanho: 667, quantidade: 4 },
  'SU102:H': { tamanho: 2015, quantidade: 4 },
}

assert.equal(resultado2.length, Object.keys(esperado2).length)
for (const [chave, valor] of Object.entries(esperado2)) {
  validarPeca(mapa2, chave, valor.tamanho, valor.quantidade)
}
assert.equal(calcularFormulaCorteIsolada('CEIL((LF - 174) / 2)', largura2, altura2), 661)
assert.equal(calcularFormulaCorteIsolada('HF - 163', largura2, altura2), 2033)

type CasoPC3 = {
  nome: string
  fonte: string
  largura: number
  altura: number
  opcoes: OpcoesEscolhidas
  esperado: Record<string, { tamanho: number; quantidade: number }>
  vidro: { largura: number; altura: number; quantidade: number }
}

const casosPC3: CasoPC3[] = [
  {
    nome: 'comum sem reforço de aba',
    fonte: 'W.Vetro orçamento 57',
    largura: 3100,
    altura: 2200,
    opcoes: { perfil_mao_amigo: 'comum', reforco_mao_amigo: 'sem', contramarco: 'nao', arremate_face_interna: 'nao', reforco_aba: 'nao' },
    esperado: {
      'SU010:L': { tamanho: 3070, quantidade: 1 },
      'TMC:L': { tamanho: 3070, quantidade: 3 },
      'SU012:H': { tamanho: 2196, quantidade: 2 },
      'SU040:H': { tamanho: 2166, quantidade: 2 },
      'SU041:H': { tamanho: 2166, quantidade: 2 },
      'SU053:L': { tamanho: 980, quantidade: 3 },
      'SU225:L': { tamanho: 980, quantidade: 3 },
      'SU102:L': { tamanho: 980, quantidade: 6 },
      'SU102:H': { tamanho: 2015, quantidade: 6 },
    },
    vidro: { largura: 974, altura: 2033, quantidade: 3 },
  },
  {
    nome: 'comum com reforço de aba',
    fonte: 'W.Vetro orçamento 130',
    largura: 1549,
    altura: 2105,
    opcoes: { perfil_mao_amigo: 'comum', reforco_mao_amigo: 'sem', contramarco: 'nao', arremate_face_interna: 'nao', reforco_aba: 'sim' },
    esperado: {
      'SU010:L': { tamanho: 1519, quantidade: 1 },
      'SU012:H': { tamanho: 2101, quantidade: 2 },
      'SU280:H': { tamanho: 2071, quantidade: 2 },
      'SU040:H': { tamanho: 2071, quantidade: 2 },
      'SU041:H': { tamanho: 2071, quantidade: 2 },
      'SU053:L': { tamanho: 454.87, quantidade: 3 },
      'SU225:L': { tamanho: 454.87, quantidade: 3 },
      'SU102:L': { tamanho: 454.87, quantidade: 6 },
      'SU102:H': { tamanho: 1920, quantidade: 6 },
    },
    vidro: { largura: 448, altura: 1938, quantidade: 3 },
  },
  {
    nome: 'mão-de-amigo larga com reforço de aba',
    fonte: 'W.Vetro orçamento 1',
    largura: 2200,
    altura: 2300,
    opcoes: { perfil_mao_amigo: 'largo', reforco_mao_amigo: 'sem', contramarco: 'nao', arremate_face_interna: 'nao', reforco_aba: 'sim' },
    esperado: {
      'SU010:L': { tamanho: 2170, quantidade: 1 },
      'SU012:H': { tamanho: 2296, quantidade: 2 },
      'SU280:H': { tamanho: 2266, quantidade: 2 },
      'SU243:H': { tamanho: 2266, quantidade: 2 },
      'SU242:H': { tamanho: 2266, quantidade: 2 },
      'SU053:L': { tamanho: 656.93, quantidade: 3 },
      'SU225:L': { tamanho: 656.93, quantidade: 3 },
      'SU102:L': { tamanho: 656.93, quantidade: 6 },
      'SU102:H': { tamanho: 2115, quantidade: 6 },
    },
    vidro: { largura: 650, altura: 2133, quantidade: 3 },
  },
  {
    nome: 'arremate face interna e reforço externo',
    fonte: 'W.Vetro pedido 931',
    largura: 2784,
    altura: 2202,
    opcoes: { perfil_mao_amigo: 'comum', reforco_mao_amigo: 'externo', contramarco: 'nao', arremate_face_interna: 'sim', reforco_aba: 'sim' },
    esperado: {
      'SU010:L': { tamanho: 2754, quantidade: 1 },
      'SU012:H': { tamanho: 2198, quantidade: 2 },
      'SU280:H': { tamanho: 2168, quantidade: 2 },
      'SU040:H': { tamanho: 2168, quantidade: 2 },
      'SU049:H': { tamanho: 2168, quantidade: 2 },
      'SU053:L': { tamanho: 866.53, quantidade: 3 },
      'MP347:L': { tamanho: 2828, quantidade: 1 },
      'MP347:H': { tamanho: 2224, quantidade: 2 },
    },
    vidro: { largura: 860, altura: 2035, quantidade: 3 },
  },
  {
    nome: 'CM200 sem alterar núcleo folha/vidro',
    fonte: 'W.Vetro pedido 91',
    largura: 2635,
    altura: 2150,
    opcoes: { perfil_mao_amigo: 'comum', reforco_mao_amigo: 'sem', contramarco: 'cm200', arremate_face_interna: 'sim', reforco_aba: 'sim' },
    esperado: {
      'SU010:L': { tamanho: 2605, quantidade: 1 },
      'SU012:H': { tamanho: 2146, quantidade: 2 },
      'SU280:H': { tamanho: 2116, quantidade: 2 },
      'SU040:H': { tamanho: 2116, quantidade: 2 },
      'SU041:H': { tamanho: 2116, quantidade: 2 },
      'SU053:L': { tamanho: 816.87, quantidade: 3 },
      'MP347:L': { tamanho: 2679, quantidade: 1 },
      'MP347:H': { tamanho: 2172, quantidade: 2 },
    },
    vidro: { largura: 810, altura: 1983, quantidade: 3 },
  },
]

for (const caso of casosPC3) {
  const resultado = calcularFormulasCorte(portaSuprema3FolhasNucleo, caso.largura, caso.altura, caso.opcoes)
  const mapa = mapaResultado(resultado)
  for (const [chave, valor] of Object.entries(caso.esperado)) {
    validarPeca(mapa, chave, valor.tamanho, valor.quantidade)
  }

  if (caso.opcoes.reforco_aba === 'nao') {
    assert.equal(mapa.has('SU280:H'), false, `${caso.fonte}: SU280 não deveria existir sem reforço de aba`)
  }
  if (caso.opcoes.arremate_face_interna === 'nao') {
    assert.equal(mapa.has('MP347:L'), false, `${caso.fonte}: MP347 não deveria existir sem arremate`)
  }

  const vidro = calcularVidroFormula(vidroPortaSuprema3Folhas, caso.largura, caso.altura, caso.opcoes)
  assert.deepEqual(vidro, caso.vidro, `Vidro divergente em ${caso.fonte}`)
}

console.log(JSON.stringify({
  ok: true,
  porta2Folhas: {
    fonte: 'self-check legado validado',
    entradaMm: { largura: largura2, altura: altura2 },
    perfisValidados: resultado2.length,
    vidro: { larguraMm: 661, alturaMm: 2033, quantidade: 2 },
  },
  porta3Folhas: {
    status: 'nucleo_validado_localmente',
    casosHistoricosValidados: casosPC3.map(c => c.fonte),
    regrasComprovadas: [
      'SU010, TMC e SU012',
      'presença opcional de SU280 por reforço de aba',
      'mapeamento dos perfis mão-de-amigo comum/largo e reforços interno/externo',
      'travessas e baguetes horizontais por geometria da folha',
      'baguete vertical nos casos de vidro inteiro',
      'MP347 quando existe arremate face interna',
      'vidro de 3 folhas nas famílias de vidro inteiro',
    ],
    pendentes: [
      'SU008: histórico usa descontos distintos (principalmente 17 mm e 21 mm); falta identificar a variável técnica que decide a regra',
      'corte CM060/CM200: não promover fórmula genérica até normalizar a convenção de medida do vão/contramarco',
      'variantes veneziana, bandeira, atrás da parede e travessa larga devem ter famílias/receitas próprias',
    ],
  },
}, null, 2))