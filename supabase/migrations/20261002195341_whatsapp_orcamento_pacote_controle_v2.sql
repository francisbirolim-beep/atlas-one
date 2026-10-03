alter table public.atendimento_whatsapp_intakes
  add column if not exists fechamento_pausado boolean not null default false,
  add column if not exists fechado_em timestamptz,
  add column if not exists gatilho_fechamento text;

alter table public.atendimento_whatsapp_intakes
  drop constraint if exists atendimento_whatsapp_intakes_gatilho_fechamento_check;

alter table public.atendimento_whatsapp_intakes
  add constraint atendimento_whatsapp_intakes_gatilho_fechamento_check
  check (gatilho_fechamento is null or gatilho_fechamento in ('silencio', 'pronto'));

create index if not exists atendimento_whatsapp_intakes_fechamento_idx
  on public.atendimento_whatsapp_intakes (
    empresa_id, status, fechamento_pausado, ultima_mensagem_em desc
  );
