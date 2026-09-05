alter table public.engenharia_receitas enable row level security;
alter table public.engenharia_conferencias enable row level security;
alter table public.engenharia_receita_componentes enable row level security;

drop policy if exists engenharia_receitas_authenticated_all on public.engenharia_receitas;
create policy engenharia_receitas_authenticated_all
on public.engenharia_receitas
for all
to authenticated
using (true)
with check (true);

drop policy if exists engenharia_conferencias_authenticated_all on public.engenharia_conferencias;
create policy engenharia_conferencias_authenticated_all
on public.engenharia_conferencias
for all
to authenticated
using (true)
with check (true);

drop policy if exists engenharia_receita_componentes_authenticated_all on public.engenharia_receita_componentes;
create policy engenharia_receita_componentes_authenticated_all
on public.engenharia_receita_componentes
for all
to authenticated
using (true)
with check (true);
