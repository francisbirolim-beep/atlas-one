-- Layout visual independente de nome/código/ordem operacionais homologados.
begin;
alter table public.central_kanban_colunas add column if not exists nome_exibicao text;
alter table public.central_kanban_colunas add column if not exists ordem_visual integer;
alter table public.central_kanban_colunas add column if not exists personalizada boolean not null default false;
alter table public.kanban_colunas add column if not exists nome_exibicao text;
alter table public.kanban_colunas add column if not exists ordem_visual integer;
alter table public.kanban_colunas add column if not exists personalizada boolean not null default false;
alter table public.setor_kanban_colunas add column if not exists nome_exibicao text;
alter table public.setor_kanban_colunas add column if not exists ordem_visual integer;
alter table public.setor_kanban_colunas add column if not exists personalizada boolean not null default false;
create table if not exists public.kanban_layout_historico (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 quadro text not null,
 antes jsonb not null,
 depois jsonb not null,
 usuario_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists kanban_layout_historico_indice on public.kanban_layout_historico(empresa_id,quadro,created_at desc);
alter table public.kanban_layout_historico enable row level security;
revoke all on public.kanban_layout_historico from public,anon,authenticated;
grant select,insert on public.kanban_layout_historico to service_role;

create or replace function public.salvar_kanban_layout_visual_v1(
 p_empresa uuid,p_quadro text,p_colunas jsonb,p_usuario uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_setor text;v_original jsonb;v_depois jsonb;
 v_atual record;v_entrada jsonb;v_id uuid;v_nome text;v_ordem integer;v_nova integer;
 v_total integer;v_existentes integer;v_removidos integer;v_id_txt text;v_existe boolean;
begin
 select split_part(p_quadro,':',1),split_part(p_quadro,':',2) into v_tipo,v_setor;
 if p_quadro not in ('orcamento:comercial') and
    (v_tipo not in ('central','setor') or length(v_setor)<2 or length(v_setor)>60) then
  raise exception 'Quadro inválido';end if;
 if not exists(select 1 from public.usuarios where id=p_usuario and empresa_id=p_empresa and role='master')
  then raise exception 'Somente Master pode salvar configuração de colunas';end if;
 if jsonb_typeof(p_colunas)<>'array' then raise exception 'Colunas inválidas';end if;
 v_total:=jsonb_array_length(p_colunas);
 if v_total<1 or v_total>45 then raise exception 'Número de colunas inválido';end if;
 -- Adquirir lock único da empresa para impedir salvamento concorrente.
 perform 1 from public.empresas where id=p_empresa for update;
 if not found then raise exception 'Empresa inválida';end if;
 if v_tipo='central' then
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_original from public.central_kanban_colunas c
   where c.empresa_id=p_empresa and c.setor=v_setor;
 elsif v_tipo='setor' then
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_original from public.setor_kanban_colunas c
   where c.empresa_id=p_empresa and c.setor_id=v_setor;
 else
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_original from public.kanban_colunas c
   where c.empresa_id=p_empresa;
 end if;
 if v_original is null then raise exception 'Quadro sem colunas: configuração inicial deve ser feita na tela original';end if;
 if (select count(*) from jsonb_array_elements(p_colunas) x where
  length(btrim(coalesce(x->>'nome','')))<2 or length(btrim(coalesce(x->>'nome','')))>80)>0
 then raise exception 'Cada nome deve ter entre 2 e 80 caracteres';end if;
 if (select count(*) from jsonb_array_elements(p_colunas) x where
  not (coalesce(x->>'id','') ~ '^(previa-|[0-9a-fA-F]{8}-)'))>0
 then raise exception 'Identificador de coluna inválido';end if;
 -- Proibir omissão de colunas originais: só podemos remover personalizadas sem cards.
 if v_tipo='central' and exists(select 1 from public.central_kanban_colunas c
  where c.empresa_id=p_empresa and c.setor=v_setor and not c.personalizada
    and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text))
 then raise exception 'Coluna operacional original protegida';end if;
 if v_tipo='setor' and exists(select 1 from public.setor_kanban_colunas c
  where c.empresa_id=p_empresa and c.setor_id=v_setor and not c.personalizada
    and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text))
 then raise exception 'Coluna operacional original protegida';end if;
 if v_tipo='orcamento' and exists(select 1 from public.kanban_colunas c
  where c.empresa_id=p_empresa and not c.personalizada
    and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text))
 then raise exception 'Coluna operacional original protegida';end if;
 if (select count(*) from (select x->>'id' id from jsonb_array_elements(p_colunas) x group by 1 having count(*)>1) rep)>0
 then raise exception 'Colunas repetidas';end if;
 -- Excluir somente colunas personalizadas; FK ou referências impedem remoção de cards em uso.
 if v_tipo='central' then
  delete from public.central_kanban_colunas c where c.empresa_id=p_empresa and c.setor=v_setor and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)
   and not exists(select 1 from public.central_kanban_posicoes p where p.coluna_id=c.id and p.empresa_id=p_empresa);
  if exists(select 1 from public.central_kanban_colunas c where c.empresa_id=p_empresa and c.setor=v_setor and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)) then
   raise exception 'Coluna tem cards. Mova-os antes de excluir';end if;
 elsif v_tipo='setor' then
  delete from public.setor_kanban_colunas c where c.empresa_id=p_empresa and c.setor_id=v_setor and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)
   and not exists(select 1 from public.setor_kanban_itens i where i.coluna_id=c.id and i.empresa_id=p_empresa);
  if exists(select 1 from public.setor_kanban_colunas c where c.empresa_id=p_empresa and c.setor_id=v_setor and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)) then
   raise exception 'Coluna tem cards. Mova-os antes de excluir';end if;
 else
  delete from public.kanban_colunas c where c.empresa_id=p_empresa and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)
   and not exists(select 1 from public.orcamentos o where o.coluna_id=c.id and o.empresa_id=p_empresa);
  if exists(select 1 from public.kanban_colunas c where c.empresa_id=p_empresa and c.personalizada
   and not exists(select 1 from jsonb_array_elements(p_colunas) x where x->>'id'=c.id::text)) then
   raise exception 'Coluna tem orçamentos. Mova-os antes de excluir';end if;
 end if;
 v_ordem:=0;
 for v_entrada in select value from jsonb_array_elements(p_colunas) loop
  v_id_txt:=v_entrada->>'id';v_nome:=btrim(v_entrada->>'nome');
  if v_id_txt like 'previa-%' then
   if v_tipo='central' then
    select coalesce(max(ordem),-1)+1 into v_nova from public.central_kanban_colunas where empresa_id=p_empresa and setor=v_setor;
    insert into public.central_kanban_colunas(empresa_id,setor,nome,ordem,ordem_visual,personalizada)
      values(p_empresa,v_setor,v_nome,v_nova,v_ordem,true);
   elsif v_tipo='setor' then
    select coalesce(max(ordem),-1)+1 into v_nova from public.setor_kanban_colunas where empresa_id=p_empresa and setor_id=v_setor;
    insert into public.setor_kanban_colunas(empresa_id,setor_id,nome,ordem,ordem_visual,personalizada)
      values(p_empresa,v_setor,v_nome,v_nova,v_ordem,true);
   else
    select coalesce(max(ordem),-1)+1 into v_nova from public.kanban_colunas where empresa_id=p_empresa;
    insert into public.kanban_colunas(empresa_id,nome,ordem,ordem_visual,personalizada)
      values(p_empresa,v_nome,v_nova,v_ordem,true);
   end if;
  else
   begin v_id:=v_id_txt::uuid;exception when others then raise exception 'UUID de coluna inválido';end;
   if v_tipo='central' then
    update public.central_kanban_colunas set nome_exibicao=case when nome=v_nome then null else v_nome end,ordem_visual=v_ordem
    where id=v_id and empresa_id=p_empresa and setor=v_setor;
   elsif v_tipo='setor' then
    update public.setor_kanban_colunas set nome_exibicao=case when nome=v_nome then null else v_nome end,ordem_visual=v_ordem
    where id=v_id and empresa_id=p_empresa and setor_id=v_setor;
   else
    update public.kanban_colunas set nome_exibicao=case when nome=v_nome then null else v_nome end,ordem_visual=v_ordem
    where id=v_id and empresa_id=p_empresa;
   end if;
   if not found then raise exception 'Coluna não pertence a este Kanban';end if;
  end if;
  v_ordem:=v_ordem+1;
 end loop;
 if v_tipo='central' then
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_depois from public.central_kanban_colunas c
  where c.empresa_id=p_empresa and c.setor=v_setor;
 elsif v_tipo='setor' then
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_depois from public.setor_kanban_colunas c
  where c.empresa_id=p_empresa and c.setor_id=v_setor;
 else
  select jsonb_agg(to_jsonb(c) order by c.ordem,c.id) into v_depois from public.kanban_colunas c
  where c.empresa_id=p_empresa;
 end if;
 insert into public.kanban_layout_historico(empresa_id,quadro,antes,depois,usuario_id)
 values(p_empresa,p_quadro,v_original,v_depois,p_usuario);
 return jsonb_build_object('ok',true,'quadro',p_quadro,'colunas',v_ordem,'historico',true);
end;$$;
revoke all on function public.salvar_kanban_layout_visual_v1(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.salvar_kanban_layout_visual_v1(uuid,text,jsonb,uuid) to service_role;
commit;