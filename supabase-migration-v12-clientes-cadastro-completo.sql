-- Cadastro completo do cliente: campos que faltavam para completar o
-- cadastro no momento da venda (endereco da obra ja existia, mas faltava
-- bairro, cep, email, telefone e usar data_nascimento).
-- Idempotente: pode rodar de novo sem erro.

alter table clientes
  add column if not exists bairro text,
  add column if not exists cep text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists data_nascimento date;
