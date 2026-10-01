create index if not exists atendimento_configuracoes_usuario_padrao_idx
  on public.atendimento_configuracoes (usuario_padrao_id);
create index if not exists atendimento_conversas_cliente_idx
  on public.atendimento_conversas (cliente_id);
create index if not exists atendimento_conversas_responsavel_idx
  on public.atendimento_conversas (responsavel_id);
create index if not exists atendimento_eventos_conversa_created_idx
  on public.atendimento_eventos (conversa_id, created_at);
create index if not exists atendimento_eventos_empresa_idx
  on public.atendimento_eventos (empresa_id);
create index if not exists atendimento_eventos_usuario_idx
  on public.atendimento_eventos (usuario_id);
create index if not exists atendimento_mensagens_sessao_idx
  on public.atendimento_mensagens (sessao_id);
create index if not exists atendimento_mensagens_usuario_idx
  on public.atendimento_mensagens (usuario_id);
create index if not exists atendimento_regras_usuario_idx
  on public.atendimento_regras_roteamento (usuario_id);
create index if not exists atendimento_sessoes_empresa_idx
  on public.atendimento_sessoes (empresa_id);
create index if not exists atendimento_sessoes_responsavel_idx
  on public.atendimento_sessoes (responsavel_id);
