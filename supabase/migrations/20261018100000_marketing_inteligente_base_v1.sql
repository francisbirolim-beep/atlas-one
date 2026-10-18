-- Candidato de HOMOLOGAÇÃO: não executar no banco de produção sem autorização.
-- Marketing Inteligente v1: apenas rascunhos/aprovações; não publica redes.
begin;

create table if not exists public.marketing_midias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid null references public.obras(id),
  nome text not null check(length(btrim(nome)) between 1 and 240),
  tipo_mime text not null check(tipo_mime in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm')),
  tamanho_bytes bigint not null check(tamanho_bytes between 1 and 31457280),
  storage_path text not null unique check(length(storage_path) between 15 and 500),
  hash_sha256 text null check(hash_sha256 ~ '^[a-f0-9]{64}$'),
  versao integer not null default 1 check(versao > 0),
  direitos_confirmados boolean not null default false,
  evidencia_autorizacao text null check(length(evidencia_autorizacao) <= 2000),
  autorizado_por_id uuid null references public.usuarios(id),
  autorizado_em timestamptz null,
  criado_por_id uuid not null references public.usuarios(id),
  alterado_por_id uuid not null references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(empresa_id,id),
  constraint marketing_midia_direitos_coerentes check (
    (direitos_confirmados = false and autorizado_em is null and autorizado_por_id is null)
    or
    (direitos_confirmados = true and autorizado_em is not null and autorizado_por_id is not null and nullif(btrim(evidencia_autorizacao),'') is not null)
  )
);
create index if not exists marketing_midias_empresa_criado_idx on public.marketing_midias(empresa_id,criado_em desc);

create table if not exists public.marketing_uploads_pendentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  usuario_id uuid not null references public.usuarios(id),
  obra_id uuid null references public.obras(id),
  nome text not null check(length(btrim(nome)) between 1 and 240),
  tipo_mime text not null check(tipo_mime in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm')),
  tamanho_bytes bigint not null check(tamanho_bytes between 12 and 31457280),
  storage_path text not null unique check(length(storage_path) between 15 and 500),
  status text not null default 'pendente' check(status in ('pendente','confirmado')),
  expira_em timestamptz not null default (now()+interval '30 minutes'),
  criado_em timestamptz not null default now()
);
create index if not exists marketing_uploads_pendentes_empresa_idx
 on public.marketing_uploads_pendentes(empresa_id,usuario_id,status,expira_em);
alter table public.marketing_midias
  add column if not exists upload_id uuid unique references public.marketing_uploads_pendentes(id);

create or replace function public.marketing_verificar_upload_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.usuarios u where u.id=new.usuario_id and u.empresa_id=new.empresa_id)
 then raise exception 'Usuário de upload fora da empresa';end if;
 if new.obra_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.empresa_id=new.empresa_id)
 then raise exception 'Obra de upload fora da empresa';end if;
 if new.storage_path not like new.empresa_id::text||'/%'
 then raise exception 'Caminho de upload fora da empresa';end if;
 if tg_op='UPDATE' then
  if (new.empresa_id,new.usuario_id,new.obra_id,new.storage_path,new.nome,new.tipo_mime,new.tamanho_bytes)
     is distinct from
     (old.empresa_id,old.usuario_id,old.obra_id,old.storage_path,old.nome,old.tipo_mime,old.tamanho_bytes)
  then raise exception 'Metadados do upload imutáveis';end if;
 end if;
 return new;
end;$$;
drop trigger if exists marketing_upload_guard on public.marketing_uploads_pendentes;
create trigger marketing_upload_guard before insert or update on public.marketing_uploads_pendentes
for each row execute function public.marketing_verificar_upload_v1();



