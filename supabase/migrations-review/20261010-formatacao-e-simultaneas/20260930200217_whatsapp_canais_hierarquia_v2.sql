-- Canais WhatsApp criados por nome/hierarquia. O numero e descoberto no pareamento QR.

alter table public.atendimento_whatsapp_canais
  alter column numero_declarado drop not null;

alter table public.atendimento_whatsapp_canais
  add column if not exists nivel_hierarquia integer not null default 100,
  add column if not exists criado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists criado_por_nome text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='atendimento_whatsapp_canais_hierarquia_check'
      and conrelid='public.atendimento_whatsapp_canais'::regclass
  ) then
    alter table public.atendimento_whatsapp_canais
      add constraint atendimento_whatsapp_canais_hierarquia_check
      check (nivel_hierarquia >= 0);
  end if;
end $$;

update public.atendimento_whatsapp_canais
set nivel_hierarquia = case when principal then 0 else greatest(nivel_hierarquia, 1) end;

comment on column public.atendimento_whatsapp_canais.nivel_hierarquia is
  'Nivel definido por quem cria o QR. 0 reservado ao canal principal; valores maiores representam niveis subordinados.';
comment on column public.atendimento_whatsapp_canais.numero_declarado is
  'Numero esperado/confirmado do canal. Pode iniciar nulo e ser preenchido automaticamente apos o pareamento QR.';
