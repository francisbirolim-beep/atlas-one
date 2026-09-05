revoke execute on function public.is_dono_evento(uuid) from public;
revoke execute on function public.is_convidado_evento(uuid) from public;
grant execute on function public.is_dono_evento(uuid) to authenticated, service_role;
grant execute on function public.is_convidado_evento(uuid) to authenticated, service_role;
