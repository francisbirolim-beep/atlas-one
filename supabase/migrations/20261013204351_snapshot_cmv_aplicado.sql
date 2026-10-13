CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.atlas_backup_20261013_cmv_lancamentos AS SELECT * FROM public.venda_cmv_lancamentos;
REVOKE ALL ON private.atlas_backup_20261013_cmv_lancamentos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;