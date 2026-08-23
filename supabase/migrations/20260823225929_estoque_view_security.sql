-- A visão de disponibilidade deve respeitar os privilégios de quem consulta.
alter view public.estoque_disponibilidade_rede set (security_invoker = true);
