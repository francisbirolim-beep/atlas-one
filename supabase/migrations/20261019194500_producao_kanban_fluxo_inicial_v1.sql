-- Modo inicial isolado do Kanban de tipologias.
-- Nao altera ordens, medicoes, estoque, liberacao tecnica nem a RPC oficial.
create table if not exists public.producao_kanban_fluxo_inicial (
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  habilitado boolean not null default false,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, venda_obra_id)
);

create table if not exists public.producao_kanban_etapas_iniciais (
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  item_ref text not null,
  etapa text not null check (etapa in ('aguardando','liberada','em_producao','pendente','concluida')),
  motivo_pendencia text,
  categoria_pendencia text,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, venda_obra_id, item_ref)
);

create table if not exists public.producao_kanban_historico_inicial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  item_ref text not null,
  de_etapa text not null,
  para_etapa text not null,
  motivo text,
  usuario_id uuid not null,
  criado_em timestamptz not null default now()
);
create index if not exists producao_kanban_historico_inicial_venda_idx
  on public.producao_kanban_historico_inicial (empresa_id, venda_obra_id, criado_em desc);

alter table public.producao_kanban_fluxo_inicial enable row level security;
alter table public.producao_kanban_etapas_iniciais enable row level security;
alter table public.producao_kanban_historico_inicial enable row level security;
-- API autenticada via service_role; nao permitir bypass direto pelo cliente.
revoke all on public.producao_kanban_fluxo_inicial from public, anon, authenticated;
revoke all on public.producao_kanban_etapas_iniciais from public, anon, authenticated;
revoke all on public.producao_kanban_historico_inicial from public, anon, authenticated;
grant select,insert,update,delete on public.producao_kanban_fluxo_inicial to service_role;
grant select,insert,update,delete on public.producao_kanban_etapas_iniciais to service_role;
grant select,insert on public.producao_kanban_historico_inicial to service_role;

-- Autorizacao individual para movimentar cards do Kanban inicial, independente de funcao/cargo.
create table if not exists public.producao_kanban_permissoes_iniciais (
 empresa_id uuid not null references public.empresas(id),
 usuario_id uuid not null references auth.users(id) on delete cascade,
 pode_movimentar boolean not null default false,
 atualizado_por uuid references auth.users(id),
 atualizado_em timestamptz not null default now(),
 primary key(empresa_id,usuario_id)
);
alter table public.producao_kanban_permissoes_iniciais enable row level security;
revoke all on public.producao_kanban_permissoes_iniciais from public,anon,authenticated;
grant select,insert,update,delete on public.producao_kanban_permissoes_iniciais to service_role;

create table if not exists public.producao_kanban_permissoes_iniciais_auditoria (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 usuario_id uuid not null,
 concedida_antes boolean,
 concedida_depois boolean not null,
 atualizado_por uuid not null,
 criado_em timestamptz not null default now()
);
create index if not exists producao_kanban_perm_iniciais_audit_idx
 on public.producao_kanban_permissoes_iniciais_auditoria (empresa_id,usuario_id,criado_em desc);
alter table public.producao_kanban_permissoes_iniciais_auditoria enable row level security;
revoke all on public.producao_kanban_permissoes_iniciais_auditoria from public,anon,authenticated;
grant select,insert on public.producao_kanban_permissoes_iniciais_auditoria to service_role;

create or replace function private.auditar_producao_kanban_permissoes_iniciais_v1()
returns trigger language plpgsql security definer set search_path='' as $
begin
 if tg_op='UPDATE' and old.pode_movimentar=new.pode_movimentar then return new;end if;
 insert into public.producao_kanban_permissoes_iniciais_auditoria
 (empresa_id,usuario_id,concedida_antes,concedida_depois,atualizado_por)
 values(new.empresa_id,new.usuario_id,
  case when tg_op='INSERT' then null else old.pode_movimentar end,
  new.pode_movimentar,new.atualizado_por);
 return new;
end;$;
drop trigger if exists trg_auditar_producao_kanban_permissoes_iniciais
 on public.producao_kanban_permissoes_iniciais;
create trigger trg_auditar_producao_kanban_permissoes_iniciais
 after insert or update on public.producao_kanban_permissoes_iniciais
 for each row execute function private.auditar_producao_kanban_permissoes_iniciais_v1();
