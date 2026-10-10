alter table public.cadastro_historico add column if not exists empresa_id uuid references public.empresas(id);
alter table public.cadastro_historico alter column empresa_id set default private.current_empresa_id();

-- Backfill controlado: o histórico continua imutável para a aplicação.
alter table public.cadastro_historico disable trigger trg_cadastro_historico_imutavel;
update public.cadastro_historico
set empresa_id = (select id from public.empresas where slug='esquadrifacio')
where empresa_id is null;
alter table public.cadastro_historico enable trigger trg_cadastro_historico_imutavel;

create index if not exists idx_cadastro_historico_empresa_id on public.cadastro_historico(empresa_id);

drop policy if exists cadastro_historico_auth_read on public.cadastro_historico;
create policy cadastro_historico_empresa_read
on public.cadastro_historico
for select
to authenticated
using (empresa_id = (select private.current_empresa_id()));
