ALTER TABLE public.atendimento_whatsapp_canais
ADD COLUMN IF NOT EXISTS gateway_reconnect_requested_at timestamptz;
COMMENT ON COLUMN public.atendimento_whatsapp_canais.gateway_reconnect_requested_at IS
'Solicitacao autenticada para o gateway reiniciar conexao sem remover credenciais ou historico; consumida por timestamp.';