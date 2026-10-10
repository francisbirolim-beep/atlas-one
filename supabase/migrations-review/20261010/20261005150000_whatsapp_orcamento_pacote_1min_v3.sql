-- Consolidação do grupo de orçamento: um card por pacote, fechamento por silêncio ou "pronto".
alter table public.atendimento_whatsapp_grupo_automacoes
  alter column janela_agregacao_minutos set default 1;

alter table public.atendimento_whatsapp_intakes
  add column if not exists ai_status text not null default 'pendente',
  add column if not exists ai_session_id text,
  add column if not exists ai_resultado jsonb,
  add column if not exists ai_erro text,
  add column if not exists ai_processado_em timestamptz,
  add column if not exists fechamento_pausado boolean not null default false,
  add column if not exists fechado_em timestamptz,
  add column if not exists gatilho_fechamento text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.atendimento_whatsapp_intakes'::regclass
      and conname = 'atendimento_whatsapp_intakes_ai_status_check'
  ) then
    alter table public.atendimento_whatsapp_intakes
      add constraint atendimento_whatsapp_intakes_ai_status_check
      check (ai_status in ('pendente','processando','concluido','erro'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.atendimento_whatsapp_intakes'::regclass
      and conname = 'atendimento_whatsapp_intakes_gatilho_fechamento_check'
  ) then
    alter table public.atendimento_whatsapp_intakes
      add constraint atendimento_whatsapp_intakes_gatilho_fechamento_check
      check (gatilho_fechamento is null or gatilho_fechamento in ('silencio','pronto'));
  end if;
end $$;

create index if not exists atendimento_whatsapp_intakes_fechamento_idx
  on public.atendimento_whatsapp_intakes (empresa_id, status, fechado_em, ultima_mensagem_em)
  where status = 'aberto';
