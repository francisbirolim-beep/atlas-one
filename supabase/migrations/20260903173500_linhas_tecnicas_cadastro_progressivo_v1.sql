alter table public.linhas_tecnicas
  add column if not exists etapa_cadastro text,
  add column if not exists validada_em timestamptz,
  add column if not exists validada_por_id uuid,
  add column if not exists validada_por_nome text;

update public.linhas_tecnicas
set etapa_cadastro = coalesce(
  etapa_cadastro,
  case when status_validacao = 'validada' then 'revisao' else 'dados_linha' end
)
where etapa_cadastro is null;

alter table public.linhas_tecnicas
  alter column etapa_cadastro set default 'dados_linha',
  alter column etapa_cadastro set not null;

alter table public.linhas_tecnicas
  drop constraint if exists linhas_tecnicas_etapa_cadastro_check;
alter table public.linhas_tecnicas
  add constraint linhas_tecnicas_etapa_cadastro_check
  check (etapa_cadastro in ('dados_linha', 'perfis', 'acessorios', 'tipologias', 'formulacoes', 'revisao'));

comment on column public.linhas_tecnicas.etapa_cadastro is 'Última etapa salva do cadastro técnico progressivo da linha.';
