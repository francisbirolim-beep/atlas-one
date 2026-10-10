alter table public.fornecedores
  add column if not exists whatsapp text,
  add column if not exists pedido_minimo numeric,
  add column if not exists frete_gratis_minimo numeric,
  add column if not exists prazo_medio_dias integer,
  add column if not exists condicao_pagamento_padrao text,
  add column if not exists observacoes_comerciais text;

alter table public.produtos
  add column if not exists estoque_minimo numeric,
  add column if not exists estoque_ideal numeric;

create table if not exists public.cadastro_historico (
  id uuid primary key default gen_random_uuid(),
  entidade_tabela text not null,
  entidade_tipo text not null,
  entidade_id uuid not null,
  versao integer not null,
  acao text not null check (acao in ('baseline','criado','alterado','arquivado','excluido')),
  dados_antes jsonb,
  dados_depois jsonb,
  campos_alterados text[] not null default '{}',
  motivo text,
  origem text not null default 'sistema',
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now(),
  unique (entidade_tabela, entidade_id, versao)
);

create index if not exists idx_cadastro_historico_entidade on public.cadastro_historico(entidade_tabela, entidade_id, versao desc);
create index if not exists idx_cadastro_historico_created_at on public.cadastro_historico(created_at desc);
create index if not exists idx_cadastro_historico_campos_gin on public.cadastro_historico using gin(campos_alterados);

alter table public.cadastro_historico enable row level security;
drop policy if exists cadastro_historico_auth_read on public.cadastro_historico;
create policy cadastro_historico_auth_read on public.cadastro_historico for select to authenticated using (auth.uid() is not null);
grant select on public.cadastro_historico to authenticated;
revoke insert, update, delete on public.cadastro_historico from anon, authenticated;

create or replace function public.fn_historico_imutavel_v1()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Histórico imutável: não é permitido alterar ou excluir registros históricos.';
end; $$;
revoke all on function public.fn_historico_imutavel_v1() from public, anon, authenticated;

drop trigger if exists trg_cadastro_historico_imutavel on public.cadastro_historico;
create trigger trg_cadastro_historico_imutavel before update or delete on public.cadastro_historico for each row execute function public.fn_historico_imutavel_v1();

create or replace function public.fn_cadastro_historico_append_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb; v_after jsonb; v_row jsonb; v_id uuid; v_versao integer;
  v_campos text[] := '{}'; v_acao text; v_motivo text; v_origem text;
  v_usuario_id uuid; v_usuario_nome text; v_tipo text; v_claims jsonb;
begin
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_row := coalesce(v_after, v_before, '{}'::jsonb);
  v_id := nullif(v_row->>'id','')::uuid;
  if v_id is null then return coalesce(new, old); end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_campos
    from (
      select key as k from jsonb_object_keys(coalesce(v_before,'{}'::jsonb)) key
      union select key as k from jsonb_object_keys(coalesce(v_after,'{}'::jsonb)) key
    ) s
    where k <> 'updated_at' and (v_before->k) is distinct from (v_after->k);
    if cardinality(v_campos) = 0 then return new; end if;
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}') into v_campos
    from jsonb_object_keys(coalesce(v_after,'{}'::jsonb)) key where key not in ('created_at','updated_at');
  else
    select coalesce(array_agg(key order by key), '{}') into v_campos
    from jsonb_object_keys(coalesce(v_before,'{}'::jsonb)) key where key not in ('created_at','updated_at');
  end if;

  v_acao := case when tg_op='INSERT' then 'criado' when tg_op='DELETE' then 'excluido'
    when coalesce(v_after->>'ativo','true')='false' and coalesce(v_before->>'ativo','true')='true' then 'arquivado'
    else 'alterado' end;

  v_motivo := coalesce(nullif(current_setting('app.audit_reason', true),''), nullif(v_after->>'motivo_alteracao',''), nullif(v_after->>'observacao_validacao',''), nullif(v_after->>'observacoes',''), nullif(v_before->>'observacao_validacao',''));
  v_origem := coalesce(nullif(current_setting('app.audit_origin', true),''), nullif(v_after->>'origem',''), nullif(v_after->>'origem_referencia',''), 'sistema');

  begin v_claims := nullif(current_setting('request.jwt.claims', true),'')::jsonb; exception when others then v_claims := null; end;
  v_usuario_id := coalesce(nullif(v_after->>'atualizado_por_id','')::uuid, nullif(v_after->>'validado_por_id','')::uuid, nullif(v_after->>'criado_por_id','')::uuid, nullif(v_before->>'atualizado_por_id','')::uuid, nullif(v_before->>'validado_por_id','')::uuid, nullif(v_before->>'criado_por_id','')::uuid, auth.uid());
  v_usuario_nome := coalesce(nullif(v_after->>'atualizado_por_nome',''), nullif(v_after->>'validado_por_nome',''), nullif(v_after->>'criado_por_nome',''), nullif(v_before->>'atualizado_por_nome',''), nullif(v_before->>'validado_por_nome',''), nullif(v_before->>'criado_por_nome',''), nullif(v_claims->>'email',''));

  v_tipo := case tg_table_name when 'produtos' then 'produto' when 'fornecedores' then 'fornecedor' when 'tipologias' then 'tipologia' when 'linhas' then 'linha' when 'linhas_tecnicas' then 'linha_tecnica' when 'cores' then 'cor' when 'produto_fornecedores' then 'produto_fornecedor' when 'catalogo_custos_tecnicos' then 'custo_tecnico' when 'produto_imagens' then 'produto_imagem' else tg_table_name end;

  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || v_id::text));
  select coalesce(max(versao),0)+1 into v_versao from public.cadastro_historico where entidade_tabela=tg_table_name and entidade_id=v_id;
  insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_antes,dados_depois,campos_alterados,motivo,origem,usuario_id,usuario_nome)
  values(tg_table_name,v_tipo,v_id,v_versao,v_acao,v_before,v_after,v_campos,v_motivo,v_origem,v_usuario_id,v_usuario_nome);
  return coalesce(new,old);
