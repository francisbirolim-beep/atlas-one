-- Fase 9b: expande cadastro de Produtos com custo, margem, grupo, peso,
-- marca, fornecedor padrao e campos fiscais. Tudo opcional (nullable),
-- exceto o que ja era obrigatorio antes. Idempotente.

alter table produtos add column if not exists custo numeric;
alter table produtos add column if not exists margem_percentual numeric;
alter table produtos add column if not exists grupo text;
alter table produtos add column if not exists peso_kg numeric;
alter table produtos add column if not exists marca text;
alter table produtos add column if not exists fornecedor_id uuid references fornecedores(id) on delete set null;
alter table produtos add column if not exists ncm text;
alter table produtos add column if not exists icms_percentual numeric;
alter table produtos add column if not exists ipi_percentual numeric;
alter table produtos add column if not exists pis_percentual numeric;
alter table produtos add column if not exists cofins_percentual numeric;
;
