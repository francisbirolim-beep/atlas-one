begin;
create temporary table p0_ctx(u uuid, empresa uuid, tipologia uuid) on commit drop;
insert into p0_ctx
select u.id,u.empresa_id,(select id from public.tipologias limit 1)
from public.usuarios u join public.permissoes p on p.usuario_id=u.id and p.empresa_id=u.empresa_id
where p.setor_id='engenharia-projeto' and p.nivel='edicao' limit 1;
grant select on p0_ctx to authenticated;
select set_config('request.jwt.claim.sub',(select u::text from p0_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare v_id uuid; begin
 insert into public.engenharia_variaveis_preset(tipologia_id,nome,valores,padrao,criado_por_id,criado_por_nome)
 select tipologia,'preset teste rls','{}'::jsonb,false,u,'teste' from p0_ctx returning id into v_id;
 if v_id is null then raise exception 'Usuário com edição não conseguiu inserir preset'; end if;
 delete from public.engenharia_variaveis_preset where id=v_id;
end $$;
rollback;
select 'P0_ENGENHARIA_PRESET_COMPAT_OK' as resultado;
