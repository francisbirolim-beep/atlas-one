-- Comando de reconexão durável por canal: o serviço consome a data/hora.
-- Não muda a sessão, o número conectado nem as mensagens.
ALTER TABLE public.atendimento_whatsapp_canais
  ADD COLUMN IF NOT EXISTS gateway_reconnect_requested_at timestamptz;

COMMENT ON COLUMN public.atendimento_whatsapp_canais.gateway_reconnect_requested_at
  IS 'Horário do último pedido autenticado de reconexão. O gateway reinicia o socket sem limpar a sessão.';
