-- Atlas One: cards manuais de acompanhamento por VENDA, nunca por cliente.
-- Aditivo: não altera Compras 360, operações de produção, instalação nem a venda.
begin;

create table if not exists public.kanban_obra_cards_manuais (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_id uuid not null references public.vendas_obras(id),
 titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
 descricao text not null default '' check (char_length(descricao)<=1000),
 etapa text not null check (etapa in
  ('vendido','separacao_materiais','compras','aguardando_materiais','medicao_final','producao','instalacao','finalizado')),
 retirado_em timestamptz,
 criado_por_id uuid not null references public.usuarios(id),
 atualizado_por_id uuid not null references public.usuarios(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (empresa_id,id)
);
create index if not exists kanban_obra_cards_manuais_venda_idx on public.kanban_obra_cards_manuais(empresa_id,venda_id,retirado_em);

create table if not exists public.kanban_obra_cards_historico (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 venda_id uuid not null references public.vendas_obras(id),
 card_id uuid not null references public.kanban_obra_cards_manuais(id),
 acao text not null check(acao in ('criar','mover','retirar','restaurar')),
 estado_anterior text,
 estado_novo text,
 motivo text not null check(char_length(btrim(motivo)) between 8 and 1000),
 usuario_id uuid not null references public.usuarios(id),
 created_at timestamptz not null default now()
);
create index if not exists kanban_obra_cards_historico_venda_idx on public.kanban_obra_cards_historico(empresa_id,venda_id,created_at desc);

alter table public.kanban_obra_cards_manuais enable row level security;
alter table public.kanban_obra_cards_historico enable row level security;
revoke all on public.kanban_obra_cards_manuais from public,anon,authenticated;
revoke all on public.kanban_obra_cards_historico from public,anon,authenticated;
grant select,insert,update on public.kanban_obra_cards_manuais to service_role;
grant select,insert on public.kanban_obra_cards_historico to service_role;
grant usage,select on sequence public.kanban_obra_cards_historico_id_seq to service_role;

create or replace function public.alterar_card_kanban_obra_v1(
 p_empresa uuid,p_usuario uuid,p_venda uuid,p_card uuid,p_acao text,
 p_titulo text,p_descricao text,p_etapa text,p_motivo text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
 v_role text;
 v_config jsonb;
 v_setor text;
 v_acao text;
 v_antes text;
 v_depois text;
 v_card uuid;
 v_retirado timestamptz;
begin
 select lower(role) into v_role from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 if v_role is null then raise exception 'Usuário não autorizado na empresa'; end if;
 if not exists(select 1 from public.vendas_obras where id=p_venda and empresa_id=p_empresa)
 then raise exception 'Venda não encontrada nesta empresa'; end if;
 if p_acao not in ('criar','mover','retirar','restaurar') then raise exception 'Ação inválida'; end if;
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000
 then raise exception 'Motivo inválido'; end if;
 if v_role <> 'master' then
   -- Ação, módulo e setor precisam estar expressamente habilitados pelo Master.
   select config into v_config from public.usuario_acessos_etapas
    where empresa_id=p_empresa and usuario_id=p_usuario;
   select nivel into v_setor from public.permissoes
    where empresa_id=p_empresa and usuario_id=p_usuario and setor_id='portal-cliente';
   v_acao='clientes.kanban_obra.'||p_acao;
   if v_setor is distinct from 'edicao'
     or v_config #>> '{modulos,kanban-obra}' is distinct from 'edicao'
     or v_config #>> array['acoes',v_acao] is distinct from 'edicao'
   then raise exception 'Ação não autorizada pelo Master'; end if;
 end if;
 if p_acao in ('criar','mover') and p_etapa not in
  ('vendido','separacao_materiais','compras','aguardando_materiais','medicao_final','producao','instalacao','finalizado')
 then raise exception 'Etapa inválida'; end if;
 if p_acao='criar' then
   if char_length(btrim(coalesce(p_titulo,''))) not between 3 and 120
      or char_length(coalesce(p_descricao,'')) > 1000
   then raise exception 'Título ou descrição inválida'; end if;
   insert into public.kanban_obra_cards_manuais
    (empresa_id,venda_id,titulo,descricao,etapa,criado_por_id,atualizado_por_id)
   values (p_empresa,p_venda,btrim(p_titulo),coalesce(p_descricao,''),p_etapa,p_usuario,p_usuario)
   returning id into v_card;
   v_antes=null;v_depois=p_etapa;
 else
   select id,etapa,retirado_em into v_card,v_antes,v_retirado
    from public.kanban_obra_cards_manuais
    where id=p_card and empresa_id=p_empresa and venda_id=p_venda for update;
   if not found then raise exception 'Card não encontrado nesta venda'; end if;
   if p_acao='mover' then
     if v_retirado is not null then raise exception 'Card retirado, restaure antes de mover'; end if;
     update public.kanban_obra_cards_manuais set etapa=p_etapa,atualizado_por_id=p_usuario,updated_at=now()
      where id=v_card and empresa_id=p_empresa;
     v_depois=p_etapa;
   elsif p_acao='retirar' then
     if v_retirado is not null then raise exception 'Card já retirado'; end if;
     update public.kanban_obra_cards_manuais set retirado_em=now(),atualizado_por_id=p_usuario,updated_at=now()
      where id=v_card and empresa_id=p_empresa;
     v_depois='retirado';
   else
     if v_retirado is null then raise exception 'Card não está retirado'; end if;
     update public.kanban_obra_cards_manuais set retirado_em=null,atualizado_por_id=p_usuario,updated_at=now()
      where id=v_card and empresa_id=p_empresa;
     v_antes='retirado';v_depois=(select etapa from public.kanban_obra_cards_manuais where id=v_card);
   end if;
 end if;
 insert into public.kanban_obra_cards_historico
  (empresa_id,venda_id,card_id,acao,estado_anterior,estado_novo,motivo,usuario_id)
 values(p_empresa,p_venda,v_card,p_acao,v_antes,v_depois,btrim(p_motivo),p_usuario);
 return jsonb_build_object('ok',true,'cardId',v_card,'vendaId',p_venda,'etapa',v_depois);
end;$$;
revoke all on function public.alterar_card_kanban_obra_v1(uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.alterar_card_kanban_obra_v1(uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;
commit;
