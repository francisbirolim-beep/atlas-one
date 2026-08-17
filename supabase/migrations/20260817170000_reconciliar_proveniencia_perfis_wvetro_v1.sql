-- Reconciliação de proveniência dos 1.307 perfis preexistentes no Atlas
-- confirmados na fonte W.Vetro `ExportWWPerfil (1)(1).xlsx` em 2026-08-17.
--
-- Objetivo:
--   enriquecer somente proveniência dos registros já existentes.
--   NÃO insere produtos e NÃO sobrescreve campos operacionais/técnicos.
--
-- Auditoria read-only:
--   fonte W.Vetro: 1.307 códigos únicos;
--   Atlas: 1.307 perfis;
--   correspondências por código: 1.307;
--   EXISTENTE_IGUAL: 1.235;
--   EXISTENTE_FONTE_NAO_PROMOVIDA: 72;
--   divergência operacional real: 0.
--
-- Os 72 dados não promovidos são deliberados:
--   68 registros com Nome Fabricante = 16 e marca Atlas vazia;
--    4 registros com NCM = 16 e NCM Atlas vazio.
--
-- Estratégia de compactação segura:
--   campos que a auditoria confirmou idênticos entre fonte e Atlas são
--   reconstruídos a partir do snapshot Atlas SOMENTE se o hash integral do
--   snapshot vivo continuar exatamente igual ao hash auditado.
--   Os valores crus que diferem do Atlas/default ficam na tabela de exceções
--   abaixo (249 códigos). Um segundo hash confirma que a fonte reconstruída
--   coincide exatamente com os dados auditados da planilha.
--
-- Fonte recebida SHA-256:
--   d13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07
-- Snapshot Atlas CSV read-only SHA-256:
--   fca1d9672911b3c8770260bbac8b0c24319f1bb52519d528ed68c8d1f1e9b898
-- Hash MD5 canônico do snapshot Atlas auditado:
--   ef179d902fbfc13dfa2f32a9e0ffd322
-- Hash MD5 canônico dos dados da fonte reconstruída:
--   1de834f0f4bc2b791b73479529e3392b
--
-- `Tamanho` da fonte é gravado SOMENTE em tamanho_barra_mm_origem.
-- Não inferir que 6 significa 6000 mm e não corrigir 60000 automaticamente.

begin;

create temporary table _perfil_wvetro_excecoes (
  codigo_norm text primary key,
  codigo_raw_override text,
  descricao_raw_override text,
  tamanho_raw_override numeric,
  sucata_raw_override numeric,
  obs_raw_override text,
  cod_barras_raw_override text,
  fabricante_raw_override text,
  ncm_raw_override text
) on commit drop;

