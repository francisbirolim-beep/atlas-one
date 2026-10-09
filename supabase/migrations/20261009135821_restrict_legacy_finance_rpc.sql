-- Legacy RPC is no longer used by the current Atlas finance flow.
-- Keep it available to privileged server roles only.
revoke all on function public.registrar_recebimento_venda_com_desconto(
  uuid, uuid, numeric, numeric, date, text, text, text, uuid, text
) from public;
revoke all on function public.registrar_recebimento_venda_com_desconto(
  uuid, uuid, numeric, numeric, date, text, text, text, uuid, text
) from anon;
revoke all on function public.registrar_recebimento_venda_com_desconto(
  uuid, uuid, numeric, numeric, date, text, text, text, uuid, text
) from authenticated;
