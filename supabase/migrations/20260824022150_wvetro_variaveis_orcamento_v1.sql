create table if not exists public.wvetro_referencias_variaveis (
  id uuid primary key default gen_random_uuid(),
  referencia_tipologia_id uuid not null references public.wvetro_referencias_tipologias(id) on delete cascade,
  tipologia_atlas_id uuid references public.tipologias(id) on delete set null,
  variavel_atlas_id uuid references public.engenharia_variaveis(id) on delete set null,
  variavel_chave_raw text not null,
  variavel_label_raw text,
  valor_raw text,
  valor_normalizado text,
  origem_tipo text not null default 'explicita_wvetro',
  confianca numeric(5,4) not null default 1.0000,
  evidencia text,
  status_mapeamento text not null default 'referencia',
  dados_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_ref_variaveis_origem_check check (origem_tipo in ('explicita_wvetro','regra_atlas','manual_revisao')),
  constraint wvetro_ref_variaveis_status_check check (status_mapeamento in ('referencia','mapeada_exata','validada_atlas','descartada')),
  constraint wvetro_ref_variaveis_confianca_check check (confianca >= 0 and confianca <= 1)
);
create unique index if not exists uq_wvetro_ref_variaveis_identidade on public.wvetro_referencias_variaveis (referencia_tipologia_id,variavel_chave_raw,coalesce(valor_normalizado,''),origem_tipo);
create index if not exists idx_wvetro_ref_variaveis_tipologia on public.wvetro_referencias_variaveis(tipologia_atlas_id);
create index if not exists idx_wvetro_ref_variaveis_variavel on public.wvetro_referencias_variaveis(variavel_atlas_id);
alter table public.wvetro_referencias_variaveis enable row level security;
revoke all on public.wvetro_referencias_variaveis from anon, authenticated;
grant all on public.wvetro_referencias_variaveis to service_role;

create or replace function public.fn_wvetro_reconstruir_variaveis_explicitas()
returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer := 0;
begin
  insert into public.wvetro_referencias_variaveis (referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at)
  select r.id,r.tipologia_atlas_id,v.id,'folhas','Número de folhas',m.folhas,m.folhas,'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,case when v.id is not null then 'mapeada_exata' else 'referencia' end,jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r
  cross join lateral (select (regexp_match(r.modelo_raw,'([0-9]{1,2})[[:space:]]*folhas?','i'))[1] as folhas) m
  left join public.engenharia_variaveis v on v.chave='folhas'
  where nullif(m.folhas,'') is not null on conflict do nothing;
  get diagnostics v_count = row_count;

  insert into public.engenharia_variavel_opcoes (variavel_id,chave,label,ordem)
  select v.id,x.valor,x.valor||case when x.valor='1' then ' folha' else ' folhas' end,10+x.valor::integer
  from public.engenharia_variaveis v
  join (select distinct valor_normalizado valor from public.wvetro_referencias_variaveis where variavel_chave_raw='folhas' and valor_normalizado ~ '^[0-9]{1,2}$') x on true
  where v.chave='folhas' and not exists (select 1 from public.engenharia_variavel_opcoes o where o.variavel_id=v.id and o.chave=x.valor);

  insert into public.wvetro_referencias_variaveis (referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at)
  select r.id,r.tipologia_atlas_id,v.id,'montagem','Montagem',m.valor,m.valor,'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,case when v.id is not null then 'mapeada_exata' else 'referencia' end,jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r
  cross join lateral (select case when lower(r.modelo_raw) like '%abertura central%' then 'abertura_central' when lower(r.modelo_raw) ~ 'fixa.*m[oó]vel|m[oó]vel.*fixa' then 'fixa_movel' when lower(r.modelo_raw) ~ 'todas m[oó]veis' then 'todas_moveis' when lower(r.modelo_raw) like '%sequencial%' then 'sequencial' when lower(r.modelo_raw) like '%canto%' then 'canto' else null end valor) m
  left join public.engenharia_variaveis v on v.chave='montagem'
  where m.valor is not null on conflict do nothing;

  insert into public.engenharia_variavel_opcoes (variavel_id,chave,label,ordem)
  select v.id,x.chave,x.label,x.ordem from public.engenharia_variaveis v cross join (values ('abertura_central','Abertura central',3),('sequencial','Sequencial',4),('canto','Canto',5)) x(chave,label,ordem)
  where v.chave='montagem' and not exists (select 1 from public.engenharia_variavel_opcoes o where o.variavel_id=v.id and o.chave=x.chave);

  insert into public.wvetro_referencias_variaveis (referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at)
  select r.id,r.tipologia_atlas_id,v.id,'trilho','Trilho',m.valor,m.valor,'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,case when v.id is not null then 'mapeada_exata' else 'referencia' end,jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r cross join lateral (select case when lower(r.modelo_raw) ~ 'macarr[aã]o|embutir|embutido' then 'embutir' when lower(r.modelo_raw) like '%convencional%' then 'convencional' else null end valor) m left join public.engenharia_variaveis v on v.chave='trilho' where m.valor is not null on conflict do nothing;

  insert into public.wvetro_referencias_variaveis (referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at)
  select r.id,r.tipologia_atlas_id,v.id,x.chave,v.label,x.valor,x.valor,'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,case when v.id is not null then 'mapeada_exata' else 'referencia' end,jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r cross join lateral (values
    ('contramarco',case when lower(r.modelo_raw) like '%sem contramarco%' then 'nao' when lower(r.modelo_raw) like '%com contramarco%' then 'sim' else null end),
    ('arremate',case when lower(r.modelo_raw) like '%sem arremate%' then 'sem' when lower(r.modelo_raw) like '%arremate face interna%' then 'face_interna' else null end),
    ('fechadura',case when lower(r.modelo_raw) like '%sem fechadura%' then 'nao' when lower(r.modelo_raw) like '%com fechadura%' then 'sim' else null end),
    ('puxador',case when lower(r.modelo_raw) like '%sem puxador%' then 'nao' when lower(r.modelo_raw) like '%com puxador%' then 'sim' else null end)
  ) x(chave,valor) left join public.engenharia_variaveis v on v.chave=x.chave where x.valor is not null on conflict do nothing;

  insert into public.wvetro_referencias_variaveis (referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at)
  select r.id,r.tipologia_atlas_id,v.id,x.chave,v.label,x.valor,x.valor,'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,case when v.id is not null then 'mapeada_exata' else 'referencia' end,jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r cross join lateral (values
    ('mao_amiga',case when lower(r.modelo_raw) ~ 'm[aã]o amiga larga' then 'largo' when lower(r.modelo_raw) ~ 'm[aã]o amiga' then 'comum' else null end),
    ('reforco',case when lower(r.modelo_raw) ~ 'refor[cç]o interno' then 'interno' when lower(r.modelo_raw) ~ 'refor[cç]o externo' then 'externo' when lower(r.modelo_raw) ~ 'sem refor[cç]o' then 'sem' else null end),
    ('roldana',case when lower(r.modelo_raw) ~ '200[[:space:]]*kg' then '200kg' when lower(r.modelo_raw) ~ '100[[:space:]]*kg' then '100kg' else null end)
  ) x(chave,valor) left join public.engenharia_variaveis v on v.chave=x.chave where x.valor is not null on conflict do nothing;

  return v_count;
end; $$;
revoke execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() from public, anon, authenticated;
grant execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() to service_role;
select public.fn_wvetro_reconstruir_variaveis_explicitas();