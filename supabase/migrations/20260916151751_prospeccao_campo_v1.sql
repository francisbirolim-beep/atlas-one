begin;

create table public.prospeccoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  nome_cliente text not null check (length(trim(nome_cliente)) > 0),
  telefone text,
  nome_obra text,
  cidade text,
  bairro text,
  endereco text,
  complemento text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  precisao_m numeric(10,2),
  localizacao_capturada_em timestamptz,
  fase_obra text,
  interesses text[] not null default '{}',
  temperatura text not null default 'frio' check (temperatura in ('frio','morno','quente')),
  status text not null default 'nova' check (status in (
    'nova','tentando_contato','contato_realizado','aguardando_retorno',
    'aguardando_projeto','visita_agendada','oportunidade_qualificada',
    'convertido','sem_interesse'
  )),
  observacoes text,
  responsavel_id uuid not null references public.usuarios(id),
  responsavel_nome text not null,
  proxima_acao text,
  proxima_acao_em timestamptz,
  agenda_evento_id uuid references public.eventos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  obra_id uuid references public.obras(id) on delete set null,
  convertido_em timestamptz,
  status_atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prospeccao_contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  prospeccao_id uuid not null references public.prospeccoes(id) on delete cascade,
  papel text not null check (papel in ('cliente','pedreiro','mestre_obra','arquiteto','engenheiro','construtora','outro')),
  nome text not null check (length(trim(nome)) > 0),
  telefone text,
  empresa text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.prospeccao_interacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  prospeccao_id uuid not null references public.prospeccoes(id) on delete cascade,
  tipo text not null check (tipo in ('visita','ligacao','whatsapp','nota','status','agenda','conversao','outro')),
  descricao text not null check (length(trim(descricao)) > 0),
  status_anterior text,
  status_novo text,
  proxima_acao text,
  proxima_acao_em timestamptz,
  usuario_id uuid not null references public.usuarios(id),
  usuario_nome text not null,
  created_at timestamptz not null default now()
);

create index prospeccoes_empresa_responsavel_idx on public.prospeccoes(empresa_id,responsavel_id);
create index prospeccoes_empresa_status_idx on public.prospeccoes(empresa_id,status,status_atualizado_em desc);
create index prospeccoes_empresa_local_idx on public.prospeccoes(empresa_id,cidade,bairro);
create index prospeccoes_proxima_acao_idx on public.prospeccoes(responsavel_id,proxima_acao_em) where proxima_acao_em is not null and status not in ('convertido','sem_interesse');
create index prospeccao_contatos_prospeccao_idx on public.prospeccao_contatos(prospeccao_id,created_at);
create index prospeccao_interacoes_prospeccao_idx on public.prospeccao_interacoes(prospeccao_id,created_at desc);

create trigger prospeccoes_updated_at
before update on public.prospeccoes
for each row execute function public.update_updated_at();

alter table public.prospeccoes enable row level security;
alter table public.prospeccao_contatos enable row level security;
alter table public.prospeccao_interacoes enable row level security;

revoke all on public.prospeccoes, public.prospeccao_contatos, public.prospeccao_interacoes from anon;
revoke all on public.prospeccoes, public.prospeccao_contatos, public.prospeccao_interacoes from authenticated;
grant select,insert,update,delete on public.prospeccoes, public.prospeccao_contatos, public.prospeccao_interacoes to authenticated;

create policy prospeccoes_select on public.prospeccoes for select to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
);
create policy prospeccoes_insert on public.prospeccoes for insert to authenticated
with check (
  empresa_id=(select private.current_empresa_id())
  and responsavel_id=(select auth.uid())
);
create policy prospeccoes_update on public.prospeccoes for update to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
)
with check (
  empresa_id=(select private.current_empresa_id())
  and (responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
);
create policy prospeccoes_delete on public.prospeccoes for delete to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
);

create policy prospeccao_contatos_select on public.prospeccao_contatos for select to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);
create policy prospeccao_contatos_insert on public.prospeccao_contatos for insert to authenticated
with check (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);
create policy prospeccao_contatos_update on public.prospeccao_contatos for update to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
)
with check (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);
create policy prospeccao_contatos_delete on public.prospeccao_contatos for delete to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);

