alter table public.wvetro_produtos_snapshot
  add column if not exists imagem_atlas_url text,
  add column if not exists imagem_status text not null default 'pendente',
  add column if not exists imagem_erro text;

alter table public.wvetro_produtos_snapshot
  drop constraint if exists wvetro_produtos_snapshot_imagem_status_check;
alter table public.wvetro_produtos_snapshot
  add constraint wvetro_produtos_snapshot_imagem_status_check
  check (imagem_status in ('pendente','sem_imagem','copiada','preservada_atlas','erro'));
