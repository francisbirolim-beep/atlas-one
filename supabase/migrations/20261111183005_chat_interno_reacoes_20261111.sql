-- Reações nas mensagens da Equipe interna.
-- Estrutura aditiva: não altera chat_mensagens nem o fluxo de envio existente.
-- Acesso exclusivo pelas rotas do servidor, que validam usuário, empresa e participação.
create table if not exists public.chat_mensagem_reacoes (
  mensagem_id uuid not null references public.chat_mensagens(id) on delete cascade,
  usuario_id uuid not null,
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  empresa_id uuid not null,
  usuario_nome text not null check (length(usuario_nome) between 1 and 200),
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mensagem_id, usuario_id)
);

create index if not exists chat_mensagem_reacoes_conversa_idx
  on public.chat_mensagem_reacoes (empresa_id, conversa_id, created_at);

alter table public.chat_mensagem_reacoes enable row level security;
revoke all on public.chat_mensagem_reacoes from public, anon, authenticated;
grant select, insert, update, delete on public.chat_mensagem_reacoes to service_role;

comment on table public.chat_mensagem_reacoes is
  'Reações da equipe interna, restritas a API autenticada e verificações de participação e empresa.';
