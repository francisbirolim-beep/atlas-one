-- CMV por venda/obra: entradas reais auditáveis sem alterar compras e financeiro existentes.
create table if not exists public.venda_cmv_lancamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id),
  categoria text not null check (categoria in ('perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros')),
  origem text not null check (origem in ('compra','estoque','servico','outro')),
  descricao text not null check (char_length(descricao) between 1 and 500),
  valor numeric(14,2) not null check (valor > 0),
  quantidade numeric(14,3) null check (quantidade is null or quantidade > 0),
  unidade text null,
  data_lancamento date not null default current_date,
  fornecedor text null,
  documento text null,
  observacoes text null,
  anexo_nome text null,
  anexo_path text null,
  anexo_mime text null,
  criado_por_id uuid null,
  criado_por_nome text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_venda_cmv_lancamentos_venda on public.venda_cmv_lancamentos(empresa_id, venda_obra_id, created_at desc);
alter table public.venda_cmv_lancamentos enable row level security;
revoke all on public.venda_cmv_lancamentos from anon, authenticated;
grant select, insert, update, delete on public.venda_cmv_lancamentos to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('cmv-comprovantes','cmv-comprovantes',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;