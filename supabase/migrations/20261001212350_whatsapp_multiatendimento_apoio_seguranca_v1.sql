create index if not exists atendimento_etiquetas_empresa_idx
  on public.atendimento_etiquetas (empresa_id, ativo, nome);
create index if not exists atendimento_conversa_etiquetas_empresa_conversa_idx
  on public.atendimento_conversa_etiquetas (empresa_id, conversa_id);
create index if not exists atendimento_notas_empresa_conversa_idx
  on public.atendimento_notas (empresa_id, conversa_id, created_at desc);
create index if not exists atendimento_mensagens_rapidas_empresa_idx
  on public.atendimento_mensagens_rapidas (empresa_id, ativo, titulo);

alter table public.atendimento_etiquetas enable row level security;
alter table public.atendimento_conversa_etiquetas enable row level security;
alter table public.atendimento_notas enable row level security;
alter table public.atendimento_mensagens_rapidas enable row level security;

revoke all on public.atendimento_etiquetas from anon, authenticated;
revoke all on public.atendimento_conversa_etiquetas from anon, authenticated;
revoke all on public.atendimento_notas from anon, authenticated;
revoke all on public.atendimento_mensagens_rapidas from anon, authenticated;
