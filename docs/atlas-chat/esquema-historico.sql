-- Rascunho isolado, não aplicar em produção sem revisão.
begin;
create table public.atlas_chat_ocultacoes (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 usuario_id uuid not null,
 usuario_nome text not null,
 cliente_nome text,
 cliente_id uuid,
 telefone text not null,
 responsavel_id uuid,
 responsavel_nome text,
 conversa_id uuid not null,
 mensagem_id uuid,
 ocultado_em timestamptz not null default now(),
 restaurado_em timestamptz,
 restaurado_por uuid,
 -- Identidade histórica: não usar FK que impeça desligamento do funcionário.

 check ((restaurado_em is null) = (restaurado_por is null))
);
-- Sem FK em conversa/mensagem: registro de auditoria permanece mesmo se uma
-- manutenção administrativa remover o original. Não é cópia do conteúdo.
create unique index atlas_chat_ocultacoes_ativas on public.atlas_chat_ocultacoes(empresa_id,usuario_id,conversa_id,coalesce(mensagem_id,'00000000-0000-0000-0000-000000000000'::uuid)) where restaurado_em is null and mensagem_id is not null;
alter table public.atlas_chat_ocultacoes enable row level security;
revoke all on public.atlas_chat_ocultacoes from public,anon,authenticated;
grant select,insert on public.atlas_chat_ocultacoes to service_role;
grant update(restaurado_em,restaurado_por) on public.atlas_chat_ocultacoes to service_role;
-- Não permitir edição da identidade ou reabertura de um registro restaurado.
create function public.atlas_chat_registrar_ocultacao() returns trigger language plpgsql security invoker set search_path='' as $$
declare c record; u record;
begin
 select id,nome into u from public.usuarios where id=new.usuario_id and empresa_id=new.empresa_id;
 select id,cliente_id,contato_nome,telefone,responsavel_id,responsavel_nome into c from public.atendimento_conversas
  where id=new.conversa_id and empresa_id=new.empresa_id and responsavel_id=new.usuario_id and whatsapp_chat_tipo='contato';
 if u.id is null or c.id is null then raise exception 'Conversa ou usuário indisponível'; end if;
 if new.mensagem_id is not null and not exists(select 1 from public.atendimento_mensagens m where m.id=new.mensagem_id and m.empresa_id=new.empresa_id and m.conversa_id=new.conversa_id) then raise exception 'Mensagem indisponível'; end if;
 new.usuario_nome:=u.nome;
 new.cliente_nome:=c.contato_nome;
 new.cliente_id:=c.cliente_id;
 new.telefone:=c.telefone;
 new.responsavel_id:=c.responsavel_id;
 new.responsavel_nome:=c.responsavel_nome;
 new.ocultado_em:=clock_timestamp();
 new.restaurado_em:=null;
 new.restaurado_por:=null;
 return new;
end; $$;
revoke all on function public.atlas_chat_registrar_ocultacao() from public,anon,authenticated;
create trigger atlas_chat_ocultacao_registrar before insert on public.atlas_chat_ocultacoes for each row execute function public.atlas_chat_registrar_ocultacao();
create function public.atlas_chat_proteger_ocultacao() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.restaurado_em is not null or new.restaurado_em is null or new.restaurado_por is null then
  raise exception 'Registro de ocultação já encerrado ou restauração inválida';
 end if;
 if not exists(select 1 from public.usuarios u where u.id=new.restaurado_por and u.empresa_id=old.empresa_id and u.role='master') then
  raise exception 'Restauração exclusiva do Master';
 end if;
 return new;
end; $$;
revoke all on function public.atlas_chat_proteger_ocultacao() from public,anon,authenticated;
create trigger atlas_chat_ocultacao_restaurar before update on public.atlas_chat_ocultacoes for each row execute function public.atlas_chat_proteger_ocultacao();
commit;
