-- Funcao aditiva, aplicada somente apos homologacao.
-- A venda muda numa transacao com historico; itens/materiais/orcamento e contas a receber ficam intactos.
create or replace function public.fn_venda_conferir_valor_wvetro_v1(
 p_venda_id uuid,
 p_acao text,
 p_valor numeric,
 p_valor_anterior numeric,
 p_justificativa text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_usuario uuid := auth.uid();
 v_empresa uuid;
 v_role text;
 v_venda public.vendas_obras%rowtype;
 v_fluxo jsonb;
 v_numero text;
 v_wvetro numeric;
 v_novo numeric;
 v_antes jsonb;
 v_revisao_anterior jsonb;
 v_depois jsonb;
 v_versao integer;
 v_revisao uuid;
 v_contas integer;
 v_total_contas numeric;
 v_motivo text;
begin
 if v_usuario is null then raise exception 'Sessão inválida'; end if;
 select empresa_id,role into v_empresa,v_role from public.usuarios where id=v_usuario;
 if v_empresa is null or lower(coalesce(v_role,''))<>'master' then
   raise exception 'Somente usuário Master pode alterar o valor de venda';
 end if;
 if p_acao not in ('validado','corrigido') then raise exception 'Ação inválida'; end if;
 if p_acao='corrigido' and length(trim(coalesce(p_justificativa,'')))<8 then
   raise exception 'Informe a justificativa da correção (mínimo 8 caracteres)';
 end if;
 select * into v_venda from public.vendas_obras
  where id=p_venda_id and empresa_id=v_empresa for update;
 if not found then raise exception 'Venda não encontrada nesta empresa'; end if;
 if v_venda.status='cancelada' then raise exception 'Venda cancelada não pode ser revisada'; end if;
 if v_venda.valor_venda is distinct from p_valor_anterior then
   raise exception 'Valor de venda mudou; atualize a página antes de revisar';
 end if;
 select coalesce(wvetro_fluxo,'{}'::jsonb) into v_fluxo from public.orcamentos
  where id=v_venda.orcamento_id and empresa_id=v_empresa;
 if not found then raise exception 'Orçamento não encontrado'; end if;
 v_numero:=coalesce(v_fluxo->>'numero',v_fluxo->>'numero_wvetro');
 if v_numero is not null then
  select valor_total into v_wvetro from public.wvetro_orcamentos_historico
   where empresa_id=v_empresa and wvetro_numero=v_numero
   order by updated_at desc limit 1;
 end if;
 if v_wvetro is null and (v_fluxo->>'valor_total_wvetro')~'^[0-9]+(\.[0-9]+)?$' then
  v_wvetro:=(v_fluxo->>'valor_total_wvetro')::numeric;
 end if;
 if p_acao='validado' and v_wvetro is null then
  raise exception 'Sem valor de venda W.Vetro importado; use Corrigir com justificativa';
 end if;
 v_novo:=case when p_acao='validado' then v_wvetro else p_valor end;
 if v_novo is null or v_novo<=0 or v_novo>999999999 or round(v_novo,2)<>v_novo then
  raise exception 'Informe um valor monetário positivo, com até duas casas decimais';
 end if;
 if p_acao='corrigido' and v_novo=v_venda.valor_venda then
  raise exception 'O valor já é o mesmo; use Validar se a referência W.Vetro estiver correta';
 end if;
 v_motivo:=case when p_acao='validado'
  then 'Validação de valor de venda W.Vetro #'||coalesce(v_numero,'sem número')
  else trim(p_justificativa) end;
 v_antes:=jsonb_build_object('valor_venda',v_venda.valor_venda,
    'custo_previsto',v_venda.custo_previsto,'itens_snapshot',v_venda.itens_snapshot,
    'config_snapshot',v_venda.config_snapshot,'versao',v_venda.versao);
 -- Preservar a ÚLTIMA revisão já aprovada, inclusive seus snapshots e metadados.
 select depois into v_revisao_anterior from public.venda_obra_revisoes
  where empresa_id=v_empresa and venda_obra_id=p_venda_id
  order by versao desc,created_at desc limit 1;
 if jsonb_typeof(v_revisao_anterior)='object' then
   v_antes:=v_revisao_anterior;
 end if;
 select greatest(v_venda.versao,coalesce(max(versao),0))+1 into v_versao
  from public.venda_obra_revisoes where empresa_id=v_empresa and venda_obra_id=p_venda_id;
 v_depois:=v_antes || jsonb_build_object('versao',v_versao,'valor_venda',v_novo,
  'conferencia_valor_venda',jsonb_build_object('fonte','W.Vetro','acao',p_acao,
   'valor_origem_wvetro',v_wvetro,'valor_anterior',v_venda.valor_venda,
   'valor_conferido',v_novo,'numero_wvetro',v_numero,'usuario',v_usuario,'em',now()));
 insert into public.venda_obra_revisoes
 (empresa_id,venda_obra_id,versao,tipo,justificativa,antes,depois,impacto_valor,impacto_custo,criado_por_id,criado_por_nome)
 values (v_empresa,p_venda_id,v_versao,'ajuste',v_motivo,v_antes,v_depois,v_novo-v_venda.valor_venda,
  0,v_usuario,(select nome from public.usuarios where id=v_usuario))
 returning id into v_revisao;
 update public.vendas_obras set valor_venda=v_novo,versao=v_versao,updated_at=now()
  where id=p_venda_id and empresa_id=v_empresa;
 select count(*),coalesce(sum(valor),0) into v_contas,v_total_contas from public.financeiro_contas_receber
  where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado';
 return jsonb_build_object('ok',true,'revisao_id',v_revisao,'valor_anterior',v_venda.valor_venda,
  'valor_conferido',v_novo,'valor_wvetro',v_wvetro,
  'financeiro_conciliacao_pendente',v_contas>0 and abs(v_total_contas-v_novo)>0.009,
  'valor_parcelas_existentes',v_total_contas);
end;
$$;
revoke execute on function public.fn_venda_conferir_valor_wvetro_v1(uuid,text,numeric,numeric,text) from public,anon;
grant execute on function public.fn_venda_conferir_valor_wvetro_v1(uuid,text,numeric,numeric,text) to authenticated;
