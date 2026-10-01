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
