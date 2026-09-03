alter table public.linhas
  add column if not exists status_cadastro text,
  add column if not exists etapa_cadastro text,
  add column if not exists validada_em timestamptz,
  add column if not exists validada_por_id uuid,
  add column if not exists validada_por_nome text;

update public.linhas
set
  status_cadastro = coalesce(status_cadastro, 'validada'),
  etapa_cadastro = coalesce(etapa_cadastro, 'revisao'),
  validada_em = coalesce(validada_em, updated_at, created_at)
where status_cadastro is null
   or etapa_cadastro is null
   or (ativo = true and validada_em is null);

alter table public.linhas
  alter column status_cadastro set default 'rascunho',
  alter column status_cadastro set not null,
  alter column etapa_cadastro set default 'dados_linha',
  alter column etapa_cadastro set not null;

alter table public.linhas
  drop constraint if exists linhas_status_cadastro_check;
alter table public.linhas
  add constraint linhas_status_cadastro_check
  check (status_cadastro in ('rascunho', 'em_revisao', 'validada'));

alter table public.linhas
  drop constraint if exists linhas_etapa_cadastro_check;
alter table public.linhas
  add constraint linhas_etapa_cadastro_check
  check (etapa_cadastro in ('dados_linha', 'perfis', 'acessorios', 'tipologias', 'formulacoes', 'revisao'));

comment on column public.linhas.status_cadastro is 'Fluxo progressivo do cadastro: rascunho, em_revisao ou validada.';
comment on column public.linhas.etapa_cadastro is 'Última etapa salva do cadastro progressivo da linha.';
