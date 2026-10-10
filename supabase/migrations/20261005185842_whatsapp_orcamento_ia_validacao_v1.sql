-- Atlas One — revisão humana do orçamento criado pela IA do WhatsApp
alter table public.orcamentos
  add column if not exists ia_criado boolean not null default false,
  add column if not exists ia_validacao_status text,
  add column if not exists ia_resultado_original jsonb,
  add column if not exists ia_fontes jsonb,
  add column if not exists ia_validado_por_id uuid,
  add column if not exists ia_validado_por_nome text,
  add column if not exists ia_validado_em timestamptz,
  add column if not exists ia_correcao jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orcamentos_ia_validacao_status_chk'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_ia_validacao_status_chk
      check (ia_validacao_status is null or ia_validacao_status in ('aguardando','validado','corrigido'));
  end if;
end $$;

create table if not exists public.ai_orcamento_feedback (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  intake_id uuid references public.atendimento_whatsapp_intakes(id) on delete set null,
  avaliacao text not null check (avaliacao in ('validado','corrigido')),
  resultado_original jsonb,
  resultado_final jsonb,
  diferencas jsonb,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);

create index if not exists ai_orcamento_feedback_empresa_created_idx
  on public.ai_orcamento_feedback (empresa_id, created_at desc);
create index if not exists ai_orcamento_feedback_orcamento_idx
  on public.ai_orcamento_feedback (orcamento_id);

alter table public.ai_orcamento_feedback enable row level security;

drop policy if exists ai_orcamento_feedback_select on public.ai_orcamento_feedback;
create policy ai_orcamento_feedback_select on public.ai_orcamento_feedback
for select to authenticated using (empresa_id = private.current_empresa_id());

comment on table public.ai_orcamento_feedback is
'Feedback supervisionado dos orçamentos montados pela IA do WhatsApp. Correções humanas são usadas como exemplos nas próximas leituras.';
