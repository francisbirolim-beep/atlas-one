-- Export seguro dos perfis atuais do Atlas para reconciliação com ExportWWPerfil (1).xlsx
--
-- IMPORTANTE:
-- - somente leitura;
-- - não altera nenhum dado;
-- - usa o código técnico persistido quando disponível;
-- - usa apenas o prefixo legado de `nome` como fallback de identificação;
-- - preserva separadamente campos operacionais e campos de origem para auditoria.

select
  id,
  coalesce(nullif(trim(codigo), ''), trim(split_part(nome, ' - ', 1))) as codigo_atlas,
  codigo,
  codigo_origem,
  origem,
  id_externo_wvetro,
  nome,
  categoria,
  preco,
  custo,
  unidade,
  unidade_origem,
  peso_kg_m,
  tamanho_barra_mm,
  tamanho_barra_mm_origem,
  ncm,
  ncm_origem,
  ncm_status,
  status_validacao,
  observacao_validacao,
  dados_origem,
  grupo,
  marca,
  fornecedor_id,
  linha_id,
  cor_id,
  ativo,
  created_at,
  updated_at
from public.produtos
where categoria = 'perfil'
order by upper(coalesce(nullif(trim(codigo), ''), trim(split_part(nome, ' - ', 1)))), upper(nome);