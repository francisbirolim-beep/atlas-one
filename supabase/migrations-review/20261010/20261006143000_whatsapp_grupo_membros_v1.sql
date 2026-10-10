alter table public.atendimento_whatsapp_grupos
  add column if not exists membros jsonb not null default '[]'::jsonb;

comment on column public.atendimento_whatsapp_grupos.membros is
  'Snapshot dos membros sincronizados do grupo WhatsApp: jid, telefone, nome quando disponivel e papel/admin.';