revoke all on function private.auditar_producao_kanban_permissoes_iniciais_v1()
 from public,anon,authenticated;

create or replace function public.fn_producao_kanban_mover_inicial_v1(
  p_empresa uuid, p_venda uuid, p_ref text, p_destino text, p_usuario uuid,
  p_motivo text default '', p_categoria text default 'outros', p_resolucao text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_etapa text;
  v_motivo text := trim(coalesce(p_motivo,''));
  v_resolucao text := trim(coalesce(p_resolucao,''));
  v_categoria text;
  v_config record;
  v_estado record;
begin
  if p_empresa is null or p_venda is null or p_usuario is null or
     nullif(trim(coalesce(p_ref,'')), '') is null or length(p_ref)>250 then
    raise exception 'Parametros incompletos para movimentacao.';
  end if;
  if p_destino not in ('aguardando','liberada','em_producao','pendente','concluida') then
    raise exception 'Etapa invalida.';
  end if;
  if not exists(select 1 from public.vendas_obras v
                where v.id=p_venda and v.empresa_id=p_empresa) then
    raise exception 'Venda nao localizada nesta empresa.';
  end if;
  select * into v_config from public.producao_kanban_fluxo_inicial
    where empresa_id=p_empresa and venda_obra_id=p_venda for update;
  if not found or not v_config.habilitado then
    raise exception 'O modo inicial desta venda nao esta habilitado.';
  end if;
  -- Verificacao no banco impede contornar a permissao enviando requisicao diretamente.
  if not exists (select 1 from public.usuarios u
      where u.id=p_usuario and u.empresa_id=p_empresa
       and (u.role='master' or exists (
         select 1 from public.producao_kanban_permissoes_iniciais perm
         where perm.empresa_id=p_empresa and perm.usuario_id=u.id
           and perm.pode_movimentar=true))) then
    raise exception 'Usuario sem autorizacao para movimentar este Kanban.';
  end if;
  select * into v_estado from public.producao_kanban_etapas_iniciais
    where empresa_id=p_empresa and venda_obra_id=p_venda and item_ref=p_ref for update;
  v_etapa := coalesce(v_estado.etapa,'aguardando');
  if v_etapa=p_destino then
    return jsonb_build_object('ok',true,'semAlteracao',true,'etapa',v_etapa,'provisorio',true);
  end if;
  if p_destino='pendente' and
     (length(v_motivo)<5 or length(v_motivo)>1000 or
      p_categoria not in ('perfil','acessorio','vidro','fabricacao','outros')) then
    raise exception 'Informe categoria e justificativa de 5 a 1000 caracteres.';
  end if;
  if v_etapa='pendente' and (length(v_resolucao)<5 or length(v_resolucao)>1000) then
    raise exception 'Informe como a pendencia foi resolvida (5 a 1000 caracteres).';
  end if;
  v_categoria := case when p_destino='pendente' then p_categoria else null end;
  insert into public.producao_kanban_etapas_iniciais
    (empresa_id,venda_obra_id,item_ref,etapa,motivo_pendencia,categoria_pendencia,atualizado_por)
  values(p_empresa,p_venda,p_ref,p_destino,
    case when p_destino='pendente' then v_motivo else null end,v_categoria,p_usuario)
  on conflict (empresa_id,venda_obra_id,item_ref) do update
    set etapa=excluded.etapa, motivo_pendencia=excluded.motivo_pendencia,
        categoria_pendencia=excluded.categoria_pendencia,
        atualizado_por=excluded.atualizado_por, atualizado_em=now();
  insert into public.producao_kanban_historico_inicial
    (empresa_id,venda_obra_id,item_ref,de_etapa,para_etapa,motivo,usuario_id)
  values(p_empresa,p_venda,p_ref,v_etapa,p_destino,
    case when p_destino='pendente' then v_motivo
         when v_etapa='pendente' then v_resolucao else null end,p_usuario);
  return jsonb_build_object('ok',true,'etapa',p_destino,'provisorio',true,
    'aviso','Card movimentado e salvo no acompanhamento inicial. A liberacao tecnica continua pendente.');
end; $$;
revoke all on function public.fn_producao_kanban_mover_inicial_v1(uuid,uuid,text,text,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.fn_producao_kanban_mover_inicial_v1(uuid,uuid,text,text,uuid,text,text,text)
  to service_role;
