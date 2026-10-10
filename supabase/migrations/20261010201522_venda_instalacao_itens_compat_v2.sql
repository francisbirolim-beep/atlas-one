-- Atlas One: compatibilidade não destrutiva do checklist de instalação.
-- A tabela já existia em algumas bases antes da migration v1; CREATE TABLE IF NOT EXISTS
-- não adicionou as colunas introduzidas na versão nova da interface.
alter table public.venda_instalacao_itens
  add column if not exists orcamento_id uuid null references public.orcamentos(id) on delete set null,
  add column if not exists descricao text null,
  add column if not exists quantidade_instalada numeric not null default 0,
  add column if not exists pendencia text null;

-- Permitir o andamento parcial que o endpoint e a UI já utilizam,
-- sem permitir o encerramento prematuro da instalação.
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

-- Não altera linhas, políticas RLS, triggers, controles financeiros ou referências de venda.
