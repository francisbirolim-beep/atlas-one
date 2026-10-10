-- Fase A do modulo Medicao Final expandido: corrige a base que ficou
-- incompleta (tabelas da v13 existiam so no codigo, nunca no banco) e troca
-- o criterio de "orcamento vendido" de orcamentos.status (que na pratica
-- fica desatualizado) para a coluna real do Kanban Comercial em que o card
-- esta. Idempotente.

-- Flag por coluna do Kanban: marca quais colunas representam "vendido" pra
-- fins de Medicao Final. Editavel pelo master na tela do Kanban.
alter table kanban_colunas
  add column if not exists gera_medicao_final boolean not null default false;

-- Marca a coluna "Vendido" ja existente (se houver, casando por nome
-- exatamente uma vez; nao mexe se ja tiver sido configurado antes).
update kanban_colunas
  set gera_medicao_final = true
  where lower(nome) = 'vendido';

-- Alinha as tabelas da v13 (medicao_colunas, medicoes_finais, medicao_itens,
-- tipologia_campos_extras) com o mesmo padrao de acesso temporario que o
-- resto do banco ja usa (orcamentos, clientes, kanban_colunas etc.), so
-- pra ficar consistente -- nao muda o nivel de acesso efetivo, que ja era
-- irrestrito por essas tabelas estarem sem RLS.
alter table medicao_colunas enable row level security;
alter table medicoes_finais enable row level security;
alter table medicao_itens enable row level security;
alter table tipologia_campos_extras enable row level security;

drop policy if exists acesso_total_temporario on medicao_colunas;
create policy acesso_total_temporario on medicao_colunas for all using (true) with check (true);

drop policy if exists acesso_total_temporario on medicoes_finais;
create policy acesso_total_temporario on medicoes_finais for all using (true) with check (true);

drop policy if exists acesso_total_temporario on medicao_itens;
create policy acesso_total_temporario on medicao_itens for all using (true) with check (true);

drop policy if exists acesso_total_temporario on tipologia_campos_extras;
create policy acesso_total_temporario on tipologia_campos_extras for all using (true) with check (true);
;
