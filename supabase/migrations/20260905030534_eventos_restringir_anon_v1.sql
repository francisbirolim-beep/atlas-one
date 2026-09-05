revoke all on table public.eventos from anon;
revoke all on table public.evento_convidados from anon;
revoke execute on function public.is_dono_evento(uuid) from anon;
revoke execute on function public.is_convidado_evento(uuid) from anon;

alter policy eventos_select on public.eventos to authenticated;
alter policy eventos_insert on public.eventos to authenticated;
alter policy eventos_update on public.eventos to authenticated;
alter policy eventos_delete on public.eventos to authenticated;

alter policy evento_convidados_select on public.evento_convidados to authenticated;
alter policy evento_convidados_insert on public.evento_convidados to authenticated;
alter policy evento_convidados_update on public.evento_convidados to authenticated;
alter policy evento_convidados_delete on public.evento_convidados to authenticated;