create policy prospeccao_interacoes_select on public.prospeccao_interacoes for select to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);
create policy prospeccao_interacoes_insert on public.prospeccao_interacoes for insert to authenticated
with check (
  empresa_id=(select private.current_empresa_id())
  and usuario_id=(select auth.uid())
  and exists(select 1 from public.prospeccoes p where p.id=prospeccao_id and p.empresa_id=(select private.current_empresa_id()) and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas())))
);
create policy prospeccao_interacoes_update on public.prospeccao_interacoes for update to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (usuario_id=(select auth.uid()) or (select private.is_master_atlas()))
)
with check (
  empresa_id=(select private.current_empresa_id())
  and (usuario_id=(select auth.uid()) or (select private.is_master_atlas()))
);
create policy prospeccao_interacoes_delete on public.prospeccao_interacoes for delete to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (usuario_id=(select auth.uid()) or (select private.is_master_atlas()))
);

create or replace function public.fn_converter_prospeccao_v1(
  p_prospeccao_id uuid,
  p_cliente_existente_id uuid default null,
  p_criar_obra boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_empresa_id uuid := private.current_empresa_id();
  v_p public.prospeccoes%rowtype;
  v_cliente_id uuid;
  v_obra_id uuid;
begin
  if v_uid is null or v_empresa_id is null then raise exception 'Usuário não autenticado'; end if;

  select * into v_p from public.prospeccoes
  where id=p_prospeccao_id and empresa_id=v_empresa_id
    and (responsavel_id=v_uid or private.is_master_atlas())
  for update;
  if not found then raise exception 'Prospecção não encontrada ou sem acesso'; end if;
  if v_p.status='convertido' and v_p.cliente_id is not null then
    return jsonb_build_object('cliente_id',v_p.cliente_id,'obra_id',v_p.obra_id,'ja_convertido',true);
  end if;

  if p_cliente_existente_id is not null then
    select id into v_cliente_id from public.clientes where id=p_cliente_existente_id and empresa_id=v_empresa_id;
    if v_cliente_id is null then raise exception 'Cliente existente inválido'; end if;
  else
    insert into public.clientes(empresa_id,nome,whatsapp,telefone,cidade,endereco,bairro,origem,responsavel,observacoes)
    values(v_empresa_id,v_p.nome_cliente,nullif(v_p.telefone,''),nullif(v_p.telefone,''),v_p.cidade,v_p.endereco,v_p.bairro,
      'prospeccao_campo',v_p.responsavel_nome,
      concat_ws(E'\n',nullif(v_p.observacoes,''),'Criado a partir da Prospecção em Campo.'))
    returning id into v_cliente_id;
  end if;

  if p_criar_obra then
    insert into public.obras(empresa_id,cliente_id,nome,status,endereco,complemento,bairro,cidade,responsavel,observacoes,criado_por_id,criado_por_nome)
    values(v_empresa_id,v_cliente_id,coalesce(nullif(v_p.nome_obra,''),'Obra de '||v_p.nome_cliente),'planejamento',v_p.endereco,v_p.complemento,v_p.bairro,v_p.cidade,
      v_p.nome_cliente,concat_ws(E'\n',nullif(v_p.observacoes,''),'Origem: Prospecção em Campo.'),v_uid,v_p.responsavel_nome)
    returning id into v_obra_id;
  end if;

  update public.prospeccoes set cliente_id=v_cliente_id,obra_id=v_obra_id,status='convertido',convertido_em=now(),status_atualizado_em=now(),
    proxima_acao=null,proxima_acao_em=null
  where id=v_p.id;

  insert into public.prospeccao_interacoes(empresa_id,prospeccao_id,tipo,descricao,status_anterior,status_novo,usuario_id,usuario_nome)
  values(v_empresa_id,v_p.id,'conversao','Prospecção convertida em Cliente 360'||case when v_obra_id is not null then ' e obra' else '' end,
    v_p.status,'convertido',v_uid,v_p.responsavel_nome);

  return jsonb_build_object('cliente_id',v_cliente_id,'obra_id',v_obra_id,'ja_convertido',false);
end;
$$;

revoke all on function public.fn_converter_prospeccao_v1(uuid,uuid,boolean) from public,anon;
grant execute on function public.fn_converter_prospeccao_v1(uuid,uuid,boolean) to authenticated;

commit;
