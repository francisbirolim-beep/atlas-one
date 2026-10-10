update public.orcamentos
set kanban_entrada_em = coalesce(created_at, kanban_entrada_em, now())
where coalesce(modo_entrada, 'formulario') <> 'balcao'
  and created_at is not null
  and kanban_entrada_em is distinct from created_at;
