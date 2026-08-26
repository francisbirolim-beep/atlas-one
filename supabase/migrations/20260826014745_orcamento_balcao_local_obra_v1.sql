alter table public.orcamentos
  add column if not exists obra_endereco text,
  add column if not exists obra_numero text,
  add column if not exists obra_complemento text,
  add column if not exists obra_bairro text,
  add column if not exists obra_cidade text,
  add column if not exists obra_uf text,
  add column if not exists obra_cep text;

comment on column public.orcamentos.obra_endereco is 'Logradouro do local da obra/entrega, separado do endereço cadastral do cliente.';
comment on column public.orcamentos.obra_cidade is 'Cidade do local da obra/entrega.';
