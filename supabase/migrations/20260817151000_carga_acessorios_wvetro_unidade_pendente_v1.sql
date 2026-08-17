-- Carga reconciliada de acessórios W.Vetro com unidade operacional ainda não validada.
-- Fonte: Reconciliacao_ExportWWAcessorios_Atlas.xlsx, aba Reconciliacao.
-- Pré-requisitos:
--   1) 20260816210000_produtos_identidade_tecnica_v1.sql aplicada;
--   2) 20260817141000_carga_acessorios_wvetro_un_v1.sql aplicada antes desta;
--   3) 20260817150000_produtos_unidade_operacional_pendente_v1.sql aplicada.
--
-- Escopo:
--   - 136 acessórios faltantes cuja unidade de origem NÃO é UN;
--   - produtos.unidade fica NULL de propósito: significa unidade operacional pendente;
--   - produtos.unidade_origem preserva exatamente a unidade W.Vetro.
--
-- Nenhum fator de conversão é inferido.

begin;

create temporary table _carga_acessorios_wvetro_unidade_pendente (
  codigo_origem_raw text not null,
  descricao_fonte text not null,
  unidade_fonte text not null,
  ncm_fonte text,
  linha_origem text,
  cor_origem text,
  fabricante_origem text,
  flags_revisao text,
  status_fonte text,
  motivos_fonte text,
  qtde_embalagem numeric,
  ativo_fonte text
) on commit drop;

