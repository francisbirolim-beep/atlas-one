alter table public.tipologias
  add column if not exists versao_tecnica integer not null default 1 check (versao_tecnica > 0);

create table if not exists public.orcamento_item_componentes_overrides (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  item_ref text not null,
  tipologia_id uuid references public.tipologias(id) on delete set null,
  formula_id uuid references public.engenharia_tipologia_formulas_corte(id) on delete set null,
  componente_tipo text not null check (componente_tipo in ('perfil','acessorio','vidro','outro')),
  acao text not null check (acao in ('adicionar','remover','substituir')),
  codigo_origem text,
  produto_origem_id uuid references public.produtos(id) on delete set null,
  codigo_destino text,
  produto_destino_id uuid references public.produtos(id) on delete set null,
  descricao_destino text,
  quantidade_override numeric,
  comprimento_override_mm numeric,
  escopo text not null default 'orcamento' check (escopo in ('orcamento','tipologia_definitiva')),
  justificativa text not null check (length(trim(justificativa)) >= 3),
  criado_por_id uuid references public.usuarios(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orcamento_item_componentes_overrides_orc_idx
  on public.orcamento_item_componentes_overrides(orcamento_id,item_ref,componente_tipo,created_at);

create table if not exists public.engenharia_tipologia_formulas_historico (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.engenharia_tipologia_formulas_corte(id) on delete cascade,
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  configuracao_chave text not null,
  versao integer not null check (versao > 0),
  evento text not null default 'alteracao' check (evento in ('criacao','alteracao','substituicao_componente','restauracao','duplicacao')),
  snapshot jsonb not null,
  justificativa text,
  restaurada_de_versao integer,
  origem_orcamento_id uuid references public.orcamentos(id) on delete set null,
  origem_item_ref text,
  criado_por_id uuid references public.usuarios(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  unique(formula_id,versao)
);
create index if not exists engenharia_tipologia_formulas_historico_tipologia_idx
  on public.engenharia_tipologia_formulas_historico(tipologia_id,configuracao_chave,versao desc);

alter table public.orcamento_item_componentes_overrides enable row level security;
alter table public.engenharia_tipologia_formulas_historico enable row level security;
drop policy if exists orcamento_item_componentes_overrides_auth_all on public.orcamento_item_componentes_overrides;
create policy orcamento_item_componentes_overrides_auth_all on public.orcamento_item_componentes_overrides
  for all to authenticated using (true) with check (true);
drop policy if exists engenharia_tipologia_formulas_historico_auth_read on public.engenharia_tipologia_formulas_historico;
create policy engenharia_tipologia_formulas_historico_auth_read on public.engenharia_tipologia_formulas_historico
  for select to authenticated using (true);
grant select,insert,update,delete on public.orcamento_item_componentes_overrides to authenticated;
grant select on public.engenharia_tipologia_formulas_historico to authenticated;

drop trigger if exists orcamento_item_componentes_overrides_updated_at on public.orcamento_item_componentes_overrides;
create trigger orcamento_item_componentes_overrides_updated_at
before update on public.orcamento_item_componentes_overrides
for each row execute function public.update_updated_at();

create or replace function public.fn_formula_tipologia_snapshot_v1(p_row public.engenharia_tipologia_formulas_corte)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'tipologia_id', p_row.tipologia_id,
    'configuracao_chave', p_row.configuracao_chave,
    'configuracao_label', p_row.configuracao_label,
    'variaveis', coalesce(p_row.variaveis,'[]'::jsonb),
    'pecas', coalesce(p_row.pecas,'[]'::jsonb),
    'acessorios', coalesce(p_row.acessorios,'[]'::jsonb),
    'vidro', coalesce(p_row.vidro,'{}'::jsonb),
    'status', p_row.status,
    'observacoes', p_row.observacoes,
    'ativo', p_row.ativo
  )
$$;

create or replace function public.fn_formula_tipologia_versionar_v1()
returns trigger
language plpgsql
set search_path=public
as $$
declare v_mudou boolean;
begin
  v_mudou :=
    new.variaveis is distinct from old.variaveis or
    new.pecas is distinct from old.pecas or
    new.acessorios is distinct from old.acessorios or
    new.vidro is distinct from old.vidro or
    new.configuracao_label is distinct from old.configuracao_label or
    new.status is distinct from old.status or
    new.observacoes is distinct from old.observacoes or
    new.ativo is distinct from old.ativo;
  if v_mudou then
    new.versao := greatest(coalesce(new.versao,1), coalesce(old.versao,1)+1);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_formula_tipologia_versionar_v1 on public.engenharia_tipologia_formulas_corte;
create trigger trg_formula_tipologia_versionar_v1
before update on public.engenharia_tipologia_formulas_corte
for each row execute function public.fn_formula_tipologia_versionar_v1();

create or replace function public.fn_formula_tipologia_historico_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_snapshot jsonb; v_evento text;
begin
  if tg_op='UPDATE' and not (
    new.variaveis is distinct from old.variaveis or
    new.pecas is distinct from old.pecas or
    new.acessorios is distinct from old.acessorios or
    new.vidro is distinct from old.vidro or
    new.configuracao_label is distinct from old.configuracao_label or
    new.status is distinct from old.status or
    new.observacoes is distinct from old.observacoes or
    new.ativo is distinct from old.ativo
  ) then return new; end if;

  v_snapshot := public.fn_formula_tipologia_snapshot_v1(new);
  v_evento := case when tg_op='INSERT' then 'criacao' else 'alteracao' end;

  insert into public.engenharia_tipologia_formulas_historico(
    formula_id,tipologia_id,configuracao_chave,versao,evento,snapshot,criado_por_id,criado_por_nome
  ) values(
    new.id,new.tipologia_id,new.configuracao_chave,new.versao,v_evento,v_snapshot,new.criado_por_id,new.criado_por_nome
  ) on conflict(formula_id,versao) do update set snapshot=excluded.snapshot;

  if tg_op='UPDATE' then
    update public.tipologias
       set versao_tecnica=greatest(coalesce(versao_tecnica,1)+1,2)
     where id=new.tipologia_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_formula_tipologia_historico_v1() from public,anon,authenticated;

drop trigger if exists trg_formula_tipologia_historico_v1 on public.engenharia_tipologia_formulas_corte;
create trigger trg_formula_tipologia_historico_v1
after insert or update on public.engenharia_tipologia_formulas_corte
for each row execute function public.fn_formula_tipologia_historico_v1();

insert into public.engenharia_tipologia_formulas_historico(
  formula_id,tipologia_id,configuracao_chave,versao,evento,snapshot,criado_por_id,criado_por_nome,created_at
)
select f.id,f.tipologia_id,f.configuracao_chave,coalesce(f.versao,1),'criacao',public.fn_formula_tipologia_snapshot_v1(f),f.criado_por_id,f.criado_por_nome,coalesce(f.updated_at,f.created_at,now())
from public.engenharia_tipologia_formulas_corte f
on conflict(formula_id,versao) do nothing;

create or replace function public.fn_restaurar_formula_tipologia_v1(
  p_formula_id uuid,
  p_versao integer,
  p_justificativa text
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_nome text; v_hist public.engenharia_tipologia_formulas_historico%rowtype;
  v_formula public.engenharia_tipologia_formulas_corte%rowtype; v_nova_versao integer;
begin
  select role,nome into v_role,v_nome from public.usuarios where id=auth.uid();
  if v_role is distinct from 'master' then raise exception 'Somente usuário master pode restaurar uma versão técnica'; end if;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para restaurar versão'; end if;

  select * into v_hist from public.engenharia_tipologia_formulas_historico
   where formula_id=p_formula_id and versao=p_versao;
  if not found then raise exception 'Versão histórica não encontrada'; end if;
  select * into v_formula from public.engenharia_tipologia_formulas_corte where id=p_formula_id for update;
  if not found then raise exception 'Fórmula técnica não encontrada'; end if;

  update public.engenharia_tipologia_formulas_corte
     set configuracao_label=coalesce(v_hist.snapshot->>'configuracao_label',configuracao_label),
         variaveis=coalesce(v_hist.snapshot->'variaveis','[]'::jsonb),
         pecas=coalesce(v_hist.snapshot->'pecas','[]'::jsonb),
         acessorios=coalesce(v_hist.snapshot->'acessorios','[]'::jsonb),
         vidro=coalesce(v_hist.snapshot->'vidro','{}'::jsonb),
         status=coalesce(v_hist.snapshot->>'status',status),
         observacoes=v_hist.snapshot->>'observacoes',
         ativo=coalesce((v_hist.snapshot->>'ativo')::boolean,ativo),
         versao=v_formula.versao+1
   where id=p_formula_id
   returning versao into v_nova_versao;

  update public.engenharia_tipologia_formulas_historico
     set evento='restauracao',justificativa=trim(p_justificativa),restaurada_de_versao=p_versao,
         criado_por_id=auth.uid(),criado_por_nome=v_nome
   where formula_id=p_formula_id and versao=v_nova_versao;
  return v_nova_versao;
end;
$$;
revoke execute on function public.fn_restaurar_formula_tipologia_v1(uuid,integer,text) from public,anon;
grant execute on function public.fn_restaurar_formula_tipologia_v1(uuid,integer,text) to authenticated;

create or replace function public.fn_tipologia_substituir_componente_direto_v1(
  p_formula_id uuid,
  p_componente_tipo text,
  p_codigo_origem text,
  p_codigo_destino text,
  p_justificativa text,
  p_orcamento_id uuid default null,
  p_item_ref text default null
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_nome text; v_formula public.engenharia_tipologia_formulas_corte%rowtype;
  v_array jsonb; v_novo jsonb; v_encontrados integer; v_nova_versao integer;
begin
  select role,nome into v_role,v_nome from public.usuarios where id=auth.uid();
  if v_role is distinct from 'master' then raise exception 'Somente usuário master pode alterar a tipologia definitivamente'; end if;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória'; end if;
  if nullif(trim(coalesce(p_codigo_origem,'')),'') is null or nullif(trim(coalesce(p_codigo_destino,'')),'') is null then raise exception 'Informe perfil/acessório de origem e destino'; end if;
  if p_componente_tipo not in ('perfil','acessorio') then raise exception 'Alteração definitiva direta suportada apenas para perfil/acessório; use o editor técnico para este componente'; end if;

  select * into v_formula from public.engenharia_tipologia_formulas_corte where id=p_formula_id for update;
  if not found then raise exception 'Fórmula técnica não encontrada'; end if;
  v_array := case when p_componente_tipo='perfil' then coalesce(v_formula.pecas,'[]'::jsonb) else coalesce(v_formula.acessorios,'[]'::jsonb) end;

  select count(*) into v_encontrados
    from jsonb_array_elements(v_array) e
   where upper(coalesce(e->>'codigo',''))=upper(trim(p_codigo_origem));
  if v_encontrados=0 then
    if v_array::text ilike '%'||p_codigo_origem||'%' then
      raise exception 'O componente aparece em uma regra técnica complexa. Abra o Editor Técnico para alterar sem quebrar a configuração.';
    end if;
    raise exception 'Componente de origem não encontrado na receita';
  end if;

  select coalesce(jsonb_agg(case when upper(coalesce(e->>'codigo',''))=upper(trim(p_codigo_origem)) then jsonb_set(e,'{codigo}',to_jsonb(trim(p_codigo_destino)),true) else e end),'[]'::jsonb)
    into v_novo from jsonb_array_elements(v_array) e;

  if p_componente_tipo='perfil' then
    update public.engenharia_tipologia_formulas_corte set pecas=v_novo where id=p_formula_id returning versao into v_nova_versao;
  else
    update public.engenharia_tipologia_formulas_corte set acessorios=v_novo where id=p_formula_id returning versao into v_nova_versao;
  end if;

  update public.engenharia_tipologia_formulas_historico
     set evento='substituicao_componente',justificativa=trim(p_justificativa),origem_orcamento_id=p_orcamento_id,
         origem_item_ref=p_item_ref,criado_por_id=auth.uid(),criado_por_nome=v_nome
   where formula_id=p_formula_id and versao=v_nova_versao;

  return v_nova_versao;
end;
$$;
revoke execute on function public.fn_tipologia_substituir_componente_direto_v1(uuid,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.fn_tipologia_substituir_componente_direto_v1(uuid,text,text,text,text,uuid,text) to authenticated;

create or replace function public.fn_duplicar_tipologia_v1(
  p_tipologia_id uuid,
  p_novo_label text,
  p_nova_chave text default null,
  p_justificativa text default 'Duplicação técnica'
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_nome text; v_src public.tipologias%rowtype; v_nova_id uuid; v_chave text;
  v_receita public.engenharia_receitas%rowtype; v_nova_receita_id uuid;
begin
  select role,nome into v_role,v_nome from public.usuarios where id=auth.uid();
  if v_role is distinct from 'master' then raise exception 'Somente usuário master pode duplicar tipologia'; end if;
  if length(trim(coalesce(p_novo_label,'')))<2 then raise exception 'Informe o nome da nova tipologia'; end if;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória'; end if;
  select * into v_src from public.tipologias where id=p_tipologia_id;
  if not found then raise exception 'Tipologia não encontrada'; end if;
  v_chave:=coalesce(nullif(trim(p_nova_chave),''),v_src.chave||'-copia-'||substr(replace(gen_random_uuid()::text,'-',''),1,6));
  if exists(select 1 from public.tipologias where chave=v_chave) then raise exception 'Já existe tipologia com esta chave'; end if;

  insert into public.tipologias(chave,label,categoria,ordem,ativo,origem_referencia,linha_origem_wvetro,modelo_origem_wvetro,foto_url,versao_tecnica)
  values(v_chave,trim(p_novo_label),v_src.categoria,v_src.ordem+1,true,'atlas',v_src.linha_origem_wvetro,v_src.modelo_origem_wvetro,v_src.foto_url,1)
  returning id into v_nova_id;

  insert into public.linha_tipologias(linha_id,tipologia_id)
  select linha_id,v_nova_id from public.linha_tipologias where tipologia_id=p_tipologia_id on conflict do nothing;

  insert into public.engenharia_tipologia_variaveis(tipologia_id,variavel_id,ordem,obrigatorio)
  select v_nova_id,variavel_id,ordem,obrigatorio from public.engenharia_tipologia_variaveis where tipologia_id=p_tipologia_id;

  insert into public.engenharia_variaveis_preset(tipologia_id,produto_id,nome,valores,padrao,criado_por_id,criado_por_nome,usar_no_orcamento,validado,validado_em,validado_por_id,validado_por_nome,evidencia_validacao,ativo,imagem_url,campos_corte)
  select v_nova_id,produto_id,nome,valores,padrao,auth.uid(),v_nome,usar_no_orcamento,false,null,null,null,null,ativo,imagem_url,campos_corte
    from public.engenharia_variaveis_preset where tipologia_id=p_tipologia_id;

  insert into public.engenharia_tipologia_formulas_corte(tipologia_id,variaveis,pecas,ativo,criado_por_id,criado_por_nome,configuracao_chave,configuracao_label,status,versao,observacoes,vidro,acessorios)
  select v_nova_id,variaveis,pecas,ativo,auth.uid(),v_nome,configuracao_chave,configuracao_label,'em_desenvolvimento',1,
         concat_ws(E'\n',observacoes,'Duplicada de '||v_src.label||'. '||trim(p_justificativa)),vidro,acessorios
    from public.engenharia_tipologia_formulas_corte where tipologia_id=p_tipologia_id;

  for v_receita in select * from public.engenharia_receitas where tipologia_id=p_tipologia_id loop
    insert into public.engenharia_receitas(tipologia_id,nome,versao,ativo,observacoes,criado_por_id,criado_por_nome,produto_id)
    values(v_nova_id,v_receita.nome,1,false,concat_ws(E'\n',v_receita.observacoes,'Duplicada de '||v_src.label||'. '||trim(p_justificativa)),auth.uid(),v_nome,v_receita.produto_id)
    returning id into v_nova_receita_id;
    insert into public.engenharia_receita_componentes(receita_id,tipo,produto_id,nome,unidade,quantidade_base,formula_quantidade,formula_corte,observacao,ordem)
    select v_nova_receita_id,tipo,produto_id,nome,unidade,quantidade_base,formula_quantidade,formula_corte,observacao,ordem
      from public.engenharia_receita_componentes where receita_id=v_receita.id;
  end loop;

  update public.engenharia_tipologia_formulas_historico h
     set evento='duplicacao',justificativa=trim(p_justificativa),criado_por_id=auth.uid(),criado_por_nome=v_nome
   where h.tipologia_id=v_nova_id and h.versao=1;
  return v_nova_id;
end;
$$;
revoke execute on function public.fn_duplicar_tipologia_v1(uuid,text,text,text) from public,anon;
grant execute on function public.fn_duplicar_tipologia_v1(uuid,text,text,text) to authenticated;
