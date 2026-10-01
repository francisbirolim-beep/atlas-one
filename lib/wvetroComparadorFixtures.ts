import type { FormulaAtlasComparacao, WVetroItemTecnico } from '@/lib/wvetroComparadorTecnico'

export const FIXTURE_PC2_SUPREMA_WVETRO: WVetroItemTecnico = {
  Codigo: '*SUCB-PC2-01-EF',
  Nome: 'PORTA DE CORRER 02 FOLHAS MÓVEIS | SUPREMA',
  Linha: 'L. SUPREMA',
  Modelo: 'PORTA DE CORRER 02 FOLHAS',
  Largura: 3000,
  Altura: 2200,
  Perfil: [
    { Codigo: 'MP347', Cor: 'PRETO', Nome: 'ARREMATE 37 MM / FACE INTERNA', Qtde: 1, Medida: 3.044, Posicao: 'L' },
    { Codigo: 'MP347', Nome: 'ARREMATE 37 MM / FACE INTERNA', Qtde: 1, Medida: 2.222, Posicao: 'H' },
    { Codigo: 'MP347', Nome: 'ARREMATE 37 MM / FACE INTERNA', Qtde: 1, Medida: 2.222, Posicao: 'H' },
    { Codigo: 'SU001', Nome: 'MARCO SUPERIOR / CORRER 2', Qtde: 1, Medida: 2.970, Posicao: 'L' },
    { Codigo: 'TMC', Nome: 'TRILHO MACARRÃO DE EMBUTIR MEIA-CANA', Qtde: 2, Medida: 2.970, Posicao: 'L' },
    { Codigo: 'SU007', Nome: 'MARCO LATERAL / CORRER 2', Qtde: 2, Medida: 2.196, Posicao: 'H' },
    { Codigo: 'SU008', Nome: 'MATA JUNTA / COMPLEMENTO DO MARCO', Qtde: 2, Medida: 2.183, Posicao: 'H' },
    { Codigo: 'SU053', Nome: 'TRAVESSA DA FOLHA', Qtde: 2, Medida: 1.417, Posicao: 'L' },
    { Codigo: 'SU225', Nome: 'TRAVESSA INFERIOR DA FOLHA', Qtde: 2, Medida: 1.417, Posicao: 'L' },
    { Codigo: 'SU280', Nome: 'MONTANTE LATERAL DA FOLHA | REFORÇO ABA', Qtde: 2, Medida: 2.166, Posicao: 'H' },
    { Codigo: 'SU040', Nome: 'MONTANTE MAO-DE-AMIGO INTERNO', Qtde: 1, Medida: 2.166, Posicao: 'H' },
    { Codigo: 'SU049', Nome: 'MONTANTE MÃO DE AMIGO EXTERNO', Qtde: 1, Medida: 2.166, Posicao: 'H' },
    { Codigo: 'SU102', Nome: 'BAGUETE', Qtde: 4, Medida: 1.417, Posicao: 'L' },
    { Codigo: 'SU102', Nome: 'BAGUETE', Qtde: 4, Medida: 2.015, Posicao: 'H' },
  ],
  Vidros: [
    { Codigo: 'VIDRO', Qtde: 2, Largura: 1411, Altura: 2033, Especificacao: 'INCOLOR 06MM - TEMPERADO' },
  ],
  Acessorios: [
    { Codigo: 'NYL335', Nome: 'VEDAÇÃO SUPERIOR', Qtde: 1 },
    { Codigo: 'NYL332', Nome: 'GUIA DESLIZANTE COM PLACA', Qtde: 8 },
    { Codigo: 'FRA820', Nome: 'FECHADURA BICO DE PAPAGAIO PARA PORTA DE CORRER', Qtde: 2 },
    { Codigo: 'CON409', Nome: 'CONTRAFECHO LATERAL DA FECHADURA', Qtde: 2 },
    { Codigo: 'RPCS100', Nome: 'ROLDANA SIMPLES CÔNCAVA SUPREMA/MEGA 25 - CARGA 100 KG', Qtde: 4 },
    { Codigo: 'NYL357', Nome: 'TAMPA DA MÃO DE AMIGO', Qtde: 2 },
    { Codigo: 'FIT206', Nome: 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5 X 6 MM', Qtde: 2.166 },
    { Codigo: 'FIT246', Nome: 'FITA VEDADORA SEM BARREIRA PLÁSTICA 7,6 X 6 MM', Qtde: 8.664 },
    { Codigo: 'FIT212', Nome: 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5 X 8 MM', Qtde: 12 },
    { Codigo: 'GUA259', Nome: 'GUARNIÇÃO CUNHA DO VIDRO 12 X 4,2 - EPDM PRETO', Qtde: 14.332 },
    { Codigo: 'GUA258', Nome: 'GUARNIÇÃO ESPUMA ADESIVA 11 X 4,8 MM - PRETO', Qtde: 8.664 },
    { Codigo: 'GUA171', Nome: 'GUARNIÇÃO ESPUMA ADESIVA 11 X 3,2 MM - PRETO', Qtde: 5.668 },
    { Codigo: 'PAR435', Nome: 'PARAFUSO AA CP PP 4,8 X 32 MM INOX', Qtde: 16 },
    { Codigo: 'NYL042', Nome: 'BOTÃO TAMPA FURO 3/8 NYLON', Qtde: 8 },
    { Codigo: 'PAR1023', Nome: 'PARAFUSO AA CP 3,9 X 9,5 MM INOX', Qtde: 12 },
    { Codigo: 'NYL190', Nome: 'BOTÃO DE NYL FIXAÇÃO DO ARREMATE', Qtde: 16 },
    { Codigo: 'PAR1025', Nome: 'PARAFUSO AA CP 4,2 X 16 MM INOX', Qtde: 16 },
    { Codigo: 'PAR1037', Nome: 'PARAFUSO AA CP 4,8 X 50 MM INOX', Qtde: 16 },
    { Codigo: 'BUC755', Nome: 'BUCHA DE NYLON P/ FIXAÇÃO S-8', Qtde: 16 },
    { Codigo: 'SIL-PU', Nome: 'SILICONE DE POLIURETANO', Qtde: 1.73333 },
  ],
}

// Snapshot da fórmula Atlas validada no banco em 2026-10-01.
// A fixture serve somente para regressão local; a tela real deverá usar a fórmula atual do banco.
export const FIXTURE_PC2_SUPREMA_ATLAS: FormulaAtlasComparacao = {
  tipologia_id: '58c23780-b110-48ca-b478-0942573d3dd4',
  configuracao_label: 'Mão-amiga comum sem reforço',
  variaveis: [],
  pecas: [
    { eixo: 'L', codigo: 'CM060', formula: 'LF - 20', descricao: 'Contramarco horizontal', quantidade: 1 },
    { eixo: 'H', codigo: 'CM060', formula: 'HF - 8', descricao: 'Contramarco vertical', quantidade: 2 },
    { eixo: 'L', codigo: 'MP347', formula: 'LF + 48', descricao: 'Arremate face interna horizontal', quantidade: 1 },
    { eixo: 'H', codigo: 'MP347', formula: 'HF + 26', descricao: 'Arremate face interna vertical', quantidade: 2 },
    { eixo: 'L', codigo: 'SU001', formula: 'LF - 26', descricao: 'Marco superior / correr 2', quantidade: 1 },
    { eixo: 'L', codigo: 'TMC', formula: 'LF - 26', descricao: 'Trilho macarrão', quantidade: 2 },
    { eixo: 'H', codigo: 'SU007', formula: 'HF', descricao: 'Marco lateral / correr 2', quantidade: 2 },
    { eixo: 'H', codigo: 'SU008', formula: 'HF - 13', descricao: 'Mata-junta / complemento do marco', quantidade: 2 },
    { eixo: 'L', codigo: 'SU053', formula: 'CEIL((LF - 162) / 2)', descricao: 'Travessa superior da folha', quantidade: 2 },
    { eixo: 'L', codigo: 'SU225', formula: 'CEIL((LF - 162) / 2)', descricao: 'Travessa inferior da folha', quantidade: 2 },
    { eixo: 'H', codigo: 'SU280', formula: 'HF - 30', descricao: 'Montante lateral largo com reforço de aba', quantidade: 2 },
    { eixo: 'H', codigo: 'SU040', formula: 'HF - 30', descricao: 'Mão-amiga interna comum sem reforço', quantidade: 1 },
    { eixo: 'H', codigo: 'SU041', formula: 'HF - 30', descricao: 'Mão-amiga externa comum sem reforço', quantidade: 1 },
    { eixo: 'L', codigo: 'SU102', formula: 'CEIL((LF - 162) / 2)', descricao: 'Baguete horizontal', quantidade: 4 },
    { eixo: 'H', codigo: 'SU102', formula: 'HF - 181', descricao: 'Baguete vertical', quantidade: 4 },
  ],
  vidro: {
    quantidade: 2,
    formula_largura: 'CEIL((LF - 174) / 2)',
    formula_altura: 'HF - 163',
    arredondamento: 'sempre_para_cima',
  },
  acessorios: [],
}


// Snapshot sanitizado da configuração genérica PC2 em validação.
// Não é receita validada: serve para revelar, via comparação, quais regras ainda divergem do W.Vetro.
export const FIXTURE_PC2_SUPREMA_GENERICA_ATLAS: FormulaAtlasComparacao = {
  tipologia_id: '58c23780-b110-48ca-b478-0942573d3dd4',
  configuracao_label: 'PC2-SUPREMA · Porta de Correr 02 Folhas · Suprema',
  variaveis: [
    { chave: 'contramarco', label: 'Contramarco', opcoes: ['sem','cm200'] },
    { chave: 'arremate', label: 'Arremate', opcoes: ['sem','interno'] },
    { chave: 'trilho', label: 'Trilho', opcoes: ['macarrao','convencional'] },
    { chave: 'fechamento', label: 'Fechamento', opcoes: ['fechadura','concha'] },
    { chave: 'mao_amigo_largura', label: 'Mão-de-amigo', opcoes: ['comum','largo'] },
    { chave: 'reforco_mao_amigo', label: 'Reforço', opcoes: ['sem_reforco','interno','externo','interno_externo'] },
    { chave: 'roldana', label: 'Roldana', opcoes: ['100','200'] },
    { chave: 'montante_lateral', label: 'Montante lateral móvel', opcoes: ['largo','estreito'] },
    { chave: 'puxador', label: 'Puxador', opcoes: ['sem','sim'] },
    { chave: 'cor', label: 'Cor', opcoes: [] },
    { chave: 'vidro', label: 'Vidro', opcoes: [] },
  ],
  pecas: [
    { eixo:'L',codigo:'CM200',formula:'Largura-48',descricao:'Contramarco horizontal',quantidade:1,condicao_ativa:{contramarco:['cm200']} },
    { eixo:'H',codigo:'CM200',formula:'Altura-24',descricao:'Contramarco vertical',quantidade:2,condicao_ativa:{contramarco:['cm200']} },
    { eixo:'L',codigo:'MP347',formula:'Largura+44',descricao:'Arremate interno horizontal',quantidade:1,condicao_ativa:{arremate:['interno']} },
    { eixo:'H',codigo:'MP347',formula:'Altura+22',descricao:'Arremate interno vertical',quantidade:2,condicao_ativa:{arremate:['interno']} },
    { eixo:'L',codigo:'SU001',formula:'Largura-30',descricao:'Marco superior',quantidade:1,condicoes:[{quando:{contramarco:['cm200']},formula:'Largura-54'}] },
    { eixo:'L',codigo:'TMC',formula:'Largura-30',descricao:'Trilho macarrão',quantidade:2,condicao_ativa:{trilho:['macarrao']},condicoes:[{quando:{contramarco:['cm200']},formula:'Largura-54'}] },
    { eixo:'H',codigo:'SU007',formula:'Altura-4',descricao:'Marco lateral',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-16'}] },
    { eixo:'H',codigo:'SU008',formula:'Altura-17',descricao:'Mata junta',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-29'}] },
    { eixo:'L',codigo:'SU053',formula:'FLOOR((Largura-166)/2)',descricao:'Travessa da folha',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'FLOOR((Largura-190)/2)'},{quando:{contramarco:['cm200'],mao_amigo_largura:['largo']},formula:'FLOOR((Largura-212)/2)'}] },
    { eixo:'L',codigo:'SU225',formula:'FLOOR((Largura-166)/2)',descricao:'Travessa inferior',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'FLOOR((Largura-190)/2)'},{quando:{contramarco:['cm200'],mao_amigo_largura:['largo']},formula:'FLOOR((Largura-212)/2)'}] },
    { eixo:'H',grupo:'montante_lateral',formula:'Altura-34',descricao:'Montante lateral móvel',quantidade:2,variaveis_chave:['montante_lateral'],mapa_codigo:{'largo':'SU280','estreito':'SU245'},condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
    { eixo:'H',grupo:'mao_amigo_interno',formula:'Altura-34',descricao:'Mão-de-amigo interno',quantidade:1,variaveis_chave:['mao_amigo_largura','reforco_mao_amigo'],mapa_codigo:{'comum|externo':'SU040','comum|interno':'SU047','largo|externo':'SU243','largo|interno':'SU289','comum|sem_reforco':'SU040','largo|sem_reforco':'SU243','comum|interno_externo':'SU047','largo|interno_externo':'SU289'},condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
    { eixo:'H',grupo:'mao_amigo_externo',formula:'Altura-34',descricao:'Mão-de-amigo externo',quantidade:1,variaveis_chave:['mao_amigo_largura','reforco_mao_amigo'],mapa_codigo:{'comum|externo':'SU049','comum|interno':'SU041','largo|externo':'SU290','largo|interno':'SU242','comum|sem_reforco':'SU041','largo|sem_reforco':'SU242','comum|interno_externo':'SU049','largo|interno_externo':'SU290'},condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
    { eixo:'L',codigo:'SU102',formula:'FLOOR((Largura-166)/2)',descricao:'Baguete horizontal',quantidade:4,condicoes:[{quando:{contramarco:['cm200']},formula:'FLOOR((Largura-190)/2)'},{quando:{contramarco:['cm200'],mao_amigo_largura:['largo']},formula:'FLOOR((Largura-212)/2)'}] },
    { eixo:'H',codigo:'SU102',formula:'Altura-185',descricao:'Baguete vertical',quantidade:4,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-197'}] },
  ],
  vidro: {
    quantidade: 2,
    formula_largura: 'FLOOR((Largura-178)/2)',
    formula_altura: 'Altura-167',
    condicoes_largura: [
      { quando:{contramarco:['cm200']}, formula:'FLOOR((Largura-202)/2)' },
      { quando:{contramarco:['cm200'],mao_amigo_largura:['largo']}, formula:'FLOOR((Largura-224)/2)' },
    ],
    condicoes_altura: [{ quando:{contramarco:['cm200']}, formula:'Altura-179' }],
  },
  acessorios: [
    { codigo:'RPCS100',formula_quantidade:'Folhas * 2',quantidade_referencia:4,status:'em_validacao',condicao_ativa:{roldana:['100']} },
    { codigo:'NYL332',formula_quantidade:'Folhas * 4',quantidade_referencia:8,status:'em_validacao' },
    { codigo:'PAR435',formula_quantidade:'Folhas * 8',quantidade_referencia:16,status:'em_validacao' },
    { codigo:'CON409',quantidade_referencia:2,status:'referencia',condicao_ativa:{fechamento:['fechadura']} },
    { codigo:'FRA820',quantidade_referencia:2,status:'referencia',condicao_ativa:{fechamento:['fechadura']} },
    { codigo:'NYL042',formula_quantidade:'Folhas * 4',quantidade_referencia:8,status:'em_validacao' },
    { codigo:'NYL335',formula_quantidade:'Folhas - 1',quantidade_referencia:1,status:'em_validacao' },
    { codigo:'PAR1023',quantidade_referencia:12,status:'referencia' },
    { codigo:'PAR1025',quantidade_referencia:15,status:'referencia',condicao_ativa:{arremate:['interno']} },
    { codigo:'CHU838',quantidade_referencia:15,status:'referencia',condicao_ativa:{contramarco:['cm200']} },
    { codigo:'NYL190',quantidade_referencia:15,status:'referencia',condicao_ativa:{arremate:['interno']} },
    { codigo:'NYL-10002',quantidade_referencia:2,status:'referencia',condicao_ativa:{contramarco:['cm200']} },
    { codigo:'NYL357',quantidade_referencia:2,status:'em_validacao',condicao_ativa:{reforco_mao_amigo:['interno','externo','interno_externo']} },
    { codigo:'FIT206',formula_quantidade:'mao_amigo_interno * Encontros / 1000',status:'em_validacao' },
    { codigo:'FIT212',formula_quantidade:'Largura * 4 / 1000',status:'em_validacao' },
    { codigo:'FIT246',formula_quantidade:'montante_lateral * 4 / 1000',status:'em_validacao' },
    { codigo:'GUA171',formula_quantidade:'SU053 * Folhas * 2 / 1000',status:'em_validacao' },
    { codigo:'GUA258',formula_quantidade:'montante_lateral * Folhas * 2 / 1000',status:'em_validacao' },
    { codigo:'GUA259',formula_quantidade:'GUA258 + GUA171',status:'em_validacao' },
    { codigo:'PAR1037',quantidade_referencia:16,status:'referencia',condicao_ativa:{contramarco:['sem']} },
    { codigo:'BUC755',quantidade_referencia:16,status:'referencia',condicao_ativa:{contramarco:['sem']} },
    { codigo:'SIL-PU',formula_quantidade:'(Largura * 2 + Altura * 2) / 6000',status:'em_validacao' },
  ],
}


const PC2_SUPREMA_DOMINANTE_QUANTIDADES_FIXAS: Record<string, string> = {
  CON409: '2',
  FRA820: '2',
  NYL357: '2',
  PAR1023: '12',
  PAR1025: '16',
  NYL190: '16',
  PAR1037: '16',
  BUC755: '16',
}

// Referência histórica estrita para a composição dominante já observada no W.Vetro.
// Mantém a fórmula genérica separada: estas quantidades fixas não são promovidas para outras variantes PC2.
export const FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  ...FIXTURE_PC2_SUPREMA_GENERICA_ATLAS,
  configuracao_label: 'PC2 Suprema · vidro padrão dominante · referência histórica',
  acessorios: (FIXTURE_PC2_SUPREMA_GENERICA_ATLAS.acessorios || []).map(acessorio => {
    const formula = PC2_SUPREMA_DOMINANTE_QUANTIDADES_FIXAS[String(acessorio.codigo || '').toUpperCase()]
    return formula
      ? { ...acessorio, formula_quantidade: formula, status: 'validada' }
      : acessorio
  }),
}


export const FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: 'ecf93bb8-bc6f-4e1b-84eb-40f8c887485a',
  configuracao_label: 'JC2-SUPREMA · referência histórica em validação',
  variaveis: [
    { chave: 'contramarco', label: 'Contramarco', opcoes: ['sem','cm060'] },
    { chave: 'trilho', label: 'Trilho', opcoes: ['convencional','embutido'] },
  ],
  pecas: [
    { eixo:'L',codigo:'CM060',formula:'Largura-24',descricao:'Contramarco horizontal',quantidade:2,condicao_ativa:{contramarco:['cm060']} },
    { eixo:'H',codigo:'CM060',formula:'Altura-24',descricao:'Contramarco vertical',quantidade:2,condicao_ativa:{contramarco:['cm060']} },
    { eixo:'L',codigo:'MP347',formula:'Largura+44',descricao:'Arremate interno horizontal',quantidade:2 },
    { eixo:'H',codigo:'MP347',formula:'Altura+44',descricao:'Arremate interno vertical',quantidade:2 },
    { eixo:'L',codigo:'SU001',formula:'Largura-30',descricao:'Marco superior',quantidade:1 },
    { eixo:'L',codigo:'SU002',formula:'Largura-30',descricao:'Marco inferior 2 planos',quantidade:1 },
    { eixo:'H',codigo:'SU007',formula:'Altura-4',descricao:'Marco lateral',quantidade:2 },
    { eixo:'H',codigo:'SU008',formula:'Altura-38',descricao:'Mata junta',quantidade:2 },
    { eixo:'L',codigo:'SU053',formula:'(Largura-139.6)/2',descricao:'Travessa da folha',quantidade:4 },
    { eixo:'H',codigo:'SU039',formula:'Altura-54',descricao:'Montante de folha',quantidade:2 },
    { eixo:'H',codigo:'SU040',formula:'Altura-54',descricao:'Mão-de-amigo interno',quantidade:1 },
    { eixo:'H',codigo:'SU041',formula:'Altura-54',descricao:'Mão-de-amigo externo',quantidade:1 },
    { eixo:'L',codigo:'SU102',formula:'(Largura-139.6)/2',descricao:'Baguete horizontal',quantidade:4 },
    { eixo:'H',codigo:'SU102',formula:'Altura-156',descricao:'Baguete vertical',quantidade:4 },
  ],
  vidro: {
    quantidade: 2,
    formula_largura: 'FLOOR((Largura-152)/2)',
    formula_altura: 'Altura-138',
  },
  acessorios: [
    { codigo:'NYL329',formula_quantidade:'1',quantidade_referencia:1,status:'em_validacao' },
    { codigo:'NYL335',formula_quantidade:'1',quantidade_referencia:1,status:'em_validacao' },
    { codigo:'NYL332',formula_quantidade:'Folhas * 4',quantidade_referencia:8,status:'em_validacao' },
    { codigo:'NYL414',formula_quantidade:'Folhas * 2',quantidade_referencia:4,status:'em_validacao' },
    { codigo:'FEC1045',formula_quantidade:'Folhas',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'TRA009',formula_quantidade:'Folhas',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'CON370',formula_quantidade:'Folhas',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'ROL440',formula_quantidade:'Folhas * 2',quantidade_referencia:4,status:'em_validacao' },
    { codigo:'FIT206',formula_quantidade:'SU039 / 1000',status:'em_validacao' },
    { codigo:'FIT246',formula_quantidade:'SU039 * 4 / 1000',status:'em_validacao' },
    { codigo:'FIT212',formula_quantidade:'Largura * 4 / 1000',status:'em_validacao' },
    { codigo:'GUA171',formula_quantidade:'SU053 * 4 / 1000',status:'em_validacao' },
    { codigo:'GUA258',formula_quantidade:'SU039 * 4 / 1000',status:'em_validacao' },
    { codigo:'GUA259',formula_quantidade:'GUA258 + GUA171',status:'em_validacao' },
    { codigo:'PAR435',formula_quantidade:'Folhas * 8',quantidade_referencia:16,status:'em_validacao' },
    { codigo:'SIL-PU',formula_quantidade:'(Largura * 2 + Altura * 2) / 6000',status:'em_validacao' },
    { codigo:'CHU838',quantidade_referencia:12,status:'referencia',condicao_ativa:{contramarco:['cm060']} },
    { codigo:'NYL-10005',quantidade_referencia:4,status:'referencia',condicao_ativa:{contramarco:['cm060']} },
    { codigo:'PAR1023',quantidade_referencia:8,status:'referencia' },
    { codigo:'NYL190',quantidade_referencia:12,status:'referencia' },
    { codigo:'PAR1025',quantidade_referencia:12,status:'referencia' },
    { codigo:'PAR1037',quantidade_referencia:12,status:'referencia',condicao_ativa:{contramarco:['sem']} },
    { codigo:'BUC755',quantidade_referencia:12,status:'referencia',condicao_ativa:{contramarco:['sem']} },
  ],
}

function jc2Base(params: {
  codigo: string
  nome: string
  largura: number
  altura: number
  contramarco?: boolean
  perfis: Array<[string,string,number,number]>
  vidro: [number,number]
  acessorios: Array<[string,number]>
}): WVetroItemTecnico {
  return {
    Codigo: params.codigo,
    Nome: params.nome,
    Linha: 'L. SUPREMA',
    Modelo: 'JANELA DE CORRER 02 FOLHAS',
    Qtde: 1,
    Largura: params.largura,
    Altura: params.altura,
    Perfil: params.perfis.map(([Codigo,Posicao,Qtde,Medida]) => ({ Codigo, Posicao, Qtde, Medida })),
    Vidros: [{ Codigo:'VIDRO', Qtde:2, Largura:params.vidro[0], Altura:params.vidro[1], Especificacao:'INCOLOR 06MM - TEMPERADO' }],
    Acessorios: params.acessorios.map(([Codigo,Qtde]) => ({ Codigo, Qtde })),
  }
}

export const FIXTURES_JC2_SUPREMA_WVETRO: WVetroItemTecnico[] = [
  jc2Base({
    codigo:'WV-1145-1',
    nome:'JANELA DE CORRER 02 FOLHAS MOVEIS EM TRILHOS CONVENCIONAIS | SUPREMA SEM CONTRAMARCO',
    largura:1000, altura:1000, vidro:[424,862],
    acessorios:[["NYL329",1],["NYL335",1],["NYL332",8],["NYL414",4],["FEC1045",2],["TRA009",2],["CON370",2],["ROL440",4],["FIT206",0.946],["FIT246",3.784],["FIT212",4],["GUA171",1.7208],["GUA258",3.784],["GUA259",5.5048],["PAR435",16],["PAR1023",6],["NYL190",8],["PAR1025",8],["PAR1037",8],["BUC755",8],["SIL-PU",0.66667]],
    perfis:[
      ['MP347','L',2,1.044],['MP347','H',2,1.044],
      ['SU001','L',1,0.970],['SU002','L',1,0.970],
      ['SU007','H',2,0.996],['SU008','H',2,0.962],
      ['SU053','L',4,0.4302],['SU039','H',2,0.946],
      ['SU040','H',1,0.946],['SU041','H',1,0.946],
      ['SU102','L',4,0.4302],['SU102','H',4,0.844],
    ],
  }),
  jc2Base({
    codigo:'WV-1105-4',
    nome:'JANELA DE CORRER 02 FOLHAS MOVEIS EM TRILHOS CONVENCIONAIS | SUPREMA SEM CONTRAMARCO',
    largura:1275, altura:1040, vidro:[561,902],
    acessorios:[["NYL329",1],["NYL335",1],["NYL332",8],["NYL414",4],["FEC1045",2],["TRA009",2],["CON370",2],["ROL440",4],["FIT206",0.986],["FIT246",3.944],["FIT212",5.1],["GUA171",2.2708],["GUA258",3.944],["GUA259",6.2148],["PAR435",16],["PAR1023",8],["NYL190",12],["PAR1025",12],["PAR1037",12],["BUC755",12],["SIL-PU",0.77167]],
    perfis:[
      ['MP347','L',2,1.319],['MP347','H',2,1.084],
      ['SU001','L',1,1.245],['SU002','L',1,1.245],
      ['SU007','H',2,1.036],['SU008','H',2,1.002],
      ['SU053','L',4,0.5677],['SU039','H',2,0.986],
      ['SU040','H',1,0.986],['SU041','H',1,0.986],
      ['SU102','L',4,0.5677],['SU102','H',4,0.884],
    ],
  }),
  jc2Base({
    codigo:'WV-1144-2',
    nome:'JANELA DE CORRER 02 FOLHAS MOVEIS EM TRILHOS CONVENCIONAIS | SUPREMA COM CONTRAMARCO',
    largura:1152, altura:1062, vidro:[500,924],
    acessorios:[["NYL329",1],["NYL335",1],["NYL332",8],["NYL414",4],["FEC1045",2],["TRA009",2],["CON370",2],["ROL440",4],["FIT206",1.008],["FIT246",4.032],["FIT212",4.608],["GUA171",2.0248],["GUA258",4.032],["GUA259",6.0568],["PAR435",16],["CHU838",12],["NYL-10005",4],["PAR1023",8],["NYL190",12],["PAR1025",12],["SIL-PU",0.738]],
    perfis:[
      ['CM060','L',2,1.128],['CM060','H',2,1.038],
      ['MP347','L',2,1.196],['MP347','H',2,1.106],
      ['SU001','L',1,1.122],['SU002','L',1,1.122],
      ['SU007','H',2,1.058],['SU008','H',2,1.024],
      ['SU053','L',4,0.5062],['SU039','H',2,1.008],
      ['SU040','H',1,1.008],['SU041','H',1,1.008],
      ['SU102','L',4,0.5062],['SU102','H',4,0.906],
    ],
  }),
  jc2Base({
    codigo:'WV-1155-1',
    nome:'JANELA DE CORRER 02 FOLHAS MOVEIS EM TRILHOS EMBUTIDOS | SUPREMA SEM CONTRAMARCO',
    largura:750, altura:1600, vidro:[299,1462],
    acessorios:[["NYL329",1],["NYL335",1],["NYL332",8],["NYL414",4],["FEC1045",2],["TRA009",2],["CON370",2],["ROL440",4],["FIT206",1.546],["FIT246",6.184],["FIT212",3],["GUA171",1.2208],["GUA258",6.184],["GUA259",7.4048],["PAR435",16],["PAR1023",10],["NYL190",12],["PAR1025",12],["PAR1037",12],["BUC755",12],["SIL-PU",0.78333]],
    perfis:[
      ['MP347','L',2,0.794],['MP347','H',2,1.644],
      ['SU001','L',1,0.720],['SU002','L',1,0.720],
      ['SU007','H',2,1.596],['SU008','H',2,1.562],
      ['SU053','L',4,0.3052],['SU039','H',2,1.546],
      ['SU040','H',1,1.546],['SU041','H',1,1.546],
      ['SU102','L',4,0.3052],['SU102','H',4,1.444],
    ],
  }),
]


function pc3ReferenciaHistorica(versao: 'atual_17' | 'legado_21'): FormulaAtlasComparacao {
  const atual = versao === 'atual_17'
  return {
    tipologia_id: 'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e',
    configuracao_label: atual
      ? 'PC3-SUPREMA · referência histórica atual (SU008 -17)'
      : 'PC3-SUPREMA · referência histórica legada (SU008 -21)',
    variaveis: [
      { chave:'contramarco', label:'Contramarco', opcoes:['sem','cm200'] },
      { chave:'arremate', label:'Arremate', opcoes:['sem','interno'] },
      { chave:'versao_mata_junta', label:'Versão histórica do mata-junta', opcoes:[versao] },
    ],
    pecas: [
      { eixo:'L',codigo:'CM200',formula:'Largura-48',descricao:'Contramarco horizontal',quantidade:1,condicao_ativa:{contramarco:['cm200']} },
      { eixo:'H',codigo:'CM200',formula:'Altura-24',descricao:'Contramarco vertical',quantidade:2,condicao_ativa:{contramarco:['cm200']} },
      { eixo:'L',codigo:'MP347',formula:'Largura+44',descricao:'Arremate interno horizontal',quantidade:1,condicao_ativa:{arremate:['interno']},condicoes:[{quando:{contramarco:['cm200']},formula:'Largura+20'}] },
      { eixo:'H',codigo:'MP347',formula:'Altura+22',descricao:'Arremate interno vertical',quantidade:2,condicao_ativa:{arremate:['interno']},condicoes:[{quando:{contramarco:['cm200']},formula:'Altura+10'}] },
      { eixo:'L',codigo:'SU010',formula:'Largura-30',descricao:'Marco superior / correr 3',quantidade:1,condicoes:[{quando:{contramarco:['cm200']},formula:'Largura-54'}] },
      { eixo:'L',codigo:'TMC',formula:'Largura-30',descricao:'Trilho macarrão',quantidade:3,condicoes:[{quando:{contramarco:['cm200']},formula:'Largura-54'}] },
      { eixo:'H',codigo:'SU012',formula:'Altura-4',descricao:'Marco lateral / correr 3',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-16'}] },
      { eixo:'H',codigo:'SU008',formula:atual?'Altura-17':'Altura-21',descricao:'Mata-junta / complemento do marco',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:atual?'Altura-29':'Altura-33'}] },
      { eixo:'L',codigo:'SU053',formula:'(Largura-184.4)/3',descricao:'Travessa superior da folha',quantidade:3,condicoes:[{quando:{contramarco:['cm200']},formula:'(Largura-208.4)/3'}] },
      { eixo:'L',codigo:'SU225',formula:'(Largura-184.4)/3',descricao:'Travessa inferior da folha',quantidade:3,condicoes:[{quando:{contramarco:['cm200']},formula:'(Largura-208.4)/3'}] },
      { eixo:'H',codigo:'SU280',formula:'Altura-34',descricao:'Montante lateral da folha',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
      { eixo:'H',codigo:'SU040',formula:'Altura-34',descricao:'Mão-de-amigo interna',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
      { eixo:'H',codigo:'SU041',formula:'Altura-34',descricao:'Mão-de-amigo externa',quantidade:2,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-46'}] },
      { eixo:'L',codigo:'SU102',formula:'(Largura-184.4)/3',descricao:'Baguete horizontal',quantidade:6,condicoes:[{quando:{contramarco:['cm200']},formula:'(Largura-208.4)/3'}] },
      { eixo:'H',codigo:'SU102',formula:'Altura-185',descricao:'Baguete vertical',quantidade:6,condicoes:[{quando:{contramarco:['cm200']},formula:'Altura-197'}] },
    ],
    vidro: {
      quantidade:3,
      formula_largura:'FLOOR((Largura-203)/3)',
      formula_altura:'Altura-167',
      condicoes_largura:[{quando:{contramarco:['cm200']},formula:'FLOOR((Largura-227)/3)'}],
      condicoes_altura:[{quando:{contramarco:['cm200']},formula:'Altura-179'}],
    },
    acessorios: [
      { codigo:'NYL335',formula_quantidade:'Folhas-1',quantidade_referencia:2,status:'em_validacao' },
      { codigo:'NYL332',formula_quantidade:'Folhas*4',quantidade_referencia:12,status:'em_validacao' },
      { codigo:'NYL414',formula_quantidade:'4*(Folhas-1)',quantidade_referencia:8,status:'em_validacao' },
      { codigo:'FRA820',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
      { codigo:'CON409',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
      { codigo:'RPCS100',formula_quantidade:'Folhas*2',quantidade_referencia:6,status:'em_validacao' },
      { codigo:'FIT206',formula_quantidade:'SU040*2/1000',status:'em_validacao' },
      { codigo:'FIT246',formula_quantidade:'SU040*4/1000',status:'em_validacao' },
      { codigo:'FIT212',formula_quantidade:'Largura*4/1000',status:'em_validacao',condicao_ativa:{contramarco:['sem']} },
      { codigo:'FIT212',formula_quantidade:'(Largura-24)*4/1000',status:'em_validacao',condicao_ativa:{contramarco:['cm200']} },
      { codigo:'GUA171',formula_quantidade:'SU053*6/1000',status:'em_validacao' },
      { codigo:'GUA258',formula_quantidade:'SU040*6/1000',status:'em_validacao' },
      { codigo:'GUA259',formula_quantidade:'GUA258+GUA171',status:'em_validacao' },
      { codigo:'PAR435',formula_quantidade:'Folhas*8',quantidade_referencia:24,status:'em_validacao' },
      { codigo:'NYL042',formula_quantidade:'Folhas*4',quantidade_referencia:12,status:'em_validacao' },
      { codigo:'SIL-PU',formula_quantidade:'(Largura*2+Altura*2)/6000',status:'em_validacao',condicao_ativa:{contramarco:['sem']} },
      { codigo:'SIL-PU',formula_quantidade:'((Largura-24)*2+(Altura-24)*2)/6000',status:'em_validacao',condicao_ativa:{contramarco:['cm200']} },
      { codigo:'PAR1023',quantidade_referencia:12,status:'referencia' },
      { codigo:'NYL190',quantidade_referencia:15,status:'referencia',condicao_ativa:{arremate:['interno']} },
      { codigo:'PAR1025',quantidade_referencia:15,status:'referencia',condicao_ativa:{arremate:['interno']} },
      { codigo:'PAR1037',quantidade_referencia:14,status:'referencia',condicao_ativa:{contramarco:['sem']} },
      { codigo:'BUC755',quantidade_referencia:14,status:'referencia',condicao_ativa:{contramarco:['sem']} },
      { codigo:'CHU838',quantidade_referencia:15,status:'referencia',condicao_ativa:{contramarco:['cm200']} },
      { codigo:'NYL-10002',quantidade_referencia:2,status:'referencia',condicao_ativa:{contramarco:['cm200']} },
    ],
  }
}

export const FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA = pc3ReferenciaHistorica('atual_17')
export const FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA = pc3ReferenciaHistorica('legado_21')

function pc3Item(params:{
  codigo:string
  largura:number
  altura:number
  perfis:Array<[string,string,number,number]>
  vidro:[number,number]
  acessorios:Array<[string,number]>
}): WVetroItemTecnico {
  return {
    Codigo:params.codigo,
    Nome:'PORTA DE CORRER 03 FOLHAS MÓVEIS | SUPREMA',
    Linha:'L. SUPREMA',
    Modelo:'PORTA DE CORRER 03 FOLHAS',
    Qtde:1,
    Largura:params.largura,
    Altura:params.altura,
    Perfil:params.perfis.map(([Codigo,Posicao,Qtde,Medida])=>({Codigo,Posicao,Qtde,Medida:Medida/1000})),
    Vidros:[{Codigo:'VIDRO',Qtde:3,Largura:params.vidro[0],Altura:params.vidro[1],Especificacao:'INCOLOR 06MM - TEMPERADO'}],
    Acessorios:params.acessorios.map(([Codigo,Qtde])=>({Codigo,Qtde})),
  }
}

const pc3AcessoriosBase=(p:{
  fit206:number;fit212:number;fit246:number;gua171:number;gua258:number;gua259:number;sil:number;
  par1023?:number;par1037?:number;buc755?:number;nyl190?:number;par1025?:number;chu838?:number;nyl10002?:number;
}) => [
  ['NYL335',2],['NYL332',12],['NYL414',8],['FRA820',2],['CON409',2],['RPCS100',6],
  ['FIT206',p.fit206],['FIT212',p.fit212],['FIT246',p.fit246],['GUA171',p.gua171],['GUA258',p.gua258],['GUA259',p.gua259],
  ['PAR435',24],['NYL042',12],['SIL-PU',p.sil],
  ...(p.par1023!=null?[['PAR1023',p.par1023]]:[]),
  ...(p.par1037!=null?[['PAR1037',p.par1037]]:[]),
  ...(p.buc755!=null?[['BUC755',p.buc755]]:[]),
  ...(p.nyl190!=null?[['NYL190',p.nyl190]]:[]),
  ...(p.par1025!=null?[['PAR1025',p.par1025]]:[]),
  ...(p.chu838!=null?[['CHU838',p.chu838]]:[]),
  ...(p.nyl10002!=null?[['NYL-10002',p.nyl10002]]:[]),
] as Array<[string,number]>

export const FIXTURES_PC3_SUPREMA_ATUAL_WVETRO: WVetroItemTecnico[] = [
  pc3Item({
    codigo:'WV-1044-5',largura:2000,altura:2150,vidro:[599,1983],
    perfis:[
      ['SU010','L',1,1970],['TMC','L',3,1970],['SU012','H',2,2146],['SU008','H',2,2133],
      ['SU053','L',3,605.2],['SU225','L',3,605.2],['SU280','H',2,2116],['SU040','H',2,2116],['SU041','H',2,2116],
      ['SU102','L',6,605.2],['SU102','H',6,1965],
    ],
    acessorios:pc3AcessoriosBase({fit206:4.232,fit212:8,fit246:8.464,gua171:3.6312,gua258:12.696,gua259:16.3272,sil:1.38333,par1023:12,par1037:14,buc755:14}),
  }),
  pc3Item({
    codigo:'WV-1130-3',largura:3370,altura:2200,vidro:[1055,2033],
    perfis:[
      ['MP347','L',1,3414],['MP347','H',2,2222],['SU010','L',1,3340],['TMC','L',3,3340],['SU012','H',2,2196],['SU008','H',2,2183],
      ['SU053','L',3,1061.87],['SU225','L',3,1061.87],['SU280','H',2,2166],['SU040','H',2,2166],['SU041','H',2,2166],
      ['SU102','L',6,1061.87],['SU102','H',6,2015],
    ],
    acessorios:pc3AcessoriosBase({fit206:4.332,fit212:13.48,fit246:8.664,gua171:6.3712,gua258:12.996,gua259:19.3672,sil:1.85667,par1023:12,par1037:17,buc755:17,nyl190:17,par1025:17}),
  }),
  pc3Item({
    codigo:'WV-980-2',largura:2500,altura:2100,vidro:[757,1921],
    perfis:[
      ['CM200','L',1,2452],['CM200','H',2,2076],['MP347','L',1,2520],['MP347','H',2,2110],
      ['SU010','L',1,2446],['TMC','L',3,2446],['SU012','H',2,2084],['SU008','H',2,2071],
      ['SU053','L',3,763.87],['SU225','L',3,763.87],['SU280','H',2,2054],['SU040','H',2,2054],['SU041','H',2,2054],
      ['SU102','L',6,763.87],['SU102','H',6,1903],
    ],
    acessorios:pc3AcessoriosBase({fit206:4.108,fit212:9.904,fit246:8.216,gua171:4.5832,gua258:12.324,gua259:16.9072,sil:1.51733,par1023:12,nyl190:15,par1025:15,chu838:15,nyl10002:2}),
  }),
]

export const FIXTURE_PC3_SUPREMA_LEGADO_WVETRO: WVetroItemTecnico = pc3Item({
  codigo:'WV-637-1',largura:1580,altura:2150,vidro:[459,1983],
  perfis:[
    ['MP347','L',1,1624],['MP347','H',2,2172],['SU010','L',1,1550],['TMC','L',3,1550],['SU012','H',2,2146],['SU008','H',2,2129],
    ['SU053','L',3,465.2],['SU225','L',3,465.2],['SU280','H',2,2116],['SU040','H',2,2116],['SU041','H',2,2116],
    ['SU102','L',6,465.2],['SU102','H',6,1965],
  ],
  acessorios:pc3AcessoriosBase({fit206:4.232,fit212:6.32,fit246:8.464,gua171:2.7912,gua258:12.696,gua259:15.4872,sil:1.24333,par1023:12,par1037:14,buc755:14,nyl190:14,par1025:14}),
})


export const FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id:'5a37c6f1-76eb-4e26-884c-9b4fc896a953',
  configuracao_label:'JC3-SUPREMA · referência histórica moderna com arremate interno',
  variaveis:[
    { chave:'contramarco',label:'Contramarco',opcoes:['sem','cm060','cm200'] },
    { chave:'arremate',label:'Arremate',opcoes:['interno'] },
  ],
  pecas:[
    { eixo:'L',codigo:'CM060',formula:'Largura-24',descricao:'Contramarco horizontal CM060',quantidade:2,condicao_ativa:{contramarco:['cm060']} },
    { eixo:'H',codigo:'CM060',formula:'Altura-24',descricao:'Contramarco vertical CM060',quantidade:2,condicao_ativa:{contramarco:['cm060']} },
    { eixo:'L',codigo:'CM200',formula:'Largura-24',descricao:'Contramarco horizontal CM200',quantidade:2,condicao_ativa:{contramarco:['cm200']} },
    { eixo:'H',codigo:'CM200',formula:'Altura-24',descricao:'Contramarco vertical CM200',quantidade:2,condicao_ativa:{contramarco:['cm200']} },
    { eixo:'L',codigo:'MP347',formula:'Largura+44',descricao:'Arremate interno horizontal',quantidade:2 },
    { eixo:'H',codigo:'MP347',formula:'Altura+44',descricao:'Arremate interno vertical',quantidade:2 },
    { eixo:'L',codigo:'SU010',formula:'Largura-30',descricao:'Marco superior',quantidade:1 },
    { eixo:'L',codigo:'SU011',formula:'Largura-30',descricao:'Marco inferior',quantidade:1 },
    { eixo:'H',codigo:'SU012',formula:'Altura-4',descricao:'Marco lateral',quantidade:2 },
    { eixo:'H',codigo:'SU008',formula:'Altura-38',descricao:'Mata-junta',quantidade:2 },
    { eixo:'H',codigo:'SU039',formula:'Altura-54',descricao:'Montante lateral',quantidade:2 },
    { eixo:'H',codigo:'SU040',formula:'Altura-54',descricao:'Mão-de-amigo interna',quantidade:2 },
    { eixo:'H',codigo:'SU041',formula:'Altura-54',descricao:'Mão-de-amigo externa',quantidade:2 },
    { eixo:'L',codigo:'SU053',formula:'(Largura-159)/3',descricao:'Travessa da folha',quantidade:6 },
    { eixo:'L',codigo:'SU102',formula:'(Largura-159)/3',descricao:'Baguete horizontal',quantidade:6 },
    { eixo:'H',codigo:'SU102',formula:'Altura-156',descricao:'Baguete vertical',quantidade:6 },
  ],
  vidro:{
    quantidade:3,
    formula_largura:'FLOOR((Largura-178)/3)',
    formula_altura:'Altura-138',
  },
  acessorios:[
    { codigo:'NYL329',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'NYL335',formula_quantidade:'Folhas-1',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'NYL332',formula_quantidade:'Folhas*4',quantidade_referencia:12,status:'em_validacao' },
    { codigo:'NYL414',formula_quantidade:'4*(Folhas-1)',quantidade_referencia:8,status:'em_validacao' },
    { codigo:'CON370',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'FEC1045',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'ROL440',formula_quantidade:'Folhas*2',quantidade_referencia:6,status:'em_validacao' },
    { codigo:'TRA009',formula_quantidade:'2',quantidade_referencia:2,status:'em_validacao' },
    { codigo:'FIT206',formula_quantidade:'Altura*2/1000',status:'em_validacao' },
    { codigo:'FIT246',formula_quantidade:'Altura*4/1000',status:'em_validacao' },
    { codigo:'FIT212',formula_quantidade:'Largura*4/1000',status:'em_validacao' },
    { codigo:'GUA171',formula_quantidade:'Largura*2/1000',status:'em_validacao' },
    { codigo:'GUA258',formula_quantidade:'Altura*6/1000',status:'em_validacao' },
    { codigo:'GUA259',formula_quantidade:'GUA171+GUA258',status:'em_validacao' },
    { codigo:'PAR435',formula_quantidade:'Folhas*8',quantidade_referencia:24,status:'em_validacao' },
    { codigo:'SIL-PU',formula_quantidade:'(Largura*2+Altura*2)/6000',status:'em_validacao' },
    { codigo:'PAR1023',quantidade_referencia:6,status:'referencia' },
    { codigo:'NYL190',quantidade_referencia:14,status:'referencia' },
    { codigo:'PAR1025',quantidade_referencia:14,status:'referencia' },
    { codigo:'PAR1037',quantidade_referencia:16,status:'referencia',condicao_ativa:{contramarco:['sem']} },
    { codigo:'BUC755',quantidade_referencia:16,status:'referencia',condicao_ativa:{contramarco:['sem']} },
    { codigo:'CHU838',quantidade_referencia:14,status:'referencia',condicao_ativa:{contramarco:['cm060','cm200']} },
    { codigo:'NYL-10002',quantidade_referencia:4,status:'referencia',condicao_ativa:{contramarco:['cm200']} },
    { codigo:'NYL-10005',quantidade_referencia:4,status:'referencia',condicao_ativa:{contramarco:['cm060']} },
  ],
}

function jc3Item(params:{
  codigo:string;largura:number;altura:number;cm?:'cm060'|'cm200';
  perfis:Array<[string,string,number,number]>;vidro:[number,number];acessorios:Array<[string,number]>;
}):WVetroItemTecnico{
  return {
    Codigo:params.codigo,
    Nome:'JANELA DE CORRER 03 FOLHAS MÓVEIS | SUPREMA',
    Linha:'L. SUPREMA',
    Modelo:'JANELA DE CORRER 03 FOLHAS',
    Qtde:1,Largura:params.largura,Altura:params.altura,
    Perfil:params.perfis.map(([Codigo,Posicao,Qtde,Medida])=>({Codigo,Posicao,Qtde,Medida:Medida/1000})),
    Vidros:[{Codigo:'VIDRO',Qtde:3,Largura:params.vidro[0],Altura:params.vidro[1],Especificacao:'INCOLOR 06MM - TEMPERADO'}],
    Acessorios:params.acessorios.map(([Codigo,Qtde])=>({Codigo,Qtde})),
  }
}

const jc3Acc=(p:{l:number;h:number;par1023:number;fix:number;cm?:'cm060'|'cm200'})=>{
  const arr:Array<[string,number]>=[
    ['NYL329',2],['NYL335',2],['NYL332',12],['NYL414',8],['CON370',2],['FEC1045',2],['ROL440',6],['TRA009',2],
    ['FIT206',p.h*2/1000],['FIT246',p.h*4/1000],['FIT212',p.l*4/1000],
    ['GUA171',p.l*2/1000],['GUA258',p.h*6/1000],['GUA259',(p.l*2+p.h*6)/1000],
    ['PAR435',24],['SIL-PU',(p.l*2+p.h*2)/6000],
    ['PAR1023',p.par1023],['NYL190',p.fix],['PAR1025',p.fix],
  ]
  if(!p.cm) arr.push(['PAR1037',p.fix],['BUC755',p.fix])
  else {
    arr.push(['CHU838',14])
    arr.push([p.cm==='cm200'?'NYL-10002':'NYL-10005',4])
  }
  return arr
}

export const FIXTURES_JC3_SUPREMA_WVETRO:WVetroItemTecnico[]=[
  jc3Item({
    codigo:'WV-528-4',largura:1600,altura:1600,vidro:[474,1462],
    perfis:[
      ['MP347','L',2,1644],['MP347','H',2,1644],['SU010','L',1,1570],['SU011','L',1,1570],['SU012','H',2,1596],['SU008','H',2,1562],
      ['SU039','H',2,1546],['SU040','H',2,1546],['SU041','H',2,1546],['SU053','L',6,480.33],['SU102','L',6,480.33],['SU102','H',6,1444],
    ],
    acessorios:jc3Acc({l:1600,h:1600,par1023:10,fix:16}),
  }),
  jc3Item({
    codigo:'WV-878-1',largura:2300,altura:800,vidro:[707,662],
    perfis:[
      ['MP347','L',2,2344],['MP347','H',2,844],['SU010','L',1,2270],['SU011','L',1,2270],['SU012','H',2,796],['SU008','H',2,762],
      ['SU039','H',2,746],['SU040','H',2,746],['SU041','H',2,746],['SU053','L',6,713.67],['SU102','L',6,713.67],['SU102','H',6,644],
    ],
    acessorios:jc3Acc({l:2300,h:800,par1023:6,fix:16}),
  }),
  jc3Item({
    codigo:'WV-976-2',largura:2074,altura:481,vidro:[632,343],
    perfis:[
      ['MP347','L',2,2118],['MP347','H',2,525],['SU010','L',1,2044],['SU011','L',1,2044],['SU012','H',2,477],['SU008','H',2,443],
      ['SU039','H',2,427],['SU040','H',2,427],['SU041','H',2,427],['SU053','L',6,638.33],['SU102','L',6,638.33],['SU102','H',6,325],
    ],
    acessorios:jc3Acc({l:2074,h:481,par1023:4,fix:12}),
  }),
  jc3Item({
    codigo:'WV-556-6',largura:1970,altura:970,vidro:[597,832],
    perfis:[
      ['CM060','L',2,1946],['CM060','H',2,946],['MP347','L',2,2014],['MP347','H',2,1014],
      ['SU010','L',1,1940],['SU011','L',1,1940],['SU012','H',2,966],['SU008','H',2,932],
      ['SU039','H',2,916],['SU040','H',2,916],['SU041','H',2,916],['SU053','L',6,603.67],['SU102','L',6,603.67],['SU102','H',6,814],
    ],
    acessorios:jc3Acc({l:1970,h:970,par1023:6,fix:14,cm:'cm060'}),
  }),
  jc3Item({
    codigo:'WV-269-14',largura:2600,altura:600,vidro:[807,462],
    perfis:[
      ['CM200','L',2,2576],['CM200','H',2,576],['MP347','L',2,2644],['MP347','H',2,644],
      ['SU010','L',1,2570],['SU011','L',1,2570],['SU012','H',2,596],['SU008','H',2,562],
      ['SU039','H',2,546],['SU040','H',2,546],['SU041','H',2,546],['SU053','L',6,813.67],['SU102','L',6,813.67],['SU102','H',6,444],
    ],
    acessorios:jc3Acc({l:2600,h:600,par1023:6,fix:14,cm:'cm200'}),
  }),
]

export const FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051',
  configuracao_label: 'PG1-SUPREMA · Lambril · sem contramarco · referência histórica em validação',
  variaveis: [],
  pecas: [
    { eixo:'L', codigo:'MP347', formula:'Largura+44', descricao:'Arremate interno horizontal', quantidade:1 },
    { eixo:'H', codigo:'MP347', formula:'Altura+22', descricao:'Arremate interno vertical', quantidade:2 },
    { eixo:'L', codigo:'SU279', formula:'Largura-4', descricao:'Marco horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU279', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'L', codigo:'SU111', formula:'Largura-72', descricao:'Montante folha de giro horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU111', formula:'Altura-49', descricao:'Montante folha de giro vertical', quantidade:2 },
    { eixo:'L', codigo:'SU225', formula:'Largura-172', descricao:'Travessa inferior da folha', quantidade:1 },
    { eixo:'L', codigo:'SU102', formula:'Largura-172', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU102', formula:'Altura-211', descricao:'Baguete vertical', quantidade:2 },
    {
      eixo:'L',
      codigo:'GS-034',
      formula:'Largura-173',
      descricao:'Lambril duplo horizontal',
      formula_quantidade:'CEIL((Altura-28)/108.2)',
    },
    { eixo:'L', codigo:'25-548 (L-715)', formula:'Largura-53', descricao:'Complemento folha horizontal', quantidade:1 },
    { eixo:'H', codigo:'25-548 (L-715)', formula:'Altura-30', descricao:'Complemento folha vertical', quantidade:1 },
  ],
  acessorios: [
    { codigo:'GUA239', formula_quantidade:'(Largura + Altura * 2) / 1000', status:'em_validacao' },
    { codigo:'PAR435', formula_quantidade:'4', status:'em_validacao' },
    { codigo:'NYL042', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'REBACA4X10', quantidade_referencia:8, status:'referencia' },
    { codigo:'FIT206', formula_quantidade:'(Largura + Altura) / 1000', status:'em_validacao' },
    { codigo:'DOB840', formula_quantidade:'3', status:'em_validacao' },
    { codigo:'FRA822', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'CON295', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'MAC927', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'GUA258', formula_quantidade:'Altura * 2 / 1000', status:'em_validacao' },
    { codigo:'NYL190', formula_quantidade:'12', status:'em_validacao' },
    { codigo:'PAR1025', formula_quantidade:'12', status:'em_validacao' },
    { codigo:'PAR1037', formula_quantidade:'12', status:'em_validacao' },
    { codigo:'BUC755', formula_quantidade:'12', status:'em_validacao' },
    { codigo:'SIL-PU', formula_quantidade:'(Largura + Altura * 2) / 12000', status:'em_validacao' },
    { codigo:'ALMC25', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'ALMC2960', formula_quantidade:'2', status:'em_validacao' },
  ],
}

function pg1LambrilBase(params: {
  codigo: string
  nome: string
  largura: number
  altura: number
  perfis: Array<[string,string,number,number]>
  acessorios: Array<[string,number]>
}): WVetroItemTecnico {
  return {
    Codigo: params.codigo,
    Nome: params.nome,
    Linha: 'L. SUPREMA',
    Modelo: 'PORTA DE GIRO 01 FOLHA',
    Qtde: 1,
    Largura: params.largura,
    Altura: params.altura,
    Perfil: params.perfis.map(([Codigo,Posicao,Qtde,Medida]) => ({ Codigo, Posicao, Qtde, Medida })),
    Acessorios: params.acessorios.map(([Codigo,Qtde]) => ({ Codigo, Qtde })),
  }
}

export const FIXTURES_PG1_LAMBRIL_SUPREMA_WVETRO: WVetroItemTecnico[] = [
  pg1LambrilBase({
    codigo:'WV-PG1-LAMBRIL-860X2033',
    nome:'PORTA DE GIRO 01 FOLHA COM LAMBRI | SUPREMA SEM CONTRAMARCO',
    largura:860, altura:2033,
    perfis:[
      ['25-548 (L-715)','H',1,2.003],['MP347','H',2,2.055],['SU111','H',2,1.984],['SU279','H',2,2.029],
      ['25-548 (L-715)','L',1,0.807],['MP347','L',1,0.904],['SU111','L',1,0.788],['SU225','L',1,0.688],
      ['SU279','L',1,0.856],['SU102','H',2,1.822],['SU102','L',2,0.688],['GS-034','L',19,0.687],
    ],
    acessorios:[['ALMC25',2],['ALMC2960',2],['BUC755',12],['CON295',1],['DOB840',3],['FIT206',2.893],['FRA822',1],['GUA239',4.926],['GUA258',4.066],['MAC927',1],['NYL042',2],['NYL190',12],['PAR1025',12],['PAR1037',12],['PAR435',4],['REBACA4X10',8],['SIL-PU',0.4105]],
  }),
  pg1LambrilBase({
    codigo:'WV-PG1-LAMBRIL-600X2100',
    nome:'PORTA DE GIRO 01 FOLHA COM LAMBRI DUPLO HORIZONTAL | SUPREMA SEM CONTRAMARCO',
    largura:600, altura:2100,
    perfis:[
      ['25-548 (L-715)','H',1,2.070],['MP347','H',2,2.122],['SU111','H',2,2.051],['SU279','H',2,2.096],
      ['25-548 (L-715)','L',1,0.547],['MP347','L',1,0.644],['SU111','L',1,0.528],['SU225','L',1,0.428],
      ['SU279','L',1,0.596],['SU102','H',2,1.889],['SU102','L',2,0.428],['GS-034','L',20,0.427],
    ],
    acessorios:[['ALMC25',2],['ALMC2960',2],['BUC755',12],['CON295',1],['DOB840',3],['FIT206',2.7],['FRA822',1],['GUA239',4.8],['GUA258',4.2],['MAC927',1],['NYL042',2],['NYL190',12],['PAR1025',12],['PAR1037',12],['PAR435',4],['REBACA4X10',7],['SIL-PU',0.4]],
  }),
  pg1LambrilBase({
    codigo:'WV-PG1-LAMBRIL-800X2091',
    nome:'PORTA DE GIRO 01 FOLHA COM LAMBRI DUPLO | SUPREMA SEM CONTRAMARCO',
    largura:800, altura:2091,
    perfis:[
      ['25-548 (L-715)','H',1,2.061],['MP347','H',2,2.113],['SU111','H',2,2.042],['SU279','H',2,2.087],
      ['25-548 (L-715)','L',1,0.747],['MP347','L',1,0.844],['SU111','L',1,0.728],['SU225','L',1,0.628],
      ['SU279','L',1,0.796],['SU102','H',2,1.880],['SU102','L',2,0.628],['GS-034','L',20,0.627],
    ],
    acessorios:[['ALMC25',2],['ALMC2960',2],['BUC755',12],['CON295',1],['DOB840',3],['FIT206',2.891],['FRA822',1],['GUA239',4.982],['GUA258',4.182],['MAC927',1],['NYL042',2],['NYL190',12],['PAR1025',12],['PAR1037',12],['PAR435',4],['REBACA4X10',8],['SIL-PU',0.41517]],
  }),
  pg1LambrilBase({
    codigo:'WV-PG1-LAMBRIL-900X2200',
    nome:'PORTA DE GIRO 01 FOLHA COM LAMBRI DUPLO HORIZONTAL | SUPREMA SEM CONTRAMARCO',
    largura:900, altura:2200,
    perfis:[
      ['25-548 (L-715)','H',1,2.170],['MP347','H',2,2.222],['SU111','H',2,2.151],['SU279','H',2,2.196],
      ['25-548 (L-715)','L',1,0.847],['MP347','L',1,0.944],['SU111','L',1,0.828],['SU225','L',1,0.728],
      ['SU279','L',1,0.896],['SU102','H',2,1.989],['SU102','L',2,0.728],['GS-034','L',21,0.727],
    ],
    acessorios:[['ALMC25',2],['ALMC2960',2],['BUC755',12],['CON295',1],['DOB840',3],['FIT206',3.1],['FRA822',1],['GUA239',5.3],['GUA258',4.4],['MAC927',1],['NYL042',2],['NYL190',12],['PAR1025',12],['PAR1037',12],['PAR435',4],['REBACA4X10',8],['SIL-PU',0.44167]],
  }),
]

export const FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '4aeb8629-221b-42cd-9379-c0ae1bcaf045',
  configuracao_label: 'MAX1-SUPREMA · 01 módulo · BRA702 · sem contramarco · referência histórica dominante',
  variaveis: [],
  pecas: [
    { eixo:'L', codigo:'MP347', formula:'Largura+44', descricao:'Arremate interno horizontal', quantidade:2 },
    { eixo:'H', codigo:'MP347', formula:'Altura+44', descricao:'Arremate interno vertical', quantidade:2 },
    { eixo:'L', codigo:'SU079', formula:'Largura-4', descricao:'Marco horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU079', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'L', codigo:'SU276', formula:'Largura-4', descricao:'Pingadeira do marco', quantidade:1 },
    { eixo:'L', codigo:'SU082', formula:'Largura-96', descricao:'Travessa da folha', quantidade:2 },
    { eixo:'L', codigo:'SU084', formula:'Largura-34', descricao:'Pingadeira da folha', quantidade:1 },
    { eixo:'H', codigo:'SU081', formula:'Altura-60', descricao:'Montante da folha', quantidade:2 },
    { eixo:'L', codigo:'SU102', formula:'Largura-96', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU102', formula:'Altura-120', descricao:'Baguete vertical', quantidade:2 },
  ],
  vidro: {
    quantidade: 1,
    formula_largura: 'Largura-102',
    formula_altura: 'Altura-102',
  },
  acessorios: [
    { codigo:'REBACA4X10', formula_quantidade:'3', status:'em_validacao' },
    { codigo:'GUA239', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'GUA007', formula_quantidade:'Largura/1000', status:'em_validacao' },
    { codigo:'PAR435', formula_quantidade:'4', status:'em_validacao' },
    { codigo:'NYL355', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'FEC009D', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'BRA702', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'GUA256', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'GUA157', formula_quantidade:'(Largura+4*Altura)/1000', status:'em_validacao' },
    { codigo:'GUA258', formula_quantidade:'3*Largura/1000', status:'em_validacao' },
    { codigo:'NYL190', formula_quantidade:'8', status:'em_validacao' },
    { codigo:'PAR1025', formula_quantidade:'8', status:'em_validacao' },
    { codigo:'PAR1037', formula_quantidade:'8', status:'em_validacao' },
    { codigo:'BUC755', formula_quantidade:'8', status:'em_validacao' },
    { codigo:'SIL-PU', formula_quantidade:'2*(Largura+Altura)/12000', status:'em_validacao' },
    { codigo:'ALMC25', formula_quantidade:'4', status:'em_validacao' },
  ],
}

function max1SupremaItem(largura:number, altura:number, quantidade = 1): WVetroItemTecnico {
  const l = largura
  const h = altura
  return {
    Codigo: '*SUCB-MAX-01-EF',
    Nome: 'MAXIM-AR COM 01 MÓDULO | SUPREMA',
    Linha: 'L. SUPREMA',
    Modelo: 'MAXIM-AR',
    Qtde: quantidade,
    Largura: l,
    Altura: h,
    Perfil: [
      { Codigo:'MP347', Posicao:'L', Qtde:2*quantidade, Medida:(l+44)/1000 },
      { Codigo:'MP347', Posicao:'H', Qtde:2*quantidade, Medida:(h+44)/1000 },
      { Codigo:'SU079', Posicao:'L', Qtde:2*quantidade, Medida:(l-4)/1000 },
      { Codigo:'SU079', Posicao:'H', Qtde:2*quantidade, Medida:(h-4)/1000 },
      { Codigo:'SU276', Posicao:'L', Qtde:1*quantidade, Medida:(l-4)/1000 },
      { Codigo:'SU082', Posicao:'L', Qtde:2*quantidade, Medida:(l-96)/1000 },
      { Codigo:'SU084', Posicao:'L', Qtde:1*quantidade, Medida:(l-34)/1000 },
      { Codigo:'SU081', Posicao:'H', Qtde:2*quantidade, Medida:(h-60)/1000 },
      { Codigo:'SU102', Posicao:'L', Qtde:2*quantidade, Medida:(l-96)/1000 },
      { Codigo:'SU102', Posicao:'H', Qtde:2*quantidade, Medida:(h-120)/1000 },
    ],
    Vidros: [{
      Codigo:'VIDRO',
      Qtde:1*quantidade,
      Largura:l-102,
      Altura:h-102,
      Especificacao:'MINI-BOREAL 04MM - COMUM',
    }],
    Acessorios: [
      { Codigo:'REBACA4X10', Qtde:3*quantidade },
      { Codigo:'GUA239', Qtde:(2*(l+h)/1000)*quantidade },
      { Codigo:'GUA007', Qtde:(l/1000)*quantidade },
      { Codigo:'PAR435', Qtde:4*quantidade },
      { Codigo:'NYL355', Qtde:2*quantidade },
      { Codigo:'FEC009D', Qtde:1*quantidade },
      { Codigo:'BRA702', Qtde:1*quantidade },
      { Codigo:'GUA256', Qtde:(2*(l+h)/1000)*quantidade },
      { Codigo:'GUA157', Qtde:((l+4*h)/1000)*quantidade },
      { Codigo:'GUA258', Qtde:(3*l/1000)*quantidade },
      { Codigo:'NYL190', Qtde:8*quantidade },
      { Codigo:'PAR1025', Qtde:8*quantidade },
      { Codigo:'PAR1037', Qtde:8*quantidade },
      { Codigo:'BUC755', Qtde:8*quantidade },
      { Codigo:'SIL-PU', Qtde:(2*(l+h)/12000)*quantidade },
      { Codigo:'ALMC25', Qtde:4*quantidade },
    ],
  }
}

export const FIXTURES_MAX1_SUPREMA_WVETRO: WVetroItemTecnico[] = [
  max1SupremaItem(600,600,1),
  max1SupremaItem(800,600,1),
  max1SupremaItem(800,800,1),
  max1SupremaItem(900,700,2),
  max1SupremaItem(1000,600,2),
]

function max1PecasBase(params:{arremate:boolean;cm200:boolean}) {
  return [
    ...(params.cm200 ? [
      { eixo:'L' as const, codigo:'CM200', formula:'Largura-24', descricao:'Contramarco horizontal', quantidade:2 },
      { eixo:'H' as const, codigo:'CM200', formula:'Altura-24', descricao:'Contramarco vertical', quantidade:2 },
    ] : []),
    ...(params.arremate ? [
      { eixo:'L' as const, codigo:'MP347', formula:'Largura+44', descricao:'Arremate interno horizontal', quantidade:2 },
      { eixo:'H' as const, codigo:'MP347', formula:'Altura+44', descricao:'Arremate interno vertical', quantidade:2 },
    ] : []),
    { eixo:'L' as const, codigo:'SU079', formula:'Largura-4', descricao:'Marco horizontal', quantidade:2 },
    { eixo:'H' as const, codigo:'SU079', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'L' as const, codigo:'SU276', formula:'Largura-4', descricao:'Pingadeira do marco', quantidade:1 },
    { eixo:'L' as const, codigo:'SU082', formula:'Largura-96', descricao:'Travessa da folha', quantidade:2 },
    { eixo:'L' as const, codigo:'SU084', formula:'Largura-34', descricao:'Pingadeira da folha', quantidade:1 },
    { eixo:'H' as const, codigo:'SU081', formula:'Altura-60', descricao:'Montante da folha', quantidade:2 },
    { eixo:'L' as const, codigo:'SU102', formula:'Largura-96', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H' as const, codigo:'SU102', formula:'Altura-120', descricao:'Baguete vertical', quantidade:2 },
  ]
}

const max1AcessoriosComuns = [
  { codigo:'REBACA4X10', formula_quantidade:'3', status:'em_validacao' as const },
  { codigo:'GUA239', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' as const },
  { codigo:'GUA007', formula_quantidade:'Largura/1000', status:'em_validacao' as const },
  { codigo:'PAR435', formula_quantidade:'4', status:'em_validacao' as const },
  { codigo:'NYL355', formula_quantidade:'2', status:'em_validacao' as const },
  { codigo:'FEC009D', formula_quantidade:'1', status:'em_validacao' as const },
  { codigo:'BRA702', formula_quantidade:'1', status:'em_validacao' as const },
  { codigo:'GUA256', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' as const },
  { codigo:'GUA157', formula_quantidade:'(Largura+4*Altura)/1000', status:'em_validacao' as const },
  { codigo:'GUA258', formula_quantidade:'3*Largura/1000', status:'em_validacao' as const },
  { codigo:'SIL-PU', formula_quantidade:'2*(Largura+Altura)/12000', status:'em_validacao' as const },
  { codigo:'ALMC25', formula_quantidade:'4', status:'em_validacao' as const },
]

export const FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '4aeb8629-221b-42cd-9379-c0ae1bcaf045',
  configuracao_label: 'MAX1-SUPREMA · 01 módulo · BRA702 · CM200 + arremate · referência histórica',
  variaveis: [],
  pecas: max1PecasBase({arremate:true,cm200:true}),
  vidro: { quantidade:1, formula_largura:'Largura-102', formula_altura:'Altura-102' },
  acessorios: [
    ...max1AcessoriosComuns,
    { codigo:'NYL-10002', formula_quantidade:'4', status:'em_validacao' },
    { codigo:'CHU838', quantidade_referencia:8, status:'referencia' },
    { codigo:'NYL190', quantidade_referencia:8, status:'referencia' },
    { codigo:'PAR1025', quantidade_referencia:8, status:'referencia' },
  ],
}

export const FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '4aeb8629-221b-42cd-9379-c0ae1bcaf045',
  configuracao_label: 'MAX1-SUPREMA · 01 módulo · BRA702 · sem arremate/contramarco · referência histórica',
  variaveis: [],
  pecas: max1PecasBase({arremate:false,cm200:false}),
  vidro: { quantidade:1, formula_largura:'Largura-102', formula_altura:'Altura-102' },
  acessorios: [
    ...max1AcessoriosComuns,
    { codigo:'PAR1037', quantidade_referencia:8, status:'referencia' },
    { codigo:'BUC755', quantidade_referencia:8, status:'referencia' },
  ],
}

function max1VarianteItem(params:{
  largura:number;altura:number;quantidade?:number;cm200?:boolean;arremate?:boolean;
  fixadores:number;
}): WVetroItemTecnico {
  const l=params.largura,h=params.altura,q=params.quantidade||1
  const cm=Boolean(params.cm200)
  const arremate=params.arremate !== false
  const perfil: NonNullable<WVetroItemTecnico['Perfil']> = [
    ...(cm ? [
      { Codigo:'CM200',Posicao:'L',Qtde:2*q,Medida:(l-24)/1000 },
      { Codigo:'CM200',Posicao:'H',Qtde:2*q,Medida:(h-24)/1000 },
    ] : []),
    ...(arremate ? [
      { Codigo:'MP347',Posicao:'L',Qtde:2*q,Medida:(l+44)/1000 },
      { Codigo:'MP347',Posicao:'H',Qtde:2*q,Medida:(h+44)/1000 },
    ] : []),
    { Codigo:'SU079',Posicao:'L',Qtde:2*q,Medida:(l-4)/1000 },
    { Codigo:'SU079',Posicao:'H',Qtde:2*q,Medida:(h-4)/1000 },
    { Codigo:'SU276',Posicao:'L',Qtde:1*q,Medida:(l-4)/1000 },
    { Codigo:'SU082',Posicao:'L',Qtde:2*q,Medida:(l-96)/1000 },
    { Codigo:'SU084',Posicao:'L',Qtde:1*q,Medida:(l-34)/1000 },
    { Codigo:'SU081',Posicao:'H',Qtde:2*q,Medida:(h-60)/1000 },
    { Codigo:'SU102',Posicao:'L',Qtde:2*q,Medida:(l-96)/1000 },
    { Codigo:'SU102',Posicao:'H',Qtde:2*q,Medida:(h-120)/1000 },
  ]
  const comuns = [
    { Codigo:'REBACA4X10',Qtde:3*q },
    { Codigo:'GUA239',Qtde:(2*(l+h)/1000)*q },
    { Codigo:'GUA007',Qtde:(l/1000)*q },
    { Codigo:'PAR435',Qtde:4*q },
    { Codigo:'NYL355',Qtde:2*q },
    { Codigo:'FEC009D',Qtde:1*q },
    { Codigo:'BRA702',Qtde:1*q },
    { Codigo:'GUA256',Qtde:(2*(l+h)/1000)*q },
    { Codigo:'GUA157',Qtde:((l+4*h)/1000)*q },
    { Codigo:'GUA258',Qtde:(3*l/1000)*q },
    { Codigo:'SIL-PU',Qtde:(2*(l+h)/12000)*q },
    { Codigo:'ALMC25',Qtde:4*q },
  ]
  const Acessorios: NonNullable<WVetroItemTecnico['Acessorios']> = cm
    ? [
        ...comuns,
        { Codigo:'NYL-10002',Qtde:4*q },
        { Codigo:'CHU838',Qtde:params.fixadores*q },
        { Codigo:'NYL190',Qtde:params.fixadores*q },
        { Codigo:'PAR1025',Qtde:params.fixadores*q },
      ]
    : [
        ...comuns,
        { Codigo:'PAR1037',Qtde:params.fixadores*q },
        { Codigo:'BUC755',Qtde:params.fixadores*q },
      ]
  return {
    Codigo:'*SUCB-MAX-01-EF',Nome:'MAXIM-AR COM 01 MÓDULO | SUPREMA',Linha:'L. SUPREMA',Modelo:'MAXIM-AR',
    Qtde:q,Largura:l,Altura:h,Perfil:perfil,
    Vidros:[{Codigo:'VIDRO',Qtde:q,Largura:l-102,Altura:h-102,Especificacao:'MINI-BOREAL 04MM - COMUM'}],
    Acessorios,
  }
}

export const FIXTURES_MAX1_SUPREMA_CM200_WVETRO: WVetroItemTecnico[] = [
  max1VarianteItem({largura:400,altura:600,cm200:true,fixadores:6}),
  max1VarianteItem({largura:600,altura:600,cm200:true,fixadores:8}),
  max1VarianteItem({largura:600,altura:800,cm200:true,fixadores:8}),
  max1VarianteItem({largura:700,altura:600,cm200:true,fixadores:8}),
  max1VarianteItem({largura:700,altura:700,cm200:true,fixadores:8}),
]

export const FIXTURES_MAX1_SUPREMA_SEM_ARREMATE_WVETRO: WVetroItemTecnico[] = [
  max1VarianteItem({largura:400,altura:600,quantidade:2,arremate:false,fixadores:6}),
  max1VarianteItem({largura:600,altura:600,arremate:false,fixadores:8}),
  max1VarianteItem({largura:600,altura:800,arremate:false,fixadores:8}),
  max1VarianteItem({largura:704,altura:604,arremate:false,fixadores:8}),
  max1VarianteItem({largura:800,altura:600,arremate:false,fixadores:8}),
]

export const FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051',
  configuracao_label: 'PG1-SUPREMA · Vidro · arremate interno · kit unitário · referência histórica dominante',
  variaveis: [],
  pecas: [
    { eixo:'L', codigo:'MP347', formula:'Largura+44', descricao:'Arremate interno horizontal', quantidade:1 },
    { eixo:'H', codigo:'MP347', formula:'Altura+22', descricao:'Arremate interno vertical', quantidade:2 },
    { eixo:'L', codigo:'SU279', formula:'Largura-4', descricao:'Marco horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU279', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'L', codigo:'SU111', formula:'Largura-72', descricao:'Montante folha de giro horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU111', formula:'Altura-49', descricao:'Montante folha de giro vertical', quantidade:2 },
    { eixo:'L', codigo:'SU225', formula:'Largura-172', descricao:'Travessa inferior da folha', quantidade:1 },
    { eixo:'L', codigo:'SU102', formula:'Largura-172', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU102', formula:'Altura-211', descricao:'Baguete vertical', quantidade:2 },
    { eixo:'L', codigo:'25-548 (L-715)', formula:'Largura-53', descricao:'Complemento folha horizontal', quantidade:1 },
    { eixo:'H', codigo:'25-548 (L-715)', formula:'Altura-30', descricao:'Complemento folha vertical', quantidade:1 },
  ],
  vidro: {
    quantidade: 1,
    formula_largura: 'Largura-178',
    formula_altura: 'Altura-193',
  },
  acessorios: [
    { codigo:'ALMC25', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'ALMC2960', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'CON295', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'FRA822', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'MAC927', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'NYL042', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'PAR435', formula_quantidade:'4', status:'em_validacao' },
    { codigo:'FIT206', formula_quantidade:'(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'GUA171', formula_quantidade:'Largura/1000', status:'em_validacao' },
    { codigo:'GUA239', formula_quantidade:'(Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'GUA258', formula_quantidade:'(Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'GUA259', formula_quantidade:'(2*Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'SIL-PU', formula_quantidade:'(Largura+2*Altura)/12000', status:'em_validacao' },
    { codigo:'DOB840', quantidade_referencia:3, status:'referencia' },
    { codigo:'BUC755', quantidade_referencia:12, status:'referencia' },
    { codigo:'NYL190', quantidade_referencia:12, status:'referencia' },
    { codigo:'PAR1025', quantidade_referencia:12, status:'referencia' },
    { codigo:'PAR1037', quantidade_referencia:12, status:'referencia' },
    { codigo:'REBACA4X10', quantidade_referencia:8, status:'referencia' },
  ],
}

function pg1VidroSupremaItem(params:{
  largura:number
  altura:number
  quantidade?:number
  dobradicas:number
  fixadores:number
  rebites:number
}): WVetroItemTecnico {
  const l=params.largura,h=params.altura,q=params.quantidade||1
  const mult=(v:number)=>v*q
  return {
    Codigo:'*SUCB-PG-02-EF',
    Nome:'PORTA DE GIRO 01 FOLHA | SUPREMA',
    Linha:'L. SUPREMA',
    Modelo:'PORTA DE GIRO 01 FOLHA',
    Qtde:q,
    Largura:l,
    Altura:h,
    Perfil:[
      {Codigo:'MP347',Posicao:'L',Qtde:mult(1),Medida:(l+44)/1000},
      {Codigo:'MP347',Posicao:'H',Qtde:mult(2),Medida:(h+22)/1000},
      {Codigo:'SU279',Posicao:'L',Qtde:mult(1),Medida:(l-4)/1000},
      {Codigo:'SU279',Posicao:'H',Qtde:mult(2),Medida:(h-4)/1000},
      {Codigo:'SU111',Posicao:'L',Qtde:mult(1),Medida:(l-72)/1000},
      {Codigo:'SU111',Posicao:'H',Qtde:mult(2),Medida:(h-49)/1000},
      {Codigo:'SU225',Posicao:'L',Qtde:mult(1),Medida:(l-172)/1000},
      {Codigo:'SU102',Posicao:'L',Qtde:mult(2),Medida:(l-172)/1000},
      {Codigo:'SU102',Posicao:'H',Qtde:mult(2),Medida:(h-211)/1000},
      {Codigo:'25-548 (L-715)',Posicao:'L',Qtde:mult(1),Medida:(l-53)/1000},
      {Codigo:'25-548 (L-715)',Posicao:'H',Qtde:mult(1),Medida:(h-30)/1000},
    ],
    Vidros:[{
      Codigo:'VIDRO',Qtde:mult(1),Largura:l-178,Altura:h-193,
      Especificacao:'INCOLOR 06MM - TEMPERADO',
    }],
    Acessorios:[
      {Codigo:'ALMC25',Qtde:mult(2)},
      {Codigo:'ALMC2960',Qtde:mult(2)},
      {Codigo:'CON295',Qtde:mult(1)},
      {Codigo:'FRA822',Qtde:mult(1)},
      {Codigo:'MAC927',Qtde:mult(1)},
      {Codigo:'NYL042',Qtde:mult(2)},
      {Codigo:'PAR435',Qtde:mult(4)},
      {Codigo:'FIT206',Qtde:mult((l+h)/1000)},
      {Codigo:'GUA171',Qtde:mult(l/1000)},
      {Codigo:'GUA239',Qtde:mult((l+2*h)/1000)},
      {Codigo:'GUA258',Qtde:mult((l+2*h)/1000)},
      {Codigo:'GUA259',Qtde:mult((2*l+2*h)/1000)},
      {Codigo:'SIL-PU',Qtde:mult((l+2*h)/12000)},
      {Codigo:'DOB840',Qtde:mult(params.dobradicas)},
      {Codigo:'BUC755',Qtde:mult(params.fixadores)},
      {Codigo:'NYL190',Qtde:mult(params.fixadores)},
      {Codigo:'PAR1025',Qtde:mult(params.fixadores)},
      {Codigo:'PAR1037',Qtde:mult(params.fixadores)},
      {Codigo:'REBACA4X10',Qtde:mult(params.rebites)},
    ],
  }
}

export const FIXTURES_PG1_VIDRO_SUPREMA_WVETRO: WVetroItemTecnico[] = [
  pg1VidroSupremaItem({largura:800,altura:2100,dobradicas:3,fixadores:12,rebites:8}),
  pg1VidroSupremaItem({largura:800,altura:2200,quantidade:2,dobradicas:3,fixadores:12,rebites:8}),
  pg1VidroSupremaItem({largura:850,altura:2329,dobradicas:4,fixadores:12,rebites:8}),
  pg1VidroSupremaItem({largura:1018,altura:2144,dobradicas:3,fixadores:13,rebites:8}),
  pg1VidroSupremaItem({largura:1160,altura:2150,dobradicas:3,fixadores:13,rebites:9}),
]

export const FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051',
  configuracao_label: 'PG1-SUPREMA · Vidro · sem arremate/contramarco · kit unitário · referência histórica',
  variaveis: [],
  pecas: [
    { eixo:'L', codigo:'SU279', formula:'Largura-4', descricao:'Marco horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU279', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'L', codigo:'SU111', formula:'Largura-72', descricao:'Montante folha de giro horizontal', quantidade:1 },
    { eixo:'H', codigo:'SU111', formula:'Altura-49', descricao:'Montante folha de giro vertical', quantidade:2 },
    { eixo:'L', codigo:'SU225', formula:'Largura-172', descricao:'Travessa inferior da folha', quantidade:1 },
    { eixo:'L', codigo:'SU102', formula:'Largura-172', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU102', formula:'Altura-211', descricao:'Baguete vertical', quantidade:2 },
    { eixo:'L', codigo:'25-548 (L-715)', formula:'Largura-53', descricao:'Complemento folha horizontal', quantidade:1 },
    { eixo:'H', codigo:'25-548 (L-715)', formula:'Altura-30', descricao:'Complemento folha vertical', quantidade:1 },
  ],
  vidro: {
    quantidade: 1,
    formula_largura: 'Largura-178',
    formula_altura: 'Altura-193',
  },
  acessorios: [
    { codigo:'ALMC25', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'ALMC2960', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'CON295', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'DOB840', formula_quantidade:'3', status:'em_validacao' },
    { codigo:'FRA822', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'MAC927', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'NYL042', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'PAR435', formula_quantidade:'4', status:'em_validacao' },
    { codigo:'FIT206', formula_quantidade:'(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'GUA171', formula_quantidade:'Largura/1000', status:'em_validacao' },
    { codigo:'GUA239', formula_quantidade:'(Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'GUA258', formula_quantidade:'(Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'GUA259', formula_quantidade:'(2*Largura+2*Altura)/1000', status:'em_validacao' },
    { codigo:'SIL-PU', formula_quantidade:'(Largura+2*Altura)/12000', status:'em_validacao' },
    { codigo:'BUC755', quantidade_referencia:12, status:'referencia' },
    { codigo:'PAR1037', quantidade_referencia:12, status:'referencia' },
    { codigo:'REBACA4X10', quantidade_referencia:8, status:'referencia' },
  ],
}

function pg1VidroSemArremateItem(params:{
  largura:number;altura:number;fixadores:number;rebites:number;
}): WVetroItemTecnico {
  const l=params.largura,h=params.altura
  return {
    Codigo:'*SUCB-PG-02-EF',
    Nome:'PORTA DE GIRO 01 FOLHA | SUPREMA',
    Linha:'L. SUPREMA',
    Modelo:'PORTA DE GIRO 01 FOLHA',
    Qtde:1,
    Largura:l,
    Altura:h,
    Perfil:[
      {Codigo:'SU279',Posicao:'L',Qtde:1,Medida:(l-4)/1000},
      {Codigo:'SU279',Posicao:'H',Qtde:2,Medida:(h-4)/1000},
      {Codigo:'SU111',Posicao:'L',Qtde:1,Medida:(l-72)/1000},
      {Codigo:'SU111',Posicao:'H',Qtde:2,Medida:(h-49)/1000},
      {Codigo:'SU225',Posicao:'L',Qtde:1,Medida:(l-172)/1000},
      {Codigo:'SU102',Posicao:'L',Qtde:2,Medida:(l-172)/1000},
      {Codigo:'SU102',Posicao:'H',Qtde:2,Medida:(h-211)/1000},
      {Codigo:'25-548 (L-715)',Posicao:'L',Qtde:1,Medida:(l-53)/1000},
      {Codigo:'25-548 (L-715)',Posicao:'H',Qtde:1,Medida:(h-30)/1000},
    ],
    Vidros:[{Codigo:'VIDRO',Qtde:1,Largura:l-178,Altura:h-193,Especificacao:'INCOLOR 06MM - TEMPERADO'}],
    Acessorios:[
      {Codigo:'ALMC25',Qtde:2},
      {Codigo:'ALMC2960',Qtde:2},
      {Codigo:'CON295',Qtde:1},
      {Codigo:'DOB840',Qtde:3},
      {Codigo:'FRA822',Qtde:1},
      {Codigo:'MAC927',Qtde:1},
      {Codigo:'NYL042',Qtde:2},
      {Codigo:'PAR435',Qtde:4},
      {Codigo:'FIT206',Qtde:(l+h)/1000},
      {Codigo:'GUA171',Qtde:l/1000},
      {Codigo:'GUA239',Qtde:(l+2*h)/1000},
      {Codigo:'GUA258',Qtde:(l+2*h)/1000},
      {Codigo:'GUA259',Qtde:(2*l+2*h)/1000},
      {Codigo:'SIL-PU',Qtde:(l+2*h)/12000},
      {Codigo:'BUC755',Qtde:params.fixadores},
      {Codigo:'PAR1037',Qtde:params.fixadores},
      {Codigo:'REBACA4X10',Qtde:params.rebites},
    ],
  }
}

export const FIXTURES_PG1_VIDRO_SUPREMA_SEM_ARREMATE_WVETRO: WVetroItemTecnico[] = [
  pg1VidroSemArremateItem({largura:700,altura:1900,fixadores:10,rebites:6}),
  pg1VidroSemArremateItem({largura:850,altura:2067,fixadores:12,rebites:8}),
  pg1VidroSemArremateItem({largura:894,altura:2119,fixadores:12,rebites:8}),
  pg1VidroSemArremateItem({largura:900,altura:2180,fixadores:12,rebites:8}),
  pg1VidroSemArremateItem({largura:948,altura:2081,fixadores:12,rebites:8}),
]

export const FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA: FormulaAtlasComparacao = {
  tipologia_id: '2a3384fd-a47f-4ea6-846a-610da8c9dab2',
  configuracao_label: 'BAS3-SUPREMA · Basculante · composição dominante · referência histórica',
  variaveis: [],
  pecas: [
    { codigo:'CL006', formula:'22', descricao:'Calço auxiliar CL006', quantidade:8 },
    { codigo:'CL011', formula:'22', descricao:'Calço auxiliar CL011', quantidade:16 },
    { codigo:'BC-009', formula:'16', descricao:'Componente auxiliar BC-009', quantidade:2 },
    { eixo:'L', codigo:'MP347', formula:'Largura+44', descricao:'Arremate interno horizontal', quantidade:2 },
    { eixo:'H', codigo:'MP347', formula:'Altura+44', descricao:'Arremate interno vertical', quantidade:2 },
    { eixo:'L', codigo:'SU093', formula:'Largura-4', descricao:'Marco horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU093', formula:'Altura-4', descricao:'Marco vertical', quantidade:2 },
    { eixo:'H', codigo:'SU096', formula:'Altura-72.8', descricao:'Montante basculante', quantidade:2 },
    { eixo:'L', codigo:'SU097', formula:'Largura-51', descricao:'Travessa superior', quantidade:1 },
    { eixo:'L', codigo:'SU098', formula:'Largura-51', descricao:'Travessa inferior', quantidade:1 },
    { eixo:'L', codigo:'SU100', formula:'Largura-51', descricao:'Travessa interna horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU100', formula:'Altura/2-35.5', descricao:'Travessa interna vertical', quantidade:8 },
    { eixo:'L', codigo:'SU102', formula:'Largura-104', descricao:'Baguete horizontal', quantidade:2 },
    { eixo:'H', codigo:'SU102', formula:'Altura-125.8', descricao:'Baguete vertical', quantidade:2 },
    { eixo:'H', codigo:'AF-018', formula:'Altura-125.8', descricao:'Perfil auxiliar AF-018', quantidade:2 },
  ],
  vidro: {
    quantidade: 1,
    formula_largura: 'Largura-110',
    formula_altura: 'Altura-108',
  },
  acessorios: [
    { codigo:'ALA-059', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'ARR-10001', formula_quantidade:'6', status:'em_validacao' },
    { codigo:'CON456', formula_quantidade:'1', status:'em_validacao' },
    { codigo:'PIV753', formula_quantidade:'2', status:'em_validacao' },
    { codigo:'GUA171', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'GUA259', formula_quantidade:'2*(Largura+Altura)/1000', status:'em_validacao' },
    { codigo:'SIL-PU', formula_quantidade:'2*(Largura+Altura)/12000', status:'em_validacao' },
    { codigo:'BUC753', quantidade_referencia:10, status:'referencia' },
    { codigo:'NYL190', quantidade_referencia:10, status:'referencia' },
    { codigo:'PARFIAPF04850N', quantidade_referencia:10, status:'referencia' },
    { codigo:'PARFIAPP04216N', quantidade_referencia:10, status:'referencia' },
    { codigo:'REBACA4X10', quantidade_referencia:18, status:'referencia' },
    { codigo:'REBCCC-5/32X1/2', quantidade_referencia:2, status:'referencia' },
  ],
}

function bas3SupremaItem(params:{
  largura:number
  altura:number
  fixadores:number
  rebaca:number
  rebccc:number
}): WVetroItemTecnico {
  const l=params.largura,h=params.altura
  return {
    Codigo:'*SUCB-BAS-03EF',
    Nome:'BASCULANTE | SUPREMA',
    Linha:'L. SUPREMA',
    Modelo:'BASCULANTE',
    Qtde:1,
    Largura:l,
    Altura:h,
    Perfil:[
      {Codigo:'CL006',Qtde:8,Medida:0.022},
      {Codigo:'CL011',Qtde:16,Medida:0.022},
      {Codigo:'BC-009',Qtde:2,Medida:0.016},
      {Codigo:'MP347',Posicao:'L',Qtde:2,Medida:(l+44)/1000},
      {Codigo:'MP347',Posicao:'H',Qtde:2,Medida:(h+44)/1000},
      {Codigo:'SU093',Posicao:'L',Qtde:2,Medida:(l-4)/1000},
      {Codigo:'SU093',Posicao:'H',Qtde:2,Medida:(h-4)/1000},
      {Codigo:'SU096',Posicao:'H',Qtde:2,Medida:(h-72.8)/1000},
      {Codigo:'SU097',Posicao:'L',Qtde:1,Medida:(l-51)/1000},
      {Codigo:'SU098',Posicao:'L',Qtde:1,Medida:(l-51)/1000},
      {Codigo:'SU100',Posicao:'L',Qtde:2,Medida:(l-51)/1000},
      {Codigo:'SU100',Posicao:'H',Qtde:8,Medida:(h/2-35.5)/1000},
      {Codigo:'SU102',Posicao:'L',Qtde:2,Medida:(l-104)/1000},
      {Codigo:'SU102',Posicao:'H',Qtde:2,Medida:(h-125.8)/1000},
      {Codigo:'AF-018',Posicao:'H',Qtde:2,Medida:(h-125.8)/1000},
    ],
    Vidros:[{
      Codigo:'VIDRO',Qtde:1,Largura:l-110,Altura:h-108,
      Especificacao:'INCOLOR 06MM - TEMPERADO',
    }],
    Acessorios:[
      {Codigo:'ALA-059',Qtde:1},
      {Codigo:'ARR-10001',Qtde:6},
      {Codigo:'CON456',Qtde:1},
      {Codigo:'PIV753',Qtde:2},
      {Codigo:'GUA171',Qtde:2*(l+h)/1000},
      {Codigo:'GUA259',Qtde:2*(l+h)/1000},
      {Codigo:'SIL-PU',Qtde:2*(l+h)/12000},
      {Codigo:'BUC753',Qtde:params.fixadores},
      {Codigo:'NYL190',Qtde:params.fixadores},
      {Codigo:'PARFIAPF04850N',Qtde:params.fixadores},
      {Codigo:'PARFIAPP04216N',Qtde:params.fixadores},
      {Codigo:'REBACA4X10',Qtde:params.rebaca},
      {Codigo:'REBCCC-5/32X1/2',Qtde:params.rebccc},
    ],
  }
}

export const FIXTURES_BAS3_SUPREMA_WVETRO: WVetroItemTecnico[] = [
  bas3SupremaItem({largura:400,altura:400,fixadores:8,rebaca:16,rebccc:2}),
  bas3SupremaItem({largura:600,altura:700,fixadores:10,rebaca:18,rebccc:2}),
  bas3SupremaItem({largura:800,altura:400,fixadores:10,rebaca:20,rebccc:2}),
  bas3SupremaItem({largura:950,altura:500,fixadores:10,rebaca:22,rebccc:2}),
  bas3SupremaItem({largura:1019,altura:836,fixadores:14,rebaca:22,rebccc:2}),
]