insert into _perfil_wvetro_excecoes (
  codigo_norm,
  codigo_raw_override,
  descricao_raw_override,
  tamanho_raw_override,
  sucata_raw_override,
  obs_raw_override,
  cod_barras_raw_override,
  fabricante_raw_override,
  ncm_raw_override
) values
  ('03.26.558', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('03.26.657', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('03.26.860', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('100X50', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('1036', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('19-920C', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('25517', NULL, 'MARCO LATERAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('29-160', NULL, NULL, 5000, 2000, NULL, NULL, NULL, NULL),
  ('30-245', NULL, NULL, NULL, NULL, NULL, '30-245              ', NULL, NULL),
  ('3185T', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('32-145/CB-273', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('39-811', NULL, NULL, 5000, 2000, NULL, NULL, NULL, NULL),
  ('4039', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('42-002', NULL, NULL, NULL, NULL, NULL, '42-002              ', NULL, NULL),
  ('42-004', NULL, NULL, 60000, NULL, NULL, NULL, NULL, NULL),
  ('42-007', NULL, NULL, NULL, NULL, NULL, '42-007              ', NULL, NULL),
  ('42-008', NULL, NULL, NULL, NULL, NULL, '42-008              ', NULL, NULL),
  ('42-012', NULL, NULL, NULL, NULL, NULL, '42-012              ', NULL, NULL),
  ('42-014', NULL, NULL, NULL, NULL, NULL, '42-014              ', NULL, NULL),
  ('42-023', NULL, NULL, NULL, NULL, NULL, '42-023              ', NULL, NULL),
  ('42-025', NULL, NULL, NULL, NULL, NULL, '42-025              ', NULL, NULL),
  ('42-026', NULL, NULL, NULL, NULL, NULL, '42-026              ', NULL, NULL),
  ('42-028', NULL, NULL, NULL, NULL, NULL, '42-028              ', NULL, NULL),
  ('42-032', NULL, NULL, NULL, NULL, NULL, '42-032              ', NULL, NULL),
  ('42-033', NULL, NULL, NULL, NULL, NULL, '42-003              ', NULL, NULL),
  ('42-035', NULL, NULL, NULL, NULL, NULL, '42-035              ', NULL, NULL),
  ('42-061', NULL, NULL, NULL, NULL, NULL, '42,061              ', NULL, NULL),
  ('42-062', NULL, NULL, NULL, NULL, NULL, '42-062              ', NULL, NULL),
  ('42-063', NULL, NULL, NULL, NULL, NULL, '42-063              ', NULL, NULL),
  ('42-064', NULL, NULL, NULL, NULL, NULL, '42-064              ', NULL, NULL),
  ('42-453/CB-276', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('50X25', NULL, 'TUBO RETANGULAR 50X25 ', NULL, 1000, NULL, NULL, NULL, NULL),
  ('50X50', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('76X38', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('78-1873C', NULL, NULL, NULL, 150, NULL, NULL, '16', NULL),
  ('78-2052C', NULL, NULL, NULL, 2000, NULL, NULL, NULL, NULL),
  ('78-719', NULL, 'TUBO RETANGULAR 102X51 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('A-096/FC-017', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('AF-018', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AF-14', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-010', NULL, NULL, NULL, 12, NULL, NULL, '16', NULL),
  ('AL-03', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-05', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-06', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-06-D39', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-10', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-12', NULL, 'PERFIL U-40 15.87X15.87 ', NULL, 400, NULL, NULL, '16', NULL),
  ('AL-13', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-14', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-15', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AL-17', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AL-26', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-27', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-37', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-39', NULL, NULL, NULL, 1500, NULL, NULL, NULL, NULL),
  ('AL-44', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-47', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-49', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-50', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-51', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-52', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-6', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AL-63', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-64', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-65', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-68', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AL-75', NULL, NULL, NULL, 400, NULL, NULL, '16', NULL),
  ('AL-806', NULL, NULL, NULL, 800, NULL, NULL, NULL, NULL),
  ('AL-86', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-87', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-90', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-91', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-92', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-93', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-94', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-95', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('AL-96', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('ALS-092', NULL, '	 TRAVESSA SUPERIOR DA FOLHA COM OLHAL', NULL, NULL, NULL, NULL, NULL, NULL),
  ('AR1/2CANAISO.', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AR70ISO.', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('BG-001', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('BG-021', NULL, NULL, NULL, NULL, NULL, 'BG-021              ', NULL, NULL),
  ('BG-023', NULL, NULL, NULL, NULL, NULL, 'BG-023              ', NULL, NULL),
  ('BG-037', NULL, NULL, NULL, NULL, NULL, 'BG-037              ', NULL, NULL),
  ('CAN-L3X3', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('CC-023', NULL, NULL, NULL, NULL, NULL, 'CC-023              ', NULL, NULL),
  ('CG-021', NULL, NULL, NULL, NULL, NULL, 'CG-021              ', NULL, NULL),
  ('CG-074', NULL, NULL, NULL, NULL, NULL, 'CG-074              ', NULL, NULL),
  ('CG-075', NULL, NULL, NULL, NULL, NULL, 'CG-075              ', NULL, NULL),
  ('CG-077', NULL, NULL, NULL, NULL, NULL, 'CG-077              ', NULL, NULL),
  ('CG-083', NULL, NULL, NULL, NULL, NULL, 'CG-083              ', NULL, NULL),
  ('CG-1012', NULL, 'MONTANTE PARA 3 FUROS	', NULL, NULL, NULL, NULL, NULL, NULL),
  ('CG-177', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('CHR-005', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('CHR-115', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('CL-011', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('CM-173', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('CM-174', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('CM174', NULL, NULL, NULL, NULL, 'CHU-864', NULL, NULL, NULL),
  ('CT-1', NULL, NULL, 5950, NULL, NULL, 'PEREIRA BRITO L-642 ', NULL, NULL),
  ('D-141/DECAMP', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', '16', NULL),
  ('D-141/PC-010', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', '16', NULL),
  ('D-601', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('D-800', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('DP-089/DECAMP', NULL, 'ESTRUTURA PARA RIPADO ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('DP-124/DECAMP', NULL, 'TUBO RETANGULAR 140X50,8 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('DS-266', NULL, NULL, NULL, NULL, 'ALCOA', NULL, NULL, NULL),
  ('E-364/PC-006', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('FA-206', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-211', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-223', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-226', NULL, 'ANCORAGEM CENTRAL PARA COLUNAS ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('FA-239A', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-245', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-294', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-375', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-401', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-405', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('FA-406', NULL, 'TRAVESSA SUPERIOR E INFERIOR DO QUADRO FIXO ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('FC-087', NULL, 'PERFIL RUFO ', NULL, NULL, 'PELE DE VIDRO III', NULL, NULL, NULL),
  ('FC-258', NULL, NULL, NULL, NULL, 'PELE DE VIDRO III', NULL, NULL, NULL),
  ('GS-034', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('HS-862', NULL, NULL, NULL, 300, NULL, NULL, NULL, NULL),
  ('L-093', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16'),
  ('L-642/DS-287', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('L28-36', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('L28-37', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('LB-010', NULL, NULL, NULL, 300, NULL, NULL, NULL, NULL),
  ('LG021', NULL, NULL, NULL, 1200, NULL, NULL, NULL, NULL),
  ('LG158', NULL, NULL, NULL, NULL, '
', NULL, NULL, NULL),
  ('ME-013', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('ME-092', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('MG32-063', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('MG32-119', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('MG32-160', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('MN001', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('MN003', NULL, NULL, NULL, NULL, 'MERCADO', NULL, '16', NULL),
  ('MN034', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('MP-350', NULL, 'ARREMATE FACE INTERNA 60MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('NG-092', 'NG-092 ', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-027', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('P-215', NULL, 'PERFIL DE ALUMÍNIO "U" 9 X 15 MM ', NULL, NULL, 'TEC VIDROS', NULL, NULL, NULL),
  ('P-216', NULL, NULL, NULL, NULL, 'TEC- VIDROS
', NULL, NULL, NULL),
  ('P832-IN-250', NULL, NULL, 2500, NULL, NULL, NULL, NULL, NULL),
  ('PAC-12', NULL, NULL, NULL, NULL, NULL, 'alumifix            ', NULL, NULL),
  ('PAC-13', NULL, NULL, NULL, NULL, NULL, 'alumifix            ', NULL, NULL),
  ('PC-002', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('PC-003', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('PC-004', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('PR42-003/DECAMP', NULL, 'CAIXILHO MUXARABI ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PS-301', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-303', NULL, NULL, NULL, 100, NULL, NULL, '16', NULL),
  ('PS-305', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-306', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-307', NULL, 'COLUNA CENTRAL 120 MM ', 6500, 100, NULL, NULL, '16', NULL),
  ('PS-308', NULL, 'COLUNA CENTRAL 180 MM ', 6500, 100, NULL, NULL, '16', NULL),
  ('PS-317', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-319', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-348', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-349', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PS-354', NULL, 'COLUNA CENTRAL 54 MM ', 6500, 100, NULL, NULL, '16', NULL),
  ('PS-355', NULL, NULL, 6500, 100, NULL, NULL, '16', NULL),
  ('PT-009', NULL, 'PERFIL "T" 25,4 X 25,4 X 1,58 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PU-08MMINOX', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('PU-10MM INOX', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('PU-INOX10MM', NULL, NULL, 3000, NULL, NULL, NULL, NULL, NULL),
  ('PU206', NULL, NULL, NULL, 500, NULL, NULL, NULL, '16'),
  ('PU207', NULL, NULL, NULL, 500, NULL, NULL, NULL, '16'),
  ('RP-001', NULL, 'RIPADO ESPECIAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('RP-002', NULL, 'RIPADO ESPECIAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('SU-023', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-115', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-116', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-118', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-119', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-199', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU-202', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU004', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU006', NULL, NULL, NULL, 1120, NULL, NULL, NULL, NULL),
  ('SU008', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU009', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU010', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU011', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU012', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU013', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU014', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU039', NULL, NULL, NULL, 450, NULL, NULL, NULL, NULL),
  ('SU040', NULL, NULL, NULL, 450, NULL, NULL, NULL, NULL),
  ('SU043', NULL, NULL, 4600, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU047', NULL, NULL, NULL, 700, NULL, NULL, NULL, NULL),
  ('SU055', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU056', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU060', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU061', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU063', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU111', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU186', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('SU202', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU244', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU273', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('SU274', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('TB-QUAD 40X40', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TMF-085/DECAMP', NULL, 'CLICK ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('TMG-158/DECAMP', NULL, NULL, NULL, NULL, '
', NULL, NULL, NULL),
  ('TQ-10X10X1,00MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TQ-50X50X1,30', NULL, NULL, 5950, NULL, NULL, 'PB TUB-4071         ', NULL, NULL),
  ('TQ-50X50X1,80', NULL, NULL, NULL, NULL, NULL, 'ALUMAX TUB-4020P    ', NULL, NULL),
  ('TQ-50X50X1.2MM', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TQ-INOX40X40X1.5MM', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TQ012', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('TQ015', NULL, NULL, NULL, NULL, NULL, 'Belmetal            ', NULL, NULL),
  ('TR-1"INOX', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-1"X1,20', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-1.1/2"X1,20', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-1.1/4"X1,20', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-1/2"X1,5MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TR-11/4INOX', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-2.1/2"X1.20MM', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-2INOX', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-3/4"INOX', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('TR-50X100X1,40', NULL, NULL, NULL, NULL, NULL, 'ALUMAX NI-384       ', NULL, NULL),
  ('TR-50X100X2,00', NULL, NULL, 5950, NULL, NULL, 'PB 74500            ', NULL, NULL),
  ('TR-50X25X1,00', NULL, NULL, 5950, NULL, NULL, 'PB TUB-4576         ', NULL, NULL),
  ('TR-50X25X2,00', NULL, NULL, NULL, NULL, NULL, 'ALUMAX TUB-4504     ', NULL, NULL),
  ('TRT-40X15X1,20MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-50X20X1.50MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-50X70', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-60X40X1.5', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TUB-069/TR-070', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('TUB-4504/TG-007', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('U-877/FC-542', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('U-878/FC-543', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('US280', NULL, 'VENEZIANA VENTILADA 9,7 X 74	', NULL, NULL, NULL, NULL, NULL, NULL),
  ('US294', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('VT-1904', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16'),
  ('VZ-024', NULL, NULL, 5950, NULL, NULL, NULL, NULL, NULL),
  ('VZ-051', NULL, NULL, 5950, NULL, NULL, NULL, NULL, NULL),
  ('VZ-060', NULL, NULL, 5950, NULL, NULL, 'Pereira Brito       ', NULL, NULL),
  ('VZ006', NULL, NULL, NULL, NULL, NULL, NULL, '16', NULL),
  ('VZC-3758', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZC-4158', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZC-4358', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZC-4558', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZP-3758', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZP-4158', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZP-4358', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('VZP-4558', NULL, NULL, 5800, NULL, NULL, NULL, NULL, NULL),
  ('Y-335', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('Y-355', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL);

-- Gate 1: o snapshot vivo precisa continuar exatamente igual ao auditado.
do $$
declare
  v_total integer;
  v_hash text;
  v_excecoes integer;
  v_excecoes_orfas integer;
begin
  select count(*) into v_total
  from public.produtos
  where categoria = 'perfil';

  if v_total <> 1307 then
    raise exception 'Snapshot Atlas mudou: esperava 1307 perfis; encontrou %', v_total;
  end if;

  select md5(
    string_agg(
      concat_ws(
        E'\x1f',
        coalesce(p.id::text, ''),
        coalesce(p.codigo, ''),
        coalesce(p.nome, ''),
        coalesce(p.unidade, ''),
        coalesce(round(p.peso_kg_m * 1000000)::bigint::text, ''),
        coalesce(p.ncm, ''),
        coalesce(p.marca, ''),
        case when p.ativo then 't' else 'f' end,
        coalesce(round(p.tamanho_barra_mm * 1000000)::bigint::text, ''),
        coalesce(p.origem, '')
      ),
      E'\x1e'
      order by upper(trim(p.codigo))
    )
  )
  into v_hash
  from public.produtos p
  where p.categoria = 'perfil';

  if v_hash is distinct from 'ef179d902fbfc13dfa2f32a9e0ffd322' then
    raise exception 'Snapshot Atlas mudou: hash auditado ef179d902fbfc13dfa2f32a9e0ffd322, hash atual %', v_hash;
  end if;

  select count(*) into v_excecoes from _perfil_wvetro_excecoes;
  if v_excecoes <> 249 then
    raise exception 'Esperava 249 códigos com exceções de origem; encontrou %', v_excecoes;
  end if;

  select count(*) into v_excecoes_orfas
  from _perfil_wvetro_excecoes e
  left join public.produtos p
    on p.categoria = 'perfil'
   and upper(trim(p.codigo)) = e.codigo_norm
  where p.id is null;

  if v_excecoes_orfas <> 0 then
    raise exception 'Há % exceção(ões) sem perfil correspondente no snapshot Atlas', v_excecoes_orfas;
  end if;
end $$;

-- Reconstrói os 1.307 dados crus da fonte a partir do snapshot auditado +
-- exceções explícitas. Nenhum desses campos modifica o valor operacional.
create temporary table _reconciliacao_perfis_wvetro on commit drop as
select
  p.id as atlas_id,
  upper(trim(p.codigo)) as codigo_norm,
  coalesce(e.codigo_raw_override, p.codigo) as codigo_origem_raw,
  coalesce(e.descricao_raw_override, substr(p.nome, length(p.codigo) + 4)) as descricao_fonte,
  p.peso_kg_m as peso_fonte,
  p.unidade as unidade_fonte,
  coalesce(e.ncm_raw_override, p.ncm) as ncm_fonte,
  coalesce(e.tamanho_raw_override, 6000::numeric) as tamanho_fonte,
  coalesce(e.sucata_raw_override, 0::numeric) as sucata_fonte,
  'Sim'::text as ativo_fonte,
  coalesce(e.obs_raw_override, '16'::text) as obs_fonte,
  coalesce(e.cod_barras_raw_override, repeat(' ', 20)) as cod_barras_fonte,
  coalesce(e.fabricante_raw_override, p.marca) as fabricante_fonte,
  case
    when trim(coalesce(e.ncm_raw_override, p.ncm, '')) = '16'
      or trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16'
      then 'EXISTENTE_FONTE_NAO_PROMOVIDA'
    else 'EXISTENTE_IGUAL'
  end as status_reconciliacao,
  nullif(
    concat_ws(
      ',',
      case
        when trim(coalesce(e.ncm_raw_override, p.ncm, '')) = '16'
          then 'NCM_FONTE_NAO_PROMOVIDO'
      end,
      case
        when trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16'
          then 'FABRICANTE_FONTE_NAO_PROMOVIDO'
      end
    ),
    ''
  ) as motivos_nao_promovidos,
  nullif(
    concat_ws(
      ',',
      case
        when trim(coalesce(e.ncm_raw_override, p.ncm, '')) in ('', '0', '12345678', '12345667')
          then 'NCM_PLACEHOLDER'
        when trim(coalesce(e.ncm_raw_override, p.ncm, '')) !~ '^[0-9]{8}$'
          then 'NCM_FORMATO_ATIPICO'
      end,
      case when p.peso_kg_m > 50 then 'PESO_MUITO_ALTO' end,
      case
        when coalesce(e.tamanho_raw_override, 6000::numeric) < 1000
          or coalesce(e.tamanho_raw_override, 6000::numeric) > 10000
          then 'TAMANHO_ATIPICO'
      end,
      case
        when trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16'
          then 'FABRICANTE_NUMERICO_16'
      end,
      case
        when trim(coalesce(e.cod_barras_raw_override, repeat(' ', 20))) <> ''
          then 'COD_BARRAS_PREENCHIDO'
      end,
      case
        when coalesce(e.sucata_raw_override, 0::numeric) <> 0
          then 'SUCATA_NAO_ZERO'
      end
    ),
    ''
  ) as flags_revisao
from public.produtos p
left join _perfil_wvetro_excecoes e
  on e.codigo_norm = upper(trim(p.codigo))
where p.categoria = 'perfil';

-- Gate 2: a fonte reconstruída precisa ser exatamente a fonte auditada.
do $$
declare
  v_total integer;
  v_hash text;
  v_duplicados integer;
  v_iguais integer;
  v_nao_promovidos integer;
  v_unidade_invalida integer;
  v_ncm_placeholder integer;
  v_ncm_atipico integer;
  v_tamanho_atipico integer;
  v_peso_alto integer;
  v_fabricante_16 integer;
  v_cod_barras integer;
  v_sucata integer;
  v_ncm_16 integer;
  v_fab_16 integer;
begin
  select count(*) into v_total from _reconciliacao_perfis_wvetro;
  if v_total <> 1307 then
    raise exception 'Fonte reconstruída esperava 1307 linhas; encontrou %', v_total;
  end if;

  select count(*) into v_duplicados
  from (
    select upper(regexp_replace(trim(codigo_origem_raw), '\s+', ' ', 'g'))
    from _reconciliacao_perfis_wvetro
    group by 1
    having count(*) > 1
  ) d;
  if v_duplicados <> 0 then
    raise exception 'Fonte reconstruída contém % código(s) duplicado(s)', v_duplicados;
  end if;

  select md5(
    string_agg(
      concat_ws(
        E'\x1f',
        coalesce(codigo_origem_raw, ''),
        coalesce(descricao_fonte, ''),
        coalesce(round(peso_fonte * 1000000)::bigint::text, ''),
        coalesce(unidade_fonte, ''),
        coalesce(ncm_fonte, ''),
        coalesce(round(tamanho_fonte * 1000000)::bigint::text, ''),
        coalesce(round(sucata_fonte * 1000000)::bigint::text, ''),
        coalesce(ativo_fonte, ''),
        coalesce(obs_fonte, ''),
        coalesce(cod_barras_fonte, ''),
        coalesce(fabricante_fonte, '')
      ),
      E'\x1e'
      order by codigo_norm
    )
  )
  into v_hash
  from _reconciliacao_perfis_wvetro;

  if v_hash is distinct from '1de834f0f4bc2b791b73479529e3392b' then
    raise exception 'Fonte reconstruída não coincide com a planilha auditada: hash esperado 1de834f0f4bc2b791b73479529e3392b, atual %', v_hash;
  end if;

  select count(*) into v_iguais
  from _reconciliacao_perfis_wvetro
  where status_reconciliacao = 'EXISTENTE_IGUAL';
  if v_iguais <> 1235 then
    raise exception 'Esperava 1235 EXISTENTE_IGUAL; encontrou %', v_iguais;
  end if;

  select count(*) into v_nao_promovidos
  from _reconciliacao_perfis_wvetro
  where status_reconciliacao = 'EXISTENTE_FONTE_NAO_PROMOVIDA';
  if v_nao_promovidos <> 72 then
    raise exception 'Esperava 72 EXISTENTE_FONTE_NAO_PROMOVIDA; encontrou %', v_nao_promovidos;
  end if;

  select count(*) into v_unidade_invalida
  from (
    with esperado(unidade, quantidade) as (
      values ('BR',1256), ('MT',26), ('UN',25)
    ),
    atual as (
      select upper(trim(unidade_fonte)) as unidade, count(*)::integer as quantidade
      from _reconciliacao_perfis_wvetro
      group by 1
    )
    select coalesce(e.unidade, a.unidade)
    from esperado e
    full join atual a using (unidade)
    where coalesce(e.quantidade, -1) <> coalesce(a.quantidade, -1)
  ) x;
  if v_unidade_invalida <> 0 then
    raise exception 'Distribuição de unidades não coincide com BR=1256 MT=26 UN=25';
  end if;

  select count(*) into v_ncm_placeholder
  from _reconciliacao_perfis_wvetro
  where position('NCM_PLACEHOLDER' in coalesce(flags_revisao, '')) > 0;
  if v_ncm_placeholder <> 221 then
    raise exception 'Esperava 221 NCM placeholder; encontrou %', v_ncm_placeholder;
  end if;

  select count(*) into v_ncm_atipico
  from _reconciliacao_perfis_wvetro
  where position('NCM_FORMATO_ATIPICO' in coalesce(flags_revisao, '')) > 0;
  if v_ncm_atipico <> 18 then
    raise exception 'Esperava 18 NCM em formato atípico; encontrou %', v_ncm_atipico;
  end if;

  select count(*) into v_tamanho_atipico
  from _reconciliacao_perfis_wvetro
  where position('TAMANHO_ATIPICO' in coalesce(flags_revisao, '')) > 0;
  if v_tamanho_atipico <> 7 then
    raise exception 'Esperava 7 tamanhos atípicos; encontrou %', v_tamanho_atipico;
  end if;

  select count(*) into v_peso_alto
  from _reconciliacao_perfis_wvetro
  where position('PESO_MUITO_ALTO' in coalesce(flags_revisao, '')) > 0;
  if v_peso_alto <> 2 then
    raise exception 'Esperava 2 pesos muito altos; encontrou %', v_peso_alto;
  end if;

  select count(*) into v_fabricante_16
  from _reconciliacao_perfis_wvetro
  where position('FABRICANTE_NUMERICO_16' in coalesce(flags_revisao, '')) > 0;
  if v_fabricante_16 <> 68 then
    raise exception 'Esperava 68 fabricantes numéricos 16; encontrou %', v_fabricante_16;
  end if;

  select count(*) into v_cod_barras
  from _reconciliacao_perfis_wvetro
  where position('COD_BARRAS_PREENCHIDO' in coalesce(flags_revisao, '')) > 0;
  if v_cod_barras <> 61 then
    raise exception 'Esperava 61 códigos de barras preenchidos; encontrou %', v_cod_barras;
  end if;

  select count(*) into v_sucata
  from _reconciliacao_perfis_wvetro
  where position('SUCATA_NAO_ZERO' in coalesce(flags_revisao, '')) > 0;
  if v_sucata <> 83 then
    raise exception 'Esperava 83 valores de sucata não zero; encontrou %', v_sucata;
  end if;

  select count(*) into v_ncm_16
  from _reconciliacao_perfis_wvetro
  where motivos_nao_promovidos = 'NCM_FONTE_NAO_PROMOVIDO'
    and trim(coalesce(ncm_fonte, '')) = '16';
  if v_ncm_16 <> 4 then
    raise exception 'Esperava exatamente 4 NCM=16 não promovidos; encontrou %', v_ncm_16;
  end if;

  select count(*) into v_fab_16
  from _reconciliacao_perfis_wvetro
  where motivos_nao_promovidos = 'FABRICANTE_FONTE_NAO_PROMOVIDO'
    and trim(coalesce(fabricante_fonte, '')) = '16';
  if v_fab_16 <> 68 then
    raise exception 'Esperava exatamente 68 fabricantes=16 não promovidos; encontrou %', v_fab_16;
  end if;
end $$;

-- Congela todas as colunas que esta migration promete NÃO modificar.
-- Exclui somente os campos de proveniência alterados e updated_at.
create temporary table _atlas_perfis_protegidos_antes on commit drop as
select
  p.id,
  (
    to_jsonb(p)
    - ARRAY[
        'codigo_origem',
        'origem',
        'unidade_origem',
        'tamanho_barra_mm_origem',
        'ncm_origem',
        'dados_origem',
        'updated_at'
      ]::text[]
  ) as protegido
from public.produtos p
join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id;

-- Enriquecimento EXCLUSIVAMENTE de proveniência.
update public.produtos p
set
  codigo_origem = c.codigo_origem_raw,
  origem = 'wvetro',
  unidade_origem = c.unidade_fonte,
  tamanho_barra_mm_origem = c.tamanho_fonte,
  ncm_origem = case
    when trim(coalesce(c.ncm_fonte, '')) = '' then null
    else c.ncm_fonte
  end,
  dados_origem = coalesce(p.dados_origem, '{}'::jsonb) || jsonb_build_object(
    'fonte', 'ExportWWPerfil (1)(1).xlsx',
    'fonte_sha256', 'd13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07',
    'reconciliacao', '2026-08-17',
    'snapshot_atlas_sha256', 'fca1d9672911b3c8770260bbac8b0c24319f1bb52519d528ed68c8d1f1e9b898',
    'atlas_snapshot_md5', 'ef179d902fbfc13dfa2f32a9e0ffd322',
    'fonte_dados_md5', '1de834f0f4bc2b791b73479529e3392b',
    'proveniencia_tipo', 'wvetro_reconciliado',
    'codigo_raw', c.codigo_origem_raw,
    'descricao_raw', c.descricao_fonte,
    'peso_raw', c.peso_fonte,
    'unidade_raw', c.unidade_fonte,
    'ncm_raw', c.ncm_fonte,
    'tamanho_raw', c.tamanho_fonte,
    'sucata_raw', c.sucata_fonte,
    'ativo_raw', c.ativo_fonte,
    'obs_raw', c.obs_fonte,
    'cod_barras_raw', c.cod_barras_fonte,
    'fabricante_raw', c.fabricante_fonte,
    'status_reconciliacao', c.status_reconciliacao,
    'motivos_nao_promovidos', c.motivos_nao_promovidos,
    'flags_revisao', c.flags_revisao
  ),
  updated_at = now()
from _reconciliacao_perfis_wvetro c
where p.id = c.atlas_id;

-- Pós-checks: proveniência completa e zero alteração fora do permitido.
do $$
declare
  v_atualizados integer;
  v_proveniencia_incompleta integer;
  v_protegido_alterado integer;
  v_tamanho_promovido integer;
  v_ncm_16_promovido integer;
  v_fabricante_16_promovido integer;
begin
  select count(*) into v_atualizados
  from public.produtos p
  join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.origem = 'wvetro';
  if v_atualizados <> 1307 then
    raise exception 'Pós-reconciliação esperava 1307 perfis com origem wvetro; encontrou %', v_atualizados;
  end if;

  select count(*) into v_proveniencia_incompleta
  from public.produtos p
  join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.codigo_origem is distinct from c.codigo_origem_raw
     or p.unidade_origem is distinct from c.unidade_fonte
     or p.tamanho_barra_mm_origem is distinct from c.tamanho_fonte
     or p.ncm_origem is distinct from (
          case when trim(coalesce(c.ncm_fonte, '')) = '' then null else c.ncm_fonte end
        )
     or p.dados_origem ->> 'fonte' is distinct from 'ExportWWPerfil (1)(1).xlsx'
     or p.dados_origem ->> 'fonte_sha256' is distinct from 'd13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07'
     or p.dados_origem ->> 'atlas_snapshot_md5' is distinct from 'ef179d902fbfc13dfa2f32a9e0ffd322'
     or p.dados_origem ->> 'fonte_dados_md5' is distinct from '1de834f0f4bc2b791b73479529e3392b'
     or p.dados_origem ->> 'status_reconciliacao' is distinct from c.status_reconciliacao;
  if v_proveniencia_incompleta <> 0 then
    raise exception 'Pós-reconciliação encontrou % perfil(is) com proveniência incompleta', v_proveniencia_incompleta;
  end if;

  select count(*) into v_protegido_alterado
  from _atlas_perfis_protegidos_antes a
  join public.produtos p on p.id = a.id
  where (
    to_jsonb(p)
    - ARRAY[
        'codigo_origem',
        'origem',
        'unidade_origem',
        'tamanho_barra_mm_origem',
        'ncm_origem',
        'dados_origem',
        'updated_at'
      ]::text[]
  ) is distinct from a.protegido;
  if v_protegido_alterado <> 0 then
    raise exception 'Pós-reconciliação detectou % perfil(is) com campo protegido alterado', v_protegido_alterado;
  end if;

  select count(*) into v_tamanho_promovido
  from public.produtos p
  join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.tamanho_barra_mm is not null;
  if v_tamanho_promovido <> 0 then
    raise exception 'Tamanho operacional foi promovido indevidamente em % perfil(is)', v_tamanho_promovido;
  end if;

  select count(*) into v_ncm_16_promovido
  from public.produtos p
  join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where c.motivos_nao_promovidos = 'NCM_FONTE_NAO_PROMOVIDO'
    and coalesce(p.ncm, '') <> '';
  if v_ncm_16_promovido <> 0 then
    raise exception 'NCM=16 foi promovido indevidamente em % perfil(is)', v_ncm_16_promovido;
  end if;

  select count(*) into v_fabricante_16_promovido
  from public.produtos p
  join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where c.motivos_nao_promovidos = 'FABRICANTE_FONTE_NAO_PROMOVIDO'
    and coalesce(p.marca, '') <> '';
  if v_fabricante_16_promovido <> 0 then
    raise exception 'Fabricante=16 foi promovido indevidamente em % perfil(is)', v_fabricante_16_promovido;
  end if;
end $$;

commit;
