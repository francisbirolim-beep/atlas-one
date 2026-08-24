-- Referências de variáveis obtidas do W.Vetro sem promover dados para a receita oficial Atlas.
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

create unique index if not exists uq_wvetro_ref_variaveis_identidade
  on public.wvetro_referencias_variaveis (referencia_tipologia_id,variavel_chave_raw,coalesce(valor_normalizado,''),origem_tipo);
create index if not exists idx_wvetro_ref_variaveis_tipologia on public.wvetro_referencias_variaveis(tipologia_atlas_id);
create index if not exists idx_wvetro_ref_variaveis_variavel on public.wvetro_referencias_variaveis(variavel_atlas_id);

alter table public.wvetro_referencias_variaveis enable row level security;
revoke all on public.wvetro_referencias_variaveis from anon, authenticated;
grant all on public.wvetro_referencias_variaveis to service_role;

-- Versão inicial: extrai número de folhas quando está escrito no Modelo W.Vetro.
-- A migration seguinte normaliza zeros à esquerda e amplia os termos explícitos.
create or replace function public.fn_wvetro_reconstruir_variaveis_explicitas()
returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer := 0;
begin
  insert into public.wvetro_referencias_variaveis (
    referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,
    variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,
    origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at
  )
  select r.id,r.tipologia_atlas_id,v.id,'folhas','Número de folhas',m.folhas,m.folhas,
         'explicita_wvetro',1.0000,'Modelo W.Vetro: '||r.modelo_raw,
         case when v.id is not null then 'mapeada_exata' else 'referencia' end,
         jsonb_build_object('campo','Modelo','linha',r.linha_raw,'modelo',r.modelo_raw),now()
  from public.wvetro_referencias_tipologias r
  cross join lateral (select (regexp_match(r.modelo_raw,'([0-9]{1,2})[[:space:]]*folhas?','i'))[1] as folhas) m
  left join public.engenharia_variaveis v on v.chave='folhas'
  where nullif(m.folhas,'') is not null
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

revoke execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() from public, anon, authenticated;
grant execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() to service_role;
select public.fn_wvetro_reconstruir_variaveis_explicitas();
