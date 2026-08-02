-- Adiciona suporte a "favoritos" nos orçamentos e nas tarefas pessoais
alter table orcamentos add column if not exists favorito boolean not null default false;
alter table tarefas add column if not exists favorito boolean not null default false;
