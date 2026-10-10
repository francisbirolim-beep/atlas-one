-- Reconciliação aditiva da tabela de instalação já existente antes do módulo detalhado.
-- A migration original usa CREATE TABLE IF NOT EXISTS e não criou as colunas novas
-- quando encontrou a versão antiga da tabela.
alter table public.venda_instalacao_itens
  add column if not exists orcamento_id uuid null references public.orcamentos(id) on delete set null,
  add column if not exists descricao text null,
  add column if not exists quantidade_instalada numeric not null default 0,
  add column if not exists pendencia text null;

-- A UI e o endpoint já utilizam status parcial durante a instalação.
alter table public.venda_instalacao_itens
  drop constraint if exists venda_instalacao_itens_status_check;
alter table public.venda_instalacao_itens
  add constraint venda_instalacao_itens_status_check
  check (status in ('pendente','em_instalacao','instalado','pendencia'));

alter table public.venda_instalacao_itens
  drop constraint if exists venda_instalacao_itens_quantidade_instalada_check;
alter table public.venda_instalacao_itens
  add constraint venda_instalacao_itens_quantidade_instalada_check
  check (quantidade_instalada >= 0);

-- Somente schema: preserva registros, RLS, triggers, financeiro e bloqueios de conclusão.
