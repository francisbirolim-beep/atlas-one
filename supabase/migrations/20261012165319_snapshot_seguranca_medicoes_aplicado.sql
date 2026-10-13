-- Snapshot restrito de segurança pré-publicação, sem modificar registros existentes.
create table if not exists private.atlas_backup_20261012_medicoes_finais as
  select * from public.medicoes_finais;
create table if not exists private.atlas_backup_20261012_medicao_itens as
  select * from public.medicao_itens;
create table if not exists private.atlas_backup_20261012_pacotes_tecnicos as
  select * from public.pacotes_tecnicos;
create table if not exists private.atlas_backup_20261012_pacote_tecnico_materiais as
  select * from public.pacote_tecnico_materiais;
revoke all on private.atlas_backup_20261012_medicoes_finais,
  private.atlas_backup_20261012_medicao_itens,
  private.atlas_backup_20261012_pacotes_tecnicos,
  private.atlas_backup_20261012_pacote_tecnico_materiais
from public, anon, authenticated;
comment on table private.atlas_backup_20261012_pacote_tecnico_materiais is
  'Snapshot anterior ao lançamento de Separação de Materiais; acesso administrativo restrito.';
