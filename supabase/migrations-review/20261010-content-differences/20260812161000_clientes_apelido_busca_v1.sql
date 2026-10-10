alter table public.clientes
  add column if not exists apelido text;

comment on column public.clientes.apelido is
  'Nome pelo qual o cliente e conhecido, usado para identificacao e busca rapida.';