end; $$;
revoke all on function public.fn_cadastro_historico_append_v1() from public, anon, authenticated;

create table if not exists public.produto_imagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  url text not null,
  tipo text not null default 'foto' check (tipo in ('foto','desenho_tecnico','imagem_wvetro','catalogo','outro')),
  origem text not null default 'manual',
  origem_ref text,
  principal boolean not null default false,
  status_validacao text not null default 'pendente' check (status_validacao in ('pendente','validada','rejeitada')),
  metadata jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produto_id, url)
);
create unique index if not exists idx_produto_imagens_principal_unica on public.produto_imagens(produto_id) where principal=true and ativo=true;
create index if not exists idx_produto_imagens_produto on public.produto_imagens(produto_id, ativo, principal desc, created_at);
alter table public.produto_imagens enable row level security;
drop policy if exists produto_imagens_auth_read on public.produto_imagens;
create policy produto_imagens_auth_read on public.produto_imagens for select to authenticated using (auth.uid() is not null);
drop policy if exists produto_imagens_auth_insert on public.produto_imagens;
create policy produto_imagens_auth_insert on public.produto_imagens for insert to authenticated with check (auth.uid() is not null);
drop policy if exists produto_imagens_auth_update on public.produto_imagens;
create policy produto_imagens_auth_update on public.produto_imagens for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
grant select,insert,update on public.produto_imagens to authenticated;
revoke delete on public.produto_imagens from anon, authenticated;

insert into public.produto_imagens(produto_id,url,tipo,origem,principal,status_validacao,metadata)
select p.id,p.foto_url,case when p.origem='wvetro' then 'imagem_wvetro' else 'foto' end,coalesce(nullif(p.origem,''),'cadastro'),true,case when p.status_validacao='validado' then 'validada' else 'pendente' end,jsonb_build_object('migrado_de','produtos.foto_url')
from public.produtos p where p.foto_url is not null and trim(p.foto_url)<>'' on conflict(produto_id,url) do nothing;

insert into public.produto_imagens(produto_id,url,tipo,origem,origem_ref,principal,status_validacao,metadata)
select w.produto_atlas_id,w.imagem_atlas_url,'imagem_wvetro','wvetro',w.produto_wvetro_id,false,case when w.imagem_status in ('ok','validada','capturada','baixada') then 'validada' else 'pendente' end,jsonb_build_object('codigo_wvetro',w.codigo,'descricao_wvetro',w.descricao,'imagem_status',w.imagem_status)
from public.wvetro_produtos_snapshot w where w.produto_atlas_id is not null and w.imagem_atlas_url is not null and trim(w.imagem_atlas_url)<>'' on conflict(produto_id,url) do nothing;

insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'produtos','produto',id,1,'baseline',to_jsonb(p),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.produtos p where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='produtos' and h.entidade_id=p.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'fornecedores','fornecedor',id,1,'baseline',to_jsonb(f),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.fornecedores f where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='fornecedores' and h.entidade_id=f.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'tipologias','tipologia',id,1,'baseline',to_jsonb(t),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.tipologias t where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='tipologias' and h.entidade_id=t.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'linhas','linha',id,1,'baseline',to_jsonb(l),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.linhas l where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='linhas' and h.entidade_id=l.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'linhas_tecnicas','linha_tecnica',id,1,'baseline',to_jsonb(l),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.linhas_tecnicas l where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='linhas_tecnicas' and h.entidade_id=l.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'cores','cor',id,1,'baseline',to_jsonb(c),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.cores c where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='cores' and h.entidade_id=c.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'produto_fornecedores','produto_fornecedor',id,1,'baseline',to_jsonb(pf),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.produto_fornecedores pf where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='produto_fornecedores' and h.entidade_id=pf.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'catalogo_custos_tecnicos','custo_tecnico',id,1,'baseline',to_jsonb(c),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.catalogo_custos_tecnicos c where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='catalogo_custos_tecnicos' and h.entidade_id=c.id);
insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'produto_imagens','produto_imagem',id,1,'baseline',to_jsonb(i),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1' from public.produto_imagens i where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='produto_imagens' and h.entidade_id=i.id);

do $$ declare t text; begin
  foreach t in array array['produtos','fornecedores','tipologias','linhas','linhas_tecnicas','cores','produto_fornecedores','catalogo_custos_tecnicos','produto_imagens'] loop
    execute format('drop trigger if exists trg_cadastro_historico_%I on public.%I',t,t);
    execute format('create trigger trg_cadastro_historico_%I after insert or update or delete on public.%I for each row execute function public.fn_cadastro_historico_append_v1()',t,t);
  end loop;
end $$;
