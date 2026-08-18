-- Configuracoes validadas para Orcamento Rapido/Assistido.
--
-- Reaproveita engenharia_variaveis_preset como fonte unica das combinacoes de
-- variaveis. Presets antigos NAO ficam automaticamente disponiveis no orcamento:
-- precisam ser publicados e validados explicitamente por um responsavel.

begin;

alter table public.engenharia_variaveis_preset
  add column if not exists usar_no_orcamento boolean not null default false,
  add column if not exists validado boolean not null default false,
  add column if not exists validado_em timestamptz,
  add column if not exists validado_por_id uuid,
  add column if not exists validado_por_nome text,
  add column if not exists evidencia_validacao text,
  add column if not exists ativo boolean not null default true;

create index if not exists engenharia_variaveis_preset_orcamento_idx
  on public.engenharia_variaveis_preset(
    usar_no_orcamento,
    validado,
    ativo,
    tipologia_id,
    produto_id
  );

-- Uma configuracao declarada como validada precisa deixar trilha minima de
-- validacao. Nao exigimos validado_por_id porque usuarios legados podem nao ter
-- UUID disponivel em futuras importacoes, mas nome/data/evidencia sao obrigatorios.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'engenharia_preset_validacao_coerente_chk'
      and conrelid = 'public.engenharia_variaveis_preset'::regclass
  ) then
    alter table public.engenharia_variaveis_preset
      add constraint engenharia_preset_validacao_coerente_chk
      check (
        validado = false
        or (
          validado_em is not null
          and nullif(trim(coalesce(validado_por_nome, '')), '') is not null
          and nullif(trim(coalesce(evidencia_validacao, '')), '') is not null
        )
      );
  end if;
end $$;

comment on column public.engenharia_variaveis_preset.usar_no_orcamento is
  'Quando true, o preset pode ser publicado como modelo comercial no Orcamento; ainda exige validado=true.';
comment on column public.engenharia_variaveis_preset.validado is
  'Confirma que a combinacao de variaveis foi revisada tecnicamente para uso como configuracao pronta.';
comment on column public.engenharia_variaveis_preset.evidencia_validacao is
  'Fonte/evidencia usada na validacao da configuracao pronta (relatorio, catalogo, conferencia tecnica etc.).';

commit;