insert into _carga_acessorios_wvetro_unidade_pendente (
  codigo_origem_raw,
  descricao_fonte,
  unidade_fonte,
  ncm_fonte,
  linha_origem,
  cor_origem,
  fabricante_origem,
  flags_revisao,
  status_fonte,
  motivos_fonte,
  qtde_embalagem,
  ativo_fonte
) values
  ('4232', 'PIVOTANTE SERUS 150KG 1" X 100MM KTL PRETO', 'CJ', '83021000', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA, UNIDADE_RARA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('53009', 'SILICONE NEUTRO INCOLOR', 'MT', '35061090', 'MOVELEIRA.', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('BA02', 'BAGUETE BA02', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BA04', 'BAGUETE BA04', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BA07', 'BAGUETE BA07', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BMT-BRF-1202', 'BRAÇO PARA MAXIM-AR COM 1200 MM (FACHADA)', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BMT-ESP-1806-PEE', 'Espaçador perimetral', 'MT', '15', 'FACHADA ATLANTA', 'PRETO', 'BELMETAL', 'NCM_FORMATO', 'REVISAR', 'NCM_FORMATO', 0, 'Sim'),
  ('BMT-GUA-2202', 'Gaxeta da coluna e travessa', 'MT', '15', 'FACHADA ATLANTA', 'PRETO', 'BELMETAL', 'NCM_FORMATO', 'REVISAR', 'NCM_FORMATO, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('BMT-GUA-2250', 'Gaxeta externa flap', 'MT', '15', 'FACHADA ATLANTA', 'PRETO', 'BELMETAL', 'NCM_FORMATO', 'REVISAR', 'NCM_FORMATO, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('BMT-SIL-6481', 'SELANTE DE SILICONE ESTRUTURAL (CONFORME NORMA ASTM C1184)', 'TB', '35061090', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA-H', 'BRAÇO MAXIM-AR', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA588', 'BRAÇO MAXIM-AR C/ 350MM', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA589', 'BRAÇO MAXIM-AR C/ 600MM', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA590', 'BRAÇO MAXIM-AR C/ 950MM', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA591', 'BRAÇO MAXIM-AR C/ 1200MM', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA706', 'BRAÇO MAXIM-AR 200 MM', 'PR', '0', 'DESENVOLVIMENTO', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, COR_NUMERICA', 1, 'Sim'),
  ('BRA766', 'BRAÇO 342MM | MAXIM-AR', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRA767', 'BRAÇO 600MM | MAXIM-AR', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('BRAUDMAXMAS15350PTF', 'BRAÇO UDMAX PROJETANTE 350 MM MASSIMA - CX15 MM - PRETO', 'PR', '0', 'DESENVOLVIMENTO', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, COR_NUMERICA', 1, 'Sim'),
  ('BRAUDMAXMAS15600PTF', 'BRAÇO UDMAX PROJETANTE 600 MM MASSIMA - CX15 MM - PRETO', 'PR', '0', 'DESENVOLVIMENTO', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, COR_NUMERICA', 1, 'Sim'),
  ('CANT_TELAMOSQ', 'CONEXÃO NYLON  TELA MOSQUITEIRA', 'M2', '70195900', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA, UNIDADE_RARA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA, UNIDADE_RARA', 0, 'Sim'),
  ('CHRC-009', 'DOBRADIÇA PIVOTANTE CARGA ATÉ 300 KG ', 'BR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('COMBUSTIVEL', 'COMBUSTIVEL UTILIZADO PARA INSTALAR', 'BR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('CON003/COMPEX', 'CONEXÃO 21,5MM (CL006+CL011)', 'PC', '76101000', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('DUPLA FACE 3MM', 'DUPLA FACE 3MM', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('ESC-7X5', 'ESCOVA DE VEDAÇÃO 7X5', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('ESP-1104', 'CALÇO DE APOIO DO VIDRO 11 X 4 X 20 MM', 'MT', '76042920', 'SEM LINHA', '15', 'LINHA EXCLUSIVA', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('FIT-224', 'ESCOVA DE VEDAÇÃO SEM BARREIRA PLÁSTICA - 7 X 8 MM', 'MT', '76101000', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 1, 'Sim'),
  ('FIT148', 'CINTA DE FIXAÇÃO DA PERSIANA', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FIT201', 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5 X 5 MM', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FIT210-CZA', 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5 X 7 MM - CINZA', 'MT', '12345678', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('FIT220', 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 7 X 6 MM', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FIT220-CZA', 'FITA DE VEDAÇÃO 7X6 CINZA', 'MT', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('FIT220-PTO', 'FITA DE VEDAÇÃO 7X6 PRETO', 'MT', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('FIT224', 'FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 7 X 8 MM', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FIT245', 'FITA VEDADORA SEM BARREIRA PLÁSTICA 22 X 5,5 MM', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FIT246-CZA', 'FITA VEDADORA SEM BARREIRA PLÁSTICA 7,6 X 6 MM - CINZA', 'MT', '12345678', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('FIT316', 'FITA DE VEDAÇÃO 7,5X14MM', 'MT', '76101000', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FITA ADESIVA', 'FITA ADESIVA', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('FLAN-1.1/2"', 'FLANGE INOX 304 DE 1.1/2"', 'BR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GAX-038N', 'GUARNIÇÃO CUNHA', 'MT', '39252000', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('GAX-172', 'GUARNIÇÃO ADES. ESPONJOSA 11MM X 1,8MM', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-034', 'BORRACHA | BORRACHA | GUARNIÇÃO/BORRACHA DE EPDM ( VIDRO DE 5 A 6 mm )', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-039', 'GUARNIÇAO CUNHA 7,5 X 3,5 X 11,3 MM - EPDM PRETO', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-051', 'GUARNIÇÃO CUNHA 13 X 8 X 3,5 MM - EPDM PRETO', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-132', 'GUARNIÇÃO DE ACABAMENTO (RECOBRIMENTO) - PVC PRETO', 'MT', '76042920', 'HYDRO | UNIVERSAL VARANDA', 'PRETO', 'NORSK HYDRO', NULL, 'OK', NULL, 0, 'Sim'),
  ('GUA-161', 'GUARNIÇÃO 4,8 X 12,7 X 8 - EPDM PRETO', 'MT', '39259090', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 50, 'Sim'),
  ('GUA-180', 'GUARNIÇÃO ADESIVA 8 X 12 MM | CÉLULAS FECHADAS - PRETO', 'MT', '76042920', 'HYDRO | UNIVERSAL VARANDA', 'PRETO', 'NORSK HYDRO', NULL, 'OK', NULL, 0, 'Sim'),
  ('GUA-212', 'GUARNIÇAO CUNHA 10,5 X 4,5 X 12,5 MM EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA-246', 'GUARNIÇÃO COLUNA - EPDM PRETO', 'MT', '76042920', 'HYDRO | UNIVERSAL VARANDA', 'PRETO', 'NORSK HYDRO', NULL, 'OK', NULL, 0, 'Sim'),
  ('GUA-305', 'GUARNIÇÃO ESPUMA ADESIVA 14 X 3,2 MM - PRETO', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-359', 'GUARNIÇÃO ADESIVA 19 X 20 MM | CÉLULAS FECHADAS - PVC PRETO', 'MT', '76042920', 'HYDRO | UNIVERSAL VARANDA', 'PRETO', 'NORSK HYDRO', NULL, 'OK', NULL, 0, 'Sim'),
  ('GUA-AL01', 'GUARNIÇÃO P/ ESQUADRIA - GUA AL01 - (VIDRO 08MM NO CAVALÃO)', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA-PRM-0107', 'GUARNIÇÃO DO VIDRO', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('GUA006', 'GUARNIÇÃO DO ENGATE Ø 5 MM - EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA030', 'GUARNIÇÃO PARA COLUNA E POLICABONATO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA033', 'GUARNIÇÃO EM EPDM PARA VIDRO DE 7 A 8 MM | GUARDA-CORPO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA034', 'GUARNIÇÃO EM EPDM PARA VIDRO DE 5 A 6 MM | GUARDA-CORPO	', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA101', 'GUARNIÇÃO CUNHA', 'MT', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('GUA160', 'GUARNIÇÃO DA COLUNA', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA185', 'GUARNIÇÃO ESPUMA ADESIVA - PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA283', 'GUARNIÇÃO PARA VIDRO DE 5 E 6 MM- EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA284', 'GUARNIÇÃO PARA VIDRO DE 3 E 4 MM - EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA290', 'GUARNIÇÃO TRAVA DA TAMPA INTERNA INTEGRADA - EPDM PRETO	', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA303', 'GUARNIÇÃO PARA VIDRO DUPLO 17MM - EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA406', 'GUARNIÇÃO ESPUMA ADESIVA 14 X 14 MM - PVC PRETO', 'MT', '76042920', 'HYDRO | UNIVERSAL VARANDA', 'PRETO', 'NORSK HYDRO', NULL, 'OK', NULL, 0, 'Sim'),
  ('GUA438', 'GUARNIÇÃO EM EPDM', 'MT', '12345678', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('GUA516', 'GUARNIÇÃO ENGATE MÃO DE AMIGO', 'MT', '12345678', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('GUA520', 'GUARNIÇÃO EPDM MATA JUNTA', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('GUA555', 'GUARNIÇÃO P/ ESQUADRIA / VIDRO 06MM NO CAVALÃO / VIDRO 08MM COM PERFIL "J"', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('GUA778', 'GUARNIÇÃO EM EPDM / INTERNA E EXTERNO', 'MT', '12345678', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('HAS-862', 'HASTE AL TREFILADO P/ CREMONA', 'MT', '12345678', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('KIT-26', 'KIT-26 JANELA MÃO AMIGA 2FLS C/ BATE-FECHA E 1122', 'BR', '87083090', 'VIDRO TEMPERADO VT', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('KIT-27', 'KIT-27 JANELA MÃO AMIGA 3FLS C/ BATE-FECHA E 1122', 'BR', '87083090', 'VIDRO TEMPERADO VT', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('KIT-32', 'KIT-32 JANELA MÃO AMIGA 4FLS C/ BATE-FECHA E 1122', 'BR', '87083090', 'VIDRO TEMPERADO VT', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('KIT-33', 'KIT-33 PORTA MÃO AMIGA 2FLS', 'BR', '87083090', 'VIDRO TEMPERADO VT', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('KIT-34', 'KIT-34 JANELA MÃO AMIGA 2FLS C/ BATE-FECHA E 1122M', 'BR', '87083090', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('LAPIDACAO', 'LAPIDAÇÃO DE VIDROS', 'BR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('LED', 'FITA DE LED', 'MT', '76101000', 'MOVELEIRA', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('MÃO DE OBRA', 'MÃO DE OBRA ', 'BR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MAO-ACAB', 'Mão de obra de acabamento', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MAO-ACAB-01', 'MÃO DE OBRA ACABAMENTO MAIS INCONTA', 'BR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MAO-POL-INC', 'MAO DE OBRA POLIMENTO ACESSORIOS', 'BR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MAO-POLIM', 'Mão de obra de polimento', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MOBRALAPI0812', 'Mão de obra de lapidação de vidro 08 a 12mm', 'BR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('MOBRALAPI1219', 'Mão de obra de lapidação de vidro 15 a 19mm', 'BR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PAR-4232-PH', ' PARAFUSO CAB. PANELA 4,2X32MM PHILIPS A.A.', 'CT', '76101000', 'PERFIL ALUMINIO | FACHADA ECOGRID', '15', 'PERFIL ALUMINIO', 'COR_NUMERICA, UNIDADE_RARA', 'ATENCAO', 'COR_NUMERICA, UNIDADE_RARA', 0, 'Sim'),
  ('PE LISA', 'PONTEIRA LISA', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE VAZADA', 'PONTEIRA VAZADA', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE01 CROMO ACETINADO', 'PE01 LISA CROMO ACETINADO', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE01 CROMO BRILHO', 'PE01 LISA CROMO BRILHO', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE01 LISA FOSCO', 'PONTEIRA 01 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE01 LISA INOX ESCOV', 'PONTEIRA 01 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'INOX ESCOVADO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE01 LISA PRETA', 'PONTEIRA 01 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE05 FOSCO', 'PONTEIRA 05 FOSCO P/ 3136P', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE05 INOX ESCOVADO', 'PONTEIRA 05 INOX ESCOVADO P/ 3136P', 'PR', '0', 'GERAL', 'INOX ESCOVADO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE07 CROMO ACETINADO', 'PE07 VAZADA CROMO ACETINADO', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE07 CROMO BRILHO', 'PE07 VAZADA CROMO BRILHO', 'PR', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PE07 VAZADA FOSCO', 'PONTEIRA 07 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE07 VAZADA INOX ESC', 'PONTEIRA 07 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'INOX ESCOVADO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE07 VAZADA PRETA', 'PONTEIRA 07 P/ 3180T/3178T', 'PR', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PE119 FOSCO', 'PONTEIRA P/ RM172', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE12 CROMO', 'PONTEIRA 12 CROMO P/ AREZZO', 'PR', '0', 'GERAL', 'CROMO BRILHO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE12 FOSCO', 'PONTEIRA 12 FOSCO P/ AREZZO', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE12 INOX ESCOVADO', 'PONTEIRA 12 INOX P/ AREZZO', 'PR', '0', 'GERAL', 'INOX ESCOVADO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE12 PRETA', 'PONTEIRA 12 PRETA P/ AREZZO', 'PR', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE19 CROMO', 'PONTEIRA 19 CROMO P/ STRETTO', 'PR', '0', 'GERAL', 'CROMO BRILHO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE19 FOSCO', 'PONTEIRA 19 FOSCO P/ STRETTO', 'PR', '0', 'GERAL', 'FOSCO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE19 INOX ESCOVADO', 'PONTEIRA 19 INOX ESCOVADO P/ STRETTO', 'PR', '0', 'GERAL', 'INOX ESCOVADO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PE19 PRETA', 'PONTEIRA 19 STRETTO PRETA', 'PR', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PER-0140', 'COMPASSO REQUADRO PERSIANA', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PER-0170', 'DOBRADIÇA INOX REQUADRO PERSIANA', 'PC', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PER-0200', 'MANCAL ALUMÍNIO REQUADRO PERSIANA', 'PC', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PER-998', 'CANTONEIRA PARA REQUADRO PERSIANA', 'PC', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PERFIL PU', 'PERFIL PU POLIETILENO', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PERSILOX', 'PERSILOX TRANSPARENTE', 'TB', '0', 'GERAL', 'NATURAL', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('PITAOZINHO-001', 'PITAOZINHO PARA SHAMPOOZEIRA', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PLÁSTICO BOLHA', 'PLÁSTICO BOLHA', 'M2', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA, UNIDADE_RARA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA, UNIDADE_RARA', 0, 'Sim'),
  ('PSC-001', 'GAXETA DA COLUNA E TRAVESSA', 'MT', '76042920', 'ECOSTICK.', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PSC-002', 'GAXETA EXTERNA FLAP', 'MT', '76042920', 'ECOSTICK.', '15', '15', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('PUX-200', 'PUXADOR ALUMÍNIO REQUADRO PERSIANA', 'PC', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('PVC10X2PTO', 'ESPUMA ADESIVA PVC 10 X 2MM PRETO', 'MT', '0', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_ZERO, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('QLP-6965', 'ESPUMA Q-LON IMPERMEÁVEL 6,8 X 6,3 MM  ( REF. SCHLEGEL: QL 69650 )', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('REC8118/40-EB-CZ', 'RECOLHEDOR 8118/40 MOLDURA BRANCA - FITA CINZA', 'CJ', '76042920', 'GERAL', 'BRANCO', 'LINHA EXCLUSIVA', 'LINHA_GERAL, UNIDADE_RARA', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('REC8118/40-EP-CP', 'RECOLHEDOR 8118/40 MOLDURA PRETA - FITA PRETA', 'CJ', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL, UNIDADE_RARA', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('RECADP60PRT', 'ADAPTADOR EIXO OCTOGONAL 60 MM', 'CJ', '12345678', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL, UNIDADE_RARA', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL', 0, 'Sim'),
  ('SE138', 'GUARNIÇÃO DE GRADIL PARA VIDRO DE 10MM', 'MT', '0', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'NCM_ZERO, LINHA_GERAL', 'REVISAR', 'NCM_ZERO, LINHA_GERAL', 0, 'Sim'),
  ('SEMACES', 'SEM ACESSÓRIOS', 'BR', '12345678', 'GERAL', '15', 'LINHA EXCLUSIVA', 'NCM_PLACEHOLDER, LINHA_GERAL, COR_NUMERICA', 'REVISAR', 'NCM_PLACEHOLDER, LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('SKG-001', 'GUARNIÇÃO COLUNA', 'MT', '76101000', 'PERFIL ALUMINIO | FACHADA ECOGRID', '15', 'PERFIL ALUMINIO', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('SKG-002', 'GUARNIÇÃO TRAVESSA', 'RO', '76101000', 'PERFIL ALUMINIO | FACHADA ECOGRID', '15', 'PERFIL ALUMINIO', 'COR_NUMERICA, UNIDADE_RARA', 'ATENCAO', 'COR_NUMERICA, UNIDADE_RARA', 0, 'Sim'),
  ('SKG-003', 'GUARNIÇÃO CONTRA TAMPA', 'MT', '76101000', 'PERFIL ALUMINIO | FACHADA ECOGRID', '15', 'PERFIL ALUMINIO', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA', 0, 'Sim'),
  ('SKG-005', 'GUARNIÇÃO COLUNA', 'MT', '76101000', 'PERFIL ALUMINIO | FACHADA ECOGRID', '15', 'PERFIL ALUMINIO', 'COR_NUMERICA', 'ATENCAO', 'COR_NUMERICA, DESCRICAO_REPETIDA', 0, 'Sim'),
  ('SPHG-013', 'GUARNIÇÃO INTERNA CUNHA 11 X 4,6 MM - EPDM PRETO', 'MT', '76042920', 'GERAL', 'PRETO', 'LINHA EXCLUSIVA', 'LINHA_GERAL', 'ATENCAO', 'LINHA_GERAL', 0, 'Sim'),
  ('TAM011', 'TAMPA PARA CORRIMÃO CG072 / D143', 'BR', '76101000', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('TF', 'TRILHO DE FERRO PARA PORTÃO DE CORRER', 'MT', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim'),
  ('TPA-250', 'TAMPA LATERAL DA CAIXA ( EXL-88515 / EXL-515 )', 'PR', '76042920', 'GERAL', '15', 'LINHA EXCLUSIVA', 'LINHA_GERAL, COR_NUMERICA', 'ATENCAO', 'LINHA_GERAL, COR_NUMERICA', 0, 'Sim');

-- Guardas: se a fonte/escopo ou a base mudaram, abortar em vez de inventar/duplicar.
do $$
declare
  v_total integer;
  v_duplicados integer;
  v_unidades_invalidas integer;
  v_inativos integer;
  v_colisoes integer;
  v_distribuicao_invalida integer;
begin
  select count(*) into v_total
  from _carga_acessorios_wvetro_unidade_pendente;

  if v_total <> 136 then
    raise exception 'Carga W.Vetro unidade pendente esperava 136 linhas; encontrou %', v_total;
  end if;

  select count(*) into v_duplicados
  from (
    select upper(regexp_replace(trim(codigo_origem_raw), '\s+', ' ', 'g')) as codigo_norm
    from _carga_acessorios_wvetro_unidade_pendente
    group by 1
    having count(*) > 1
  ) d;

  if v_duplicados <> 0 then
    raise exception 'Carga W.Vetro unidade pendente contém % código(s) normalizado(s) duplicado(s)', v_duplicados;
  end if;

  select count(*) into v_unidades_invalidas
  from _carga_acessorios_wvetro_unidade_pendente
  where upper(trim(unidade_fonte)) not in ('MT','PR','BR','PC','CJ','TB','M2','CT','RO');

  if v_unidades_invalidas <> 0 then
    raise exception 'Carga W.Vetro unidade pendente contém % linha(s) com unidade fora do conjunto auditado', v_unidades_invalidas;
  end if;

  select count(*) into v_distribuicao_invalida
  from (
    with esperado(unidade, quantidade) as (
      values
    ('MT', 68),
    ('PR', 37),
    ('BR', 16),
    ('PC', 5),
    ('CJ', 4),
    ('TB', 2),
    ('M2', 2),
    ('CT', 1),
    ('RO', 1)
    ),
    atual as (
      select upper(trim(unidade_fonte)) as unidade, count(*)::integer as quantidade
      from _carga_acessorios_wvetro_unidade_pendente
      group by 1
    )
    select coalesce(e.unidade, a.unidade) as unidade
    from esperado e
    full join atual a using (unidade)
    where coalesce(e.quantidade, -1) <> coalesce(a.quantidade, -1)
  ) x;

  if v_distribuicao_invalida <> 0 then
    raise exception 'Distribuição de unidades da carga difere da reconciliação auditada';
  end if;

  select count(*) into v_inativos
  from _carga_acessorios_wvetro_unidade_pendente
  where lower(trim(coalesce(ativo_fonte, ''))) not in ('sim', 'true', '1', 't');

  if v_inativos <> 0 then
    raise exception 'Carga W.Vetro unidade pendente contém % item(ns) não ativos na fonte', v_inativos;
  end if;

  select count(*) into v_colisoes
  from _carga_acessorios_wvetro_unidade_pendente c
  join public.produtos p
    on upper(p.codigo) = upper(regexp_replace(trim(c.codigo_origem_raw), '\s+', ' ', 'g'));

  if v_colisoes <> 0 then
    raise exception 'Base mudou desde a reconciliação: % código(s) desta carga já existem em produtos', v_colisoes;
  end if;
end $$;

insert into public.produtos (
  nome,
  categoria,
  preco,
  unidade,
  descricao,
  ativo,
  marca,
  ncm,
  codigo,
  codigo_origem,
  origem,
  id_externo_wvetro,
  unidade_origem,
  qtde_embalagem_origem,
  dados_origem,
  status_validacao,
  observacao_validacao,
  ncm_origem,
  ncm_status
)
select
  regexp_replace(upper(trim(c.codigo_origem_raw)), '\s+', ' ', 'g')
    || ' - ' || trim(c.descricao_fonte) as nome,
  'acessorio' as categoria,
  0 as preco,
  null::text as unidade,
  trim(c.descricao_fonte) as descricao,
  true as ativo,
  nullif(trim(c.fabricante_origem), '') as marca,
  case
    when trim(coalesce(c.ncm_fonte, '')) ~ '^[0-9]{8}$'
      and trim(c.ncm_fonte) not in ('12345678', '12345667')
    then trim(c.ncm_fonte)
    else null
  end as ncm,
  regexp_replace(upper(trim(c.codigo_origem_raw)), '\s+', ' ', 'g') as codigo,
  c.codigo_origem_raw as codigo_origem,
  'wvetro' as origem,
  null as id_externo_wvetro,
  upper(trim(c.unidade_fonte)) as unidade_origem,
  c.qtde_embalagem as qtde_embalagem_origem,
  jsonb_build_object(
    'fonte', 'ExportWWAcessorios.xlsx',
    'reconciliacao', '2026-08-16/17',
    'codigo_raw', c.codigo_origem_raw,
    'descricao_raw', c.descricao_fonte,
    'unidade_raw', c.unidade_fonte,
    'ncm_raw', c.ncm_fonte,
    'linha_raw', c.linha_origem,
    'cor_raw', c.cor_origem,
    'fabricante_raw', c.fabricante_origem,
    'qtde_emb_raw', c.qtde_embalagem,
    'ativo_raw', c.ativo_fonte,
    'status_fonte', c.status_fonte,
    'motivos_fonte', c.motivos_fonte,
    'flags_revisao', c.flags_revisao
  ) as dados_origem,
  'importado' as status_validacao,
  'Importado da base W.Vetro reconciliada. Unidade operacional Atlas ainda não validada; unidade=NULL. Usar unidade_origem apenas como dado da fonte, sem inferir conversão. Preço/custo não disponíveis: preco=0 é placeholder. Linha e cor não foram vinculadas automaticamente.' as observacao_validacao,
  nullif(trim(c.ncm_fonte), '') as ncm_origem,
  case
    when trim(coalesce(c.ncm_fonte, '')) in ('', '0', '12345678', '12345667')
      or trim(coalesce(c.ncm_fonte, '')) !~ '^[0-9]{8}$'
    then 'invalido'
    else 'pendente'
  end as ncm_status
from _carga_acessorios_wvetro_unidade_pendente c
order by regexp_replace(upper(trim(c.codigo_origem_raw)), '\s+', ' ', 'g');

do $$
declare
  v_inseridos integer;
  v_unidade_preenchida integer;
begin
  select count(*) into v_inseridos
  from public.produtos
  where origem = 'wvetro'
    and categoria = 'acessorio'
    and upper(codigo) in (
      select upper(regexp_replace(trim(codigo_origem_raw), '\s+', ' ', 'g'))
      from _carga_acessorios_wvetro_unidade_pendente
    );

  if v_inseridos <> 136 then
    raise exception 'Pós-carga esperava encontrar 136 acessórios W.Vetro desta migration; encontrou %', v_inseridos;
  end if;

  select count(*) into v_unidade_preenchida
  from public.produtos
  where origem = 'wvetro'
    and categoria = 'acessorio'
    and upper(codigo) in (
      select upper(regexp_replace(trim(codigo_origem_raw), '\s+', ' ', 'g'))
      from _carga_acessorios_wvetro_unidade_pendente
    )
    and unidade is not null;

  if v_unidade_preenchida <> 0 then
    raise exception 'Pós-carga encontrou % item(ns) com unidade operacional preenchida indevidamente', v_unidade_preenchida;
  end if;
end $$;

commit;
