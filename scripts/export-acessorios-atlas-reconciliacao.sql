-- Export seguro dos acessórios atuais do Atlas para reconciliação com ExportWWAcessorios.xlsx
--
-- IMPORTANTE:
-- - somente leitura;
-- - usa apenas colunas que já existiam antes da migration
--   20260816210000_produtos_identidade_tecnica_v1.sql;
-- - não altera nenhum dado;
-- - o código técnico deve ser extraído do prefixo de `nome` antes de " - "
--   enquanto a migration de identidade técnica ainda não estiver aplicada.

select
  id,
  trim(split_part(nome, ' - ', 1)) as codigo_inferido,
  nome,
  categoria,
  preco,
  unidade,
  ncm,
  grupo,
  marca,
  fornecedor_id,
  linha_id,
  cor_id,
  ativo,
  created_at,
  updated_at
from public.produtos
where categoria = 'acessorio'
order by upper(trim(split_part(nome, ' - ', 1))), upper(nome);
