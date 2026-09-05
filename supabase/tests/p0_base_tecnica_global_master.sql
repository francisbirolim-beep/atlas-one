begin;

create temp table base_global_ctx as
select u.id as usuario_id,u.empresa_id as empresa_original,null::uuid as empresa_b,
       false as bloqueou_duplicar,false as bloqueou_restaurar,false as bloqueou_substituir
from public.usuarios u where u.role='master' and u.empresa_id is not null order by u.created_at limit 1;

do $$ begin
  if (select usuario_id is null from base_global_ctx) then raise exception 'Teste requer Master existente'; end if;
end $$;

insert into public.empresas(nome,slug) values('Tenant Base Global CI','tenant-base-global-ci');
update base_global_ctx set empresa_b=(select id from public.empresas where slug='tenant-base-global-ci');
update public.usuarios set empresa_id=(select empresa_b from base_global_ctx) where id=(select usuario_id from base_global_ctx);
select set_config('request.jwt.claim.sub',(select usuario_id::text from base_global_ctx),true);

do $$
begin
  begin
    perform public.fn_duplicar_tipologia_v1(gen_random_uuid(),'Teste Bloqueado',null,'teste segurança');
    raise exception 'Duplicação global permitida para outro tenant';
  exception when others then
    if sqlerrm='Duplicação global permitida para outro tenant' then raise; end if;
    if position('Base técnica global restrita' in sqlerrm)=0 then raise; end if;
    update base_global_ctx set bloqueou_duplicar=true;
  end;

  begin
    perform public.fn_restaurar_formula_tipologia_v1(gen_random_uuid(),1,'teste segurança');
    raise exception 'Restauração global permitida para outro tenant';
  exception when others then
    if sqlerrm='Restauração global permitida para outro tenant' then raise; end if;
    if position('Base técnica global restrita' in sqlerrm)=0 then raise; end if;
    update base_global_ctx set bloqueou_restaurar=true;
  end;

  begin
    perform public.fn_tipologia_substituir_componente_direto_v1(gen_random_uuid(),'perfil','A','B','teste segurança',null,null);
    raise exception 'Substituição global permitida para outro tenant';
  exception when others then
    if sqlerrm='Substituição global permitida para outro tenant' then raise; end if;
    if position('Base técnica global restrita' in sqlerrm)=0 then raise; end if;
    update base_global_ctx set bloqueou_substituir=true;
  end;
end $$;

do $$ begin
  if not (select bloqueou_duplicar and bloqueou_restaurar and bloqueou_substituir from base_global_ctx) then
    raise exception 'Proteções da base técnica global não foram comprovadas';
  end if;
end $$;

rollback;