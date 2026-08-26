-- Cliente 360 precisa ler as contas reais do cliente.
-- Escrita continua centralizada nos fluxos/RPCs financeiros; esta migration libera somente SELECT.

alter table public.financeiro_contas_receber enable row level security;

drop policy if exists financeiro_contas_receber_authenticated_select on public.financeiro_contas_receber;
create policy financeiro_contas_receber_authenticated_select
on public.financeiro_contas_receber
for select
to authenticated
using (auth.uid() is not null);

grant select on public.financeiro_contas_receber to authenticated;