create table if not exists public.marketing_publicacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  midia_id uuid not null,
  titulo text not null check(length(btrim(titulo)) between 1 and 240),
  legenda text not null default '' check(length(legenda)<=4000),
  canal text not null check(canal in ('instagram','facebook','tiktok','google')),
  data_planejada date not null,
  status text not null default 'rascunho' check(status in ('rascunho','aprovado')),
  revisao integer not null default 1 check(revisao>0),
  aprovado_por_id uuid null references public.usuarios(id),
  aprovado_em timestamptz null,
  criado_por_id uuid not null references public.usuarios(id),
  alterado_por_id uuid not null references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(empresa_id,id),
  foreign key (empresa_id,midia_id) references public.marketing_midias(empresa_id,id) on delete restrict,
  constraint marketing_post_aprovacao_coerente check (
    (status='rascunho' and aprovado_por_id is null and aprovado_em is null)
    or (status='aprovado' and aprovado_por_id is not null and aprovado_em is not null)
  )
);
create index if not exists marketing_posts_empresa_data_idx on public.marketing_publicacoes(empresa_id,data_planejada,id);

create table if not exists public.marketing_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  publicacao_id uuid null,
  midia_id uuid null,
  acao text not null check(length(acao) between 2 and 80),
  autor_id uuid null references public.usuarios(id),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  foreign key (empresa_id,publicacao_id) references public.marketing_publicacoes(empresa_id,id),
  foreign key (empresa_id,midia_id) references public.marketing_midias(empresa_id,id),
  constraint evento_tem_vinculo check(publicacao_id is not null or midia_id is not null)
);
create index if not exists marketing_eventos_empresa_idx on public.marketing_eventos(empresa_id,criado_em desc);

