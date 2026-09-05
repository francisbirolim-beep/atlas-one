begin;

create temp table tenant_guard_ctx as
select
  (select id from public.usuarios where empresa_id is not null order by created_at limit 1) as usuario_id,
  (select empresa_id from public.usuarios where empresa_id is not null order by created_at limit 1) as empresa_id,
  gen_random_uuid() as empresa_fake,
  false as bloqueou_memoria,
  false as bloqueou_conversa,
  false as bloqueou_mensagem,
  false as bloqueou_catalogo;

do $$
begin
  if (select usuario_id is null or empresa_id is null from tenant_guard_ctx) then
    raise exception 'Teste de guards requer usuário com empresa';
  end if;
end $$;

do $$
declare
  c record;
begin
  select * into c from tenant_guard_ctx;
  begin
    insert into public.agente_memorias(empresa_id,usuario_id,chave,valor)
    values(c.empresa_fake,c.usuario_id,'__P0_GUARD_TEST__','teste');
    raise exception 'Memória cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Memória cross-tenant não foi bloqueada' then raise; end if;
    if position('empresa diferente do usuário' in sqlerrm)=0 then raise; end if;
    update tenant_guard_ctx set bloqueou_memoria=true;
  end;
end $$;

do $$
declare
  c record;
begin
  select * into c from tenant_guard_ctx;
  begin
    insert into public.agente_conversas(empresa_id,usuario_id)
    values(c.empresa_fake,c.usuario_id);
    raise exception 'Conversa cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Conversa cross-tenant não foi bloqueada' then raise; end if;
    if position('empresa diferente do usuário' in sqlerrm)=0 then raise; end if;
    update tenant_guard_ctx set bloqueou_conversa=true;
  end;
end $$;

do $$
declare
  c record;
  v_conversa uuid;
begin
  select * into c from tenant_guard_ctx;
  insert into public.agente_conversas(empresa_id,usuario_id)
  values(c.empresa_id,c.usuario_id) returning id into v_conversa;

  begin
    insert into public.agente_mensagens(empresa_id,conversa_id,papel,conteudo)
    values(c.empresa_fake,v_conversa,'user','__P0_GUARD_TEST__');
    raise exception 'Mensagem cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Mensagem cross-tenant não foi bloqueada' then raise; end if;
    if position('empresa diferente da conversa' in sqlerrm)=0 then raise; end if;
    update tenant_guard_ctx set bloqueou_mensagem=true;
  end;
end $$;

do $$
declare
  c record;
  v_item uuid;
begin
  select * into c from tenant_guard_ctx;
  select id into v_item from public.fornecedor_catalogo_itens order by created_at limit 1;
  if v_item is null then
    raise exception 'Teste de catálogo requer item existente';
  end if;

  begin
    update public.fornecedor_catalogo_itens set empresa_id=c.empresa_fake where id=v_item;
    raise exception 'Item de catálogo cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Item de catálogo cross-tenant não foi bloqueado' then raise; end if;
    if position('empresa diferente do fornecedor' in sqlerrm)=0 then raise; end if;
    update tenant_guard_ctx set bloqueou_catalogo=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_memoria and bloqueou_conversa and bloqueou_mensagem and bloqueou_catalogo from tenant_guard_ctx) then
    raise exception 'Guards relacionais multi-tenant não foram comprovados';
  end if;
end $$;

rollback;
