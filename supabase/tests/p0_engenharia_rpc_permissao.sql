begin;

create temp table engenharia_perm_ctx as
select u.id as usuario_id,false as bloqueou_conferencia,false as bloqueou_producao
from public.usuarios u
where u.role<>'master'
  and not exists (
    select 1 from public.permissoes p
    where p.usuario_id=u.id and p.empresa_id=u.empresa_id and p.setor_id='engenharia-projeto' and p.nivel='edicao'
  )
order by u.created_at
limit 1;

do $$
begin
  if (select usuario_id is null from engenharia_perm_ctx) then
    raise exception 'Teste requer funcionário sem edição na Engenharia';
  end if;
end $$;

select set_config('request.jwt.claim.sub',(select usuario_id::text from engenharia_perm_ctx),true);

do $$
declare v_user uuid;
begin
  select usuario_id into v_user from engenharia_perm_ctx;
  begin
    perform public.fn_concluir_conferencia_projeto_v1(gen_random_uuid(),gen_random_uuid(),v_user,'Teste oculto');
    raise exception 'RPC de conferência permitiu usuário sem edição';
  exception when others then
    if sqlerrm='RPC de conferência permitiu usuário sem edição' then raise; end if;
    if position('Sem permissão de edição na Engenharia' in sqlerrm)=0 then raise; end if;
    update engenharia_perm_ctx set bloqueou_conferencia=true;
  end;

  begin
    perform public.fn_engenharia_liberar_para_producao(gen_random_uuid(),gen_random_uuid(),v_user,'Teste oculto');
    raise exception 'RPC de produção permitiu usuário sem edição';
  exception when others then
    if sqlerrm='RPC de produção permitiu usuário sem edição' then raise; end if;
    if position('Sem permissão de edição na Engenharia' in sqlerrm)=0 then raise; end if;
    update engenharia_perm_ctx set bloqueou_producao=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_conferencia and bloqueou_producao from engenharia_perm_ctx) then
    raise exception 'Proteções de privilégio da Engenharia não foram comprovadas';
  end if;
end $$;

rollback;