-- Hardening: this function is invoked only by the existing trigger clientes_pendencia_nome_trg.
-- Remove direct API execution without changing trigger behavior.
revoke all on function public.sincronizar_pendencia_nome_cliente() from public;
revoke all on function public.sincronizar_pendencia_nome_cliente() from anon;
revoke all on function public.sincronizar_pendencia_nome_cliente() from authenticated;
