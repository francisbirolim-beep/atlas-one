-- Controle aditivo de separação por unidade aprovada na Medição Final.
-- Não altera Kanban, ordens de produção nem liberações já existentes.
create table if not exists public.producao_separacao_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  medicao_item_id uuid not null references public.medicao_itens(id) on delete cascade,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'pendente', 'separado')),
  motivo text,
  materiais_conferidos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(materiais_conferidos) = 'array'),
  atualizado_por_id uuid,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_separacao_item_unico unique (medicao_item_id),
  constraint producao_separacao_motivo_pendente check (
    status <> 'pendente' or length(trim(coalesce(motivo, ''))) >= 5
  )
);
create index if not exists producao_separacao_empresa_status_idx
  on public.producao_separacao_itens (empresa_id, status, updated_at desc);

-- A associação não pode atravessar empresas, mesmo que um cliente tente trocar o identificador.
create or replace function private.guard_producao_separacao_empresa_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_empresa uuid;
begin
  select i.empresa_id into v_empresa from public.medicao_itens i
  where i.id = new.medicao_item_id;
  if v_empresa is null or new.empresa_id is distinct from v_empresa then
    raise exception 'Separação e peça pertencem a empresas diferentes.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_producao_separacao_empresa_v1() from public, anon, authenticated;
grant execute on function private.guard_producao_separacao_empresa_v1() to service_role;
drop trigger if exists trg_producao_separacao_empresa on public.producao_separacao_itens;
create trigger trg_producao_separacao_empresa
before insert or update of medicao_item_id, empresa_id
on public.producao_separacao_itens for each row
execute function private.guard_producao_separacao_empresa_v1();

alter table public.producao_separacao_itens enable row level security;
drop policy if exists producao_separacao_select on public.producao_separacao_itens;
create policy producao_separacao_select on public.producao_separacao_itens
  for select using (empresa_id = (select private.current_empresa_id()));
-- Escrita apenas pelo endpoint autenticado com permissão de edição do setor.
revoke all on public.producao_separacao_itens from anon, authenticated;
grant select on public.producao_separacao_itens to authenticated;

-- Falha fechada na base: revalidar aprovação no momento da gravação.
create or replace function private.guard_producao_separacao_aprovacao_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_item record;
begin
  select empresa_id, medido, status_medicao, quantidade into v_item
  from public.medicao_itens where id = new.medicao_item_id;
  if not found or v_item.empresa_id is distinct from new.empresa_id
     or v_item.medido is distinct from true or v_item.status_medicao <> 'aprovada'
     or coalesce(v_item.quantidade, 1) <> 1 then
    raise exception 'A peça não possui Medição Final individual aprovada.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_producao_separacao_aprovacao_v1() from public, anon, authenticated;
grant execute on function private.guard_producao_separacao_aprovacao_v1() to service_role;
drop trigger if exists trg_producao_separacao_aprovacao on public.producao_separacao_itens;
create trigger trg_producao_separacao_aprovacao
before insert or update on public.producao_separacao_itens
for each row execute function private.guard_producao_separacao_aprovacao_v1();

-- Histórico imutável de pendências, justificativas e conferências.
create table if not exists public.producao_separacao_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  medicao_item_id uuid not null references public.medicao_itens(id) on delete cascade,
  status text not null,
  motivo text,
  materiais_conferidos jsonb not null default '[]'::jsonb,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);
create index if not exists producao_separacao_historico_item_idx
  on public.producao_separacao_historico (medicao_item_id, created_at desc);
alter table public.producao_separacao_historico enable row level security;
drop policy if exists producao_separacao_historico_select on public.producao_separacao_historico;
create policy producao_separacao_historico_select on public.producao_separacao_historico
  for select using (empresa_id = (select private.current_empresa_id()));
revoke all on public.producao_separacao_historico from anon, authenticated;
grant select on public.producao_separacao_historico to authenticated;

create or replace function private.registrar_historico_separacao_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.producao_separacao_historico(
    empresa_id, medicao_item_id, status, motivo, materiais_conferidos, usuario_id, usuario_nome
  ) values (
    new.empresa_id, new.medicao_item_id, new.status, new.motivo,
    new.materiais_conferidos, new.atualizado_por_id, new.atualizado_por_nome
  );
  return new;
end;
$$;
revoke all on function private.registrar_historico_separacao_v1() from public, anon, authenticated;
grant execute on function private.registrar_historico_separacao_v1() to service_role;
drop trigger if exists trg_producao_separacao_historico on public.producao_separacao_itens;
create trigger trg_producao_separacao_historico
after insert or update of status, motivo, materiais_conferidos on public.producao_separacao_itens
for each row execute function private.registrar_historico_separacao_v1();

-- Identidade e versão dos materiais da separação: alterações técnicas invalidam uma conferência antiga.
alter table public.producao_separacao_itens
  add column if not exists pacote_id uuid references public.pacotes_tecnicos(id) on delete set null,
  add column if not exists assinatura_lista text;

-- Vínculo individual aditivo: preserva item_ref comercial em Vendas.
-- Novos pacotes gerados com Medição Final guardam o ID da unidade medida.
alter table public.pacote_tecnico_materiais
  add column if not exists medicao_item_id uuid references public.medicao_itens(id) on delete set null;
create index if not exists pacote_tecnico_materiais_medicao_item_idx
  on public.pacote_tecnico_materiais (medicao_item_id, pacote_id)
  where medicao_item_id is not null;

-- Cada material só pode apontar para Medição Final da mesma empresa e orçamento.
create or replace function private.guard_material_medicao_unidade_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_empresa uuid;
declare v_orcamento uuid;
declare v_pacote_empresa uuid;
declare v_pacote_orcamento uuid;
begin
  if new.medicao_item_id is null then return new; end if;
  select mf.empresa_id, mf.orcamento_id into v_empresa, v_orcamento
    from public.medicao_itens mi
    join public.medicoes_finais mf on mf.id = mi.medicao_id
   where mi.id = new.medicao_item_id;
  select pt.empresa_id, pt.orcamento_id into v_pacote_empresa, v_pacote_orcamento
    from public.pacotes_tecnicos pt where pt.id = new.pacote_id;
  if v_empresa is null or v_empresa is distinct from new.empresa_id
    or v_pacote_empresa is distinct from v_empresa
    or v_pacote_orcamento is distinct from v_orcamento then
    raise exception 'Material técnico não pertence à medição da mesma empresa/obra.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_material_medicao_unidade_v1() from public, anon, authenticated;
grant execute on function private.guard_material_medicao_unidade_v1() to service_role;
drop trigger if exists trg_guard_material_medicao_unidade on public.pacote_tecnico_materiais;
create trigger trg_guard_material_medicao_unidade
before insert or update of medicao_item_id, pacote_id, empresa_id
on public.pacote_tecnico_materiais for each row
execute function private.guard_material_medicao_unidade_v1();
