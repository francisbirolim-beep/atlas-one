-- Aditivo: NULL preserva o acesso anterior. Não modifica nenhuma permissão de canal.
begin;
set local lock_timeout='1s';
set local statement_timeout='10s';
alter table public.atlas_chat_acessos add column central_habilitado boolean;
commit;
