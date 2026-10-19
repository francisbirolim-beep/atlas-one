-- Identificação assistida; confirmação humana obrigatória, aprendizado por empresa.
-- Não altera compra, preço, fornecedor nem quantidade.
begin;
create table if not exists public.compras_identificacao_aprendizado (
 empresa_id uuid not null references public.empresas(id),
 termo_normalizado text not null check(length(termo_normalizado) between 2 and 500),
 produto_id uuid not null references public.produtos(id),
 confirmacoes integer not null default 1 check(confirmacoes>0),
 correcoes integer not null default 0 check(correcoes>=0),
 ultimo_usuario_id uuid not null references auth.users(id),
 atualizado_em timestamptz not null default now(),
 primary key(empresa_id,termo_normalizado)
);
create index if not exists compras_aprendizado_produto_idx on public.compras_identificacao_aprendizado(empresa_id,produto_id);
alter table public.compras_identificacao_aprendizado enable row level security;
revoke all on public.compras_identificacao_aprendizado from public,anon,authenticated;
grant select,insert,update on public.compras_identificacao_aprendizado to service_role;

create or replace function public.confirmar_identificacao_compras_v1(
 p_empresa uuid,p_usuario uuid,p_item uuid,p_produto uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item record;v_termo text;v_corrigido boolean;v_prev uuid;
begin
 if not exists(select 1 from public.usuarios where id=p_usuario and empresa_id=p_empresa)
  then raise exception 'Usuário não pertence à empresa';end if;
 select id,solicitacao_id,descricao,produto_id,status into v_item
 from public.compras_solicitacao_itens
 where id=p_item and empresa_id=p_empresa for update;
 if not found then raise exception 'Material não encontrado';end if;
 if v_item.status<>'ativo' then raise exception 'Material excluído ou pendente de exclusão';end if;
 if exists(select 1 from public.compras_carrinho_itens where item_id=p_item and empresa_id=p_empresa)
  then raise exception 'Item já está em um carrinho. Não altere a identificação';end if;
 if not exists(select 1 from public.produtos where id=p_produto and empresa_id=p_empresa and ativo)
  then raise exception 'Produto cadastrado inválido ou inativo';end if;
 v_termo:=btrim(regexp_replace(lower(translate(v_item.descricao,
  'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüç','AAAAEEIOOOUUCaaaaeeiooouuc')),
  '[^a-z0-9]+',' ','g'));
 if length(v_termo)<2 then raise exception 'Descrição insuficiente para aprender';end if;
 select produto_id into v_prev from public.compras_identificacao_aprendizado
 where empresa_id=p_empresa and termo_normalizado=v_termo for update;
 v_corrigido:=v_prev is not null and v_prev is distinct from p_produto;
 update public.compras_solicitacao_itens set produto_id=p_produto,identificacao_status='validado',
  identificacao_por_id=p_usuario,atualizado_por_id=p_usuario,updated_at=now()
 where id=p_item and empresa_id=p_empresa;
 insert into public.compras_identificacao_aprendizado(empresa_id,termo_normalizado,produto_id,
  confirmacoes,correcoes,ultimo_usuario_id)
 values(p_empresa,v_termo,p_produto,1,0,p_usuario)
 on conflict(empresa_id,termo_normalizado) do update set
  correcoes=public.compras_identificacao_aprendizado.correcoes+
    case when public.compras_identificacao_aprendizado.produto_id is distinct from excluded.produto_id then 1 else 0 end,
  confirmacoes=case when public.compras_identificacao_aprendizado.produto_id=excluded.produto_id
    then public.compras_identificacao_aprendizado.confirmacoes+1 else 1 end,
  produto_id=excluded.produto_id,ultimo_usuario_id=excluded.ultimo_usuario_id,atualizado_em=now();
 update public.compras_solicitacoes set status='em_cotacao',atualizado_por_id=p_usuario,updated_at=now()
 where id=v_item.solicitacao_id and empresa_id=p_empresa and status='aguardando_validacao';
 return jsonb_build_object('ok',true,'identificacaoValidada',true,'aprendizado',true,'corrigiuSugestaoAnterior',v_corrigido,
 'produtoId',p_produto);
end;$$;
revoke all on function public.confirmar_identificacao_compras_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirmar_identificacao_compras_v1(uuid,uuid,uuid,uuid) to service_role;
commit;