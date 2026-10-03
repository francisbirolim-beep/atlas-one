-- Limpa a caixa do WhatsApp: Status/Stories não viram atendimento.
-- Adiciona catálogo sincronizado de contatos por canal.
alter table public.atendimento_conversas
  add column if not exists ocultar_da_caixa boolean not null default false;

create index if not exists atendimento_conversas_caixa_idx
  on public.atendimento_conversas (empresa_id, ocultar_da_caixa, ultima_mensagem_em desc);

-- Esconde somente conversas compostas exclusivamente por Status.
update public.atendimento_conversas c
set ocultar_da_caixa = true,
    updated_at = now()
where c.canal = 'whatsapp'
  and exists (
    select 1
    from public.atendimento_mensagens m
    where m.conversa_id = c.id
      and m.payload->>'remoteJid' = 'status@broadcast'
  )
  and not exists (
    select 1
    from public.atendimento_mensagens m
    where m.conversa_id = c.id
      and (
        m.direcao = 'saida'
        or coalesce(m.payload->>'remoteJid','') <> 'status@broadcast'
      )
  );

create table if not exists public.atendimento_whatsapp_contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  whatsapp_canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  contato_jid text not null,
  telefone text,
  nome text,
  nome_verificado text,
  ativo boolean not null default true,
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, whatsapp_canal_id, contato_jid)
);

create index if not exists atendimento_whatsapp_contatos_canal_idx
  on public.atendimento_whatsapp_contatos (empresa_id, whatsapp_canal_id, ativo, nome);

alter table public.atendimento_whatsapp_contatos enable row level security;
revoke all on public.atendimento_whatsapp_contatos from authenticated;
grant select on public.atendimento_whatsapp_contatos to authenticated;

drop policy if exists atendimento_whatsapp_contatos_select_v1 on public.atendimento_whatsapp_contatos;
create policy atendimento_whatsapp_contatos_select_v1
on public.atendimento_whatsapp_contatos for select to authenticated
using (empresa_id = (select private.current_empresa_id()));

comment on table public.atendimento_whatsapp_contatos is
  'Contatos sincronizados dos numeros WhatsApp conectados. Status/Stories nunca entram nesta tabela.';
