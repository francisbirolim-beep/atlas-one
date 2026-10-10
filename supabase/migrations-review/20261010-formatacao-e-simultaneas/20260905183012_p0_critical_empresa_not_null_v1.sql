alter table public.usuarios alter column empresa_id set not null;
alter table public.assistencias alter column empresa_id set not null;
alter table public.balcao_pagamentos alter column empresa_id set not null;
alter table public.ordens_producao alter column empresa_id set not null;
alter table public.pacotes_tecnicos alter column empresa_id set not null;
