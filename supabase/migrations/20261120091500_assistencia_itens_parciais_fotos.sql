-- Cadastro de múltiplos itens por chamado de assistência.
-- Mudança aditiva: mantém as colunas e os chamados legados intactos.
alter table public.assistencias
  add column if not exists itens jsonb not null default '[]'::jsonb;

alter table public.assistencias
  add column if not exists responsavel_abertura_nome text;

comment on column public.assistencias.itens is
  'Itens individuais da assistência: id, titulo, descricao e fotos_urls.';
comment on column public.assistencias.responsavel_abertura_nome is
  'Nome informado do responsável pela abertura; criado_por_id e criado_por_nome preservam o autor autenticado.';
