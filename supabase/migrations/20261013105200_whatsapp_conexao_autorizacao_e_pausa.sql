-- Controle explicitamente delegado pelo Master, separado do acesso às conversas.
ALTER TABLE public.atendimento_whatsapp_permissoes
  ADD COLUMN IF NOT EXISTS pode_gerenciar_conexao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.atendimento_whatsapp_permissoes.pode_gerenciar_conexao
  IS 'Somente Master ou usuario explicitamente delegado pode iniciar e pausar a conexao do numero.';

-- Pausa persistente: não confundir perda de sinal com desconexão manual.
-- Credenciais de pareamento e histórico permanecem fora deste campo.
ALTER TABLE public.atendimento_whatsapp_canais
  ADD COLUMN IF NOT EXISTS conexao_pausada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.atendimento_whatsapp_canais.conexao_pausada
  IS 'Quando true, gateway nao reconecta ate comando autenticado de retomar.';
