-- Custo de pintura: distingue aluminio natural de pintado.
-- O preco do Kg do aluminio natural continua em configuracoes_precificacao (chave preco_kg_aluminio).
-- Este arquivo adiciona a flag por cor e a chave para o custo adicional de pintura.

alter table public.cores add column if not exists pintura boolean not null default false;

comment on column public.cores.pintura is 'Quando true, o custo do Kg do aluminio dessa cor soma o adicional de pintura (configuracoes_precificacao.custo_pintura_kg).';

insert into public.configuracoes_precificacao (chave, valor)
values ('custo_pintura_kg', 0)
on conflict (chave) do nothing;
