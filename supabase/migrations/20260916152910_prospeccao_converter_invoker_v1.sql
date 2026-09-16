-- A conversão permanece transacional, mas executa com os privilégios do
-- usuário autenticado. RLS e grants continuam valendo para prospecções,
-- clientes, obras e diário, evitando bypass desnecessário.
alter function public.fn_converter_prospeccao_v1(uuid,uuid,boolean) security invoker;