-- Restringe vínculo de obra e autoria à mesma empresa.
create or replace function public.marketing_verificar_midia_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.usuarios u where u.id=new.criado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Criador fora da empresa';end if;
 if not exists(select 1 from public.usuarios u where u.id=new.alterado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Editor fora da empresa';end if;
 if new.obra_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.empresa_id=new.empresa_id)
 then raise exception 'Obra fora da empresa';end if;
 if new.autorizado_por_id is not null and not exists(select 1 from public.usuarios u where u.id=new.autorizado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Autorizador fora da empresa';end if;
 if new.storage_path not like new.empresa_id::text||'/%'
 then raise exception 'Caminho de arquivo fora da empresa';end if;
 if new.upload_id is not null and not exists (
  select 1 from public.marketing_uploads_pendentes p
  where p.id=new.upload_id and p.empresa_id=new.empresa_id
    and p.usuario_id=new.criado_por_id and p.storage_path=new.storage_path
 ) then raise exception 'Upload sem vínculo de origem válido';end if;
 if tg_op='UPDATE' then
  if new.versao <> old.versao+1 then raise exception 'Versão de mídia concorrente inválida';end if;
  if new.empresa_id is distinct from old.empresa_id
     or new.id is distinct from old.id
     or new.storage_path is distinct from old.storage_path
     or new.criado_por_id is distinct from old.criado_por_id
  then raise exception 'Identificadores de mídia imutáveis';end if;
  new.atualizado_em=now();
 end if;
 return new;
end;$$;

create or replace function public.marketing_verificar_publicacao_v1()
returns trigger language plpgsql set search_path='' as $$
declare v_autorizada boolean;
begin
 if not exists(select 1 from public.usuarios u where u.id=new.criado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Criador fora da empresa';end if;
 if not exists(select 1 from public.usuarios u where u.id=new.alterado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Editor fora da empresa';end if;
 if new.aprovado_por_id is not null and not exists(select 1 from public.usuarios u where u.id=new.aprovado_por_id and u.empresa_id=new.empresa_id)
 then raise exception 'Aprovador fora da empresa';end if;
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.empresa_id is distinct from old.empresa_id
  then raise exception 'Vínculo de publicação imutável';end if;
  if new.revisao <> old.revisao+1 then raise exception 'Revisão concorrente inválida';end if;
  if (new.titulo,new.legenda,new.canal,new.data_planejada,new.midia_id)
     is distinct from (old.titulo,old.legenda,old.canal,old.data_planejada,old.midia_id)
     and new.status='aprovado'
  then raise exception 'Edição exige nova aprovação';end if;
  new.atualizado_em=now();
 end if;
 if new.status='aprovado' then
   select direitos_confirmados into v_autorizada from public.marketing_midias
   where id=new.midia_id and empresa_id=new.empresa_id for update;
   if v_autorizada is distinct from true then raise exception 'Mídia sem autorização válida';end if;
 end if;
 return new;
end;$$;

create or replace function public.marketing_reverter_aprovacoes_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.direitos_confirmados=true and new.direitos_confirmados=false then
  update public.marketing_publicacoes
  set status='rascunho',aprovado_por_id=null,aprovado_em=null,alterado_por_id=new.alterado_por_id,
      revisao=revisao+1,atualizado_em=now()
  where empresa_id=new.empresa_id and midia_id=new.id and status='aprovado';
 end if;
 return new;
end;$$;

create or replace function public.marketing_bloquear_eventos_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'Histórico de marketing é imutável';
end;$$;

drop trigger if exists marketing_midia_guard on public.marketing_midias;
create trigger marketing_midia_guard before insert or update on public.marketing_midias
for each row execute function public.marketing_verificar_midia_v1();
drop trigger if exists marketing_midia_reverter on public.marketing_midias;
create trigger marketing_midia_reverter after update of direitos_confirmados on public.marketing_midias
for each row execute function public.marketing_reverter_aprovacoes_v1();
drop trigger if exists marketing_post_guard on public.marketing_publicacoes;
create trigger marketing_post_guard before insert or update on public.marketing_publicacoes
for each row execute function public.marketing_verificar_publicacao_v1();
drop trigger if exists marketing_eventos_immut on public.marketing_eventos;
create trigger marketing_eventos_immut before update or delete on public.marketing_eventos
for each row execute function public.marketing_bloquear_eventos_v1();

-- Eventos invioláveis são gerados no banco na mesma transação das mudanças.
create or replace function public.marketing_registrar_post_v1()
returns trigger language plpgsql set search_path='' as $$
declare v_acao text;
begin
 if tg_op='INSERT' then
  v_acao:='rascunho_criado';
 elsif new.status='aprovado' and old.status is distinct from 'aprovado' then
  v_acao:='publicacao_aprovada';
 elsif old.status='aprovado' and new.status='rascunho' then
  v_acao:='aprovacao_revogada';
 else
  v_acao:='rascunho_editado';
 end if;
 insert into public.marketing_eventos(empresa_id,publicacao_id,midia_id,acao,autor_id,detalhes)
 values(new.empresa_id,new.id,new.midia_id,v_acao,new.alterado_por_id,
   jsonb_build_object('revisao',new.revisao,'status',new.status,'canal',new.canal));
 return new;
end;$$;
create or replace function public.marketing_registrar_midia_v1()
returns trigger language plpgsql set search_path='' as $$
declare v_acao text;
begin
 if tg_op='INSERT' then
  v_acao:='midia_registrada';
 elsif old.direitos_confirmados=true and new.direitos_confirmados=false then
  v_acao:='direitos_revogados';
 elsif new.direitos_confirmados=true and old.direitos_confirmados=false then
  v_acao:='direitos_confirmados';
 else
  v_acao:='midia_atualizada';
 end if;
 insert into public.marketing_eventos(empresa_id,midia_id,acao,autor_id,detalhes)
 values(new.empresa_id,new.id,v_acao,new.alterado_por_id,
 jsonb_build_object('direitos_confirmados',new.direitos_confirmados));
 return new;
end;$$;

drop trigger if exists marketing_post_eventos on public.marketing_publicacoes;
create trigger marketing_post_eventos after insert or update on public.marketing_publicacoes
for each row execute function public.marketing_registrar_post_v1();
drop trigger if exists marketing_midia_eventos on public.marketing_midias;
create trigger marketing_midia_eventos after insert or update on public.marketing_midias
for each row execute function public.marketing_registrar_midia_v1();

alter table public.marketing_uploads_pendentes enable row level security;
revoke all on public.marketing_uploads_pendentes from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_uploads_pendentes to service_role;
alter table public.marketing_midias enable row level security;
alter table public.marketing_publicacoes enable row level security;
alter table public.marketing_eventos enable row level security;
revoke all on public.marketing_midias,public.marketing_publicacoes,public.marketing_eventos from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_midias,public.marketing_publicacoes to service_role;
grant select,insert on public.marketing_eventos to service_role;

-- Bucket privado de homologação: nenhuma política de acesso via navegador;
-- upload/download somente por servidor autenticado, após ativar o backend.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('atlas-marketing','atlas-marketing',false,31457280,
 array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']::text[])
on conflict(id) do nothing;

commit;
