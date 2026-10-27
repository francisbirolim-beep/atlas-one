-- Autorização centralizada: usa SOMENTE as permissões que o Master já definiu,
-- sem criar um novo perfil Master ou permitir acesso de outros tenants.
create or replace function public.fn_pode_conferir_financeiro_v1(p_empresa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists(
  select 1 from public.usuarios u
  where u.id=(select auth.uid()) and u.empresa_id=p_empresa
   and (
    lower(u.role)='master'
    or (
      exists(select 1 from public.permissoes p where p.usuario_id=u.id
        and p.setor_id='financeiro' and p.nivel='edicao')
      and exists(select 1 from public.permissoes p where p.usuario_id=u.id
        and p.setor_id in ('fazer-orcamento-msanfyvj','orcamentos')
        and p.nivel='edicao')
      and coalesce((select c.config->'cliente360'->>'vendas'
                    from public.usuario_acessos_etapas c
                    where c.usuario_id=u.id and c.empresa_id=p_empresa),'edicao')='edicao'
      and coalesce((select c.config->'cliente360'->>'financeiro'
                    from public.usuario_acessos_etapas c
                    where c.usuario_id=u.id and c.empresa_id=p_empresa),'edicao')='edicao'
      and coalesce((select c.config->'modulos'->>'portal-cliente'
                    from public.usuario_acessos_etapas c
                    where c.usuario_id=u.id and c.empresa_id=p_empresa),'edicao')='edicao'
      and coalesce((select c.config->'modulos'->>'custos-cmv'
                    from public.usuario_acessos_etapas c
                    where c.usuario_id=u.id and c.empresa_id=p_empresa),'edicao')='edicao'
      and coalesce((select c.config->'modulos'->>'financeiro-geral'
                    from public.usuario_acessos_etapas c
                    where c.usuario_id=u.id and c.empresa_id=p_empresa),'edicao')='edicao'
    )
   )
 );
$$;
revoke execute on function public.fn_pode_conferir_financeiro_v1(uuid) from public,anon;
grant execute on function public.fn_pode_conferir_financeiro_v1(uuid) to authenticated;

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
 if v_empresa is null or not public.fn_pode_conferir_financeiro_v1(v_empresa) then
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
create or replace function public.fn_venda_conferir_valor_financeiro_v2(
 p_venda_id uuid, p_acao text, p_valor numeric, p_valor_anterior numeric,
 p_justificativa text, p_ajustar_parcela boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_retorno jsonb;
 v_venda public.vendas_obras%rowtype;
 v_titulo public.financeiro_contas_receber%rowtype;
 v_empresa uuid;
 v_outras numeric;
 v_novo numeric;
 v_anterior numeric;
 v_contas integer;
 v_orcamento_anterior numeric;
begin
 select empresa_id into v_empresa from public.usuarios
 where id=auth.uid();
 if v_empresa is null or not public.fn_pode_conferir_financeiro_v1(v_empresa) then raise exception 'Sem permissão para conferir esta venda'; end if;
 select * into v_venda from public.vendas_obras
 where id=p_venda_id and empresa_id=v_empresa for update;
 if not found then raise exception 'Venda nao localizada'; end if;
 -- A V1 continua sendo a unica responsavel por validar e auditar o valor da venda.
 -- Uma falha posterior neste bloco desfaz a gravacao feita pela V1.
 v_retorno := public.fn_venda_conferir_valor_wvetro_v1(
   p_venda_id,p_acao,p_valor,p_valor_anterior,p_justificativa
 );
 v_novo := (v_retorno->>'valor_conferido')::numeric;
 -- Corrige tambem o preco comercial do orcamento Atlas, sem modificar o
 -- payload bruto original, materiais, itens nem documentos do W.Vetro.
 -- O carimbo de conferencia impede que o proximo sync reverta a decisao humana.
 select valor_estimado into v_orcamento_anterior from public.orcamentos
 where id=v_venda.orcamento_id and empresa_id=v_empresa for update;
 update public.orcamentos
 set valor_estimado=v_novo,
   wvetro_fluxo=coalesce(wvetro_fluxo,'{}'::jsonb)||jsonb_build_object(
    'valor_venda_conferencia',jsonb_build_object(
      'status','corrigido','acao',p_acao,'valor_original_atlas',v_orcamento_anterior,
      'valor_conferido',v_novo,'conferido_em',now(),
      'conferido_por_id',auth.uid(),'justificativa',p_justificativa)),
   updated_at=now()
 where id=v_venda.orcamento_id and empresa_id=v_empresa;
 update public.venda_obra_revisoes
 set depois=coalesce(depois,'{}'::jsonb)||jsonb_build_object(
    'ajuste_orcamento_atlas',jsonb_build_object(
      'anterior',v_orcamento_anterior,'novo',v_novo,'usuario',auth.uid(),'em',now()))
 where id=(v_retorno->>'revisao_id')::uuid and empresa_id=v_empresa;
 if not coalesce(p_ajustar_parcela,false) then return v_retorno; end if;
 select count(*) into v_contas from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado';
 if v_contas=0 then
   raise exception 'Venda sem titulos financeiros. A correcao precisa ser feita pelo Financeiro';
 end if;
 -- Preserva todas as demais parcelas, principalmente as que ja foram pagas.
 select * into v_titulo from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id
 and status not in ('cancelado','pago')
 order by parcela desc nulls last, created_at desc, id desc limit 1 for update;
 if not found then
   raise exception 'Todas as parcelas estao quitadas; nao e seguro alterar automaticamente seus valores';
 end if;
 select coalesce(sum(valor),0) into v_outras
 from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id
   and status<>'cancelado' and id<>v_titulo.id;
 v_anterior := v_titulo.valor;
 v_novo := round(v_novo - v_outras,2);
 if v_novo<=0 or v_novo<coalesce(v_titulo.valor_pago,0)+coalesce(v_titulo.valor_desconto,0) then
   raise exception 'O novo total ficaria abaixo dos pagamentos ou das outras parcelas. Concilie manualmente';
 end if;
 update public.financeiro_contas_receber
 set valor=v_novo,updated_at=now()
 where id=v_titulo.id and empresa_id=v_empresa;
 update public.venda_obra_revisoes
 set depois=coalesce(depois,'{}'::jsonb)||jsonb_build_object(
   'ajuste_parcela',jsonb_build_object('titulo_id',v_titulo.id,
     'antes',v_anterior,'depois',v_novo,'usuario',auth.uid(),
     'motivo',p_justificativa,'em',now()))
 where id=(v_retorno->>'revisao_id')::uuid
   and empresa_id=v_empresa;
 return v_retorno || jsonb_build_object(
  'financeiro_conciliacao_pendente',false,
  'parcela_ajustada_id',v_titulo.id,
  'valor_parcelas_existentes',(v_outras+v_novo));
end;
$$;
create or replace function public.fn_corrigir_recebimento_venda_master_v1(
 p_venda_id uuid, p_recebimento_id uuid, p_valor_anterior numeric,
 p_valor_novo numeric, p_justificativa text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_usuario uuid:=auth.uid();
 v_empresa uuid;
 v_nome text;
 v_rec public.financeiro_recebimentos%rowtype;
 v_aloc public.financeiro_recebimento_alocacoes%rowtype;
 v_conta public.financeiro_contas_receber%rowtype;
 v_qtd integer;
 v_delta numeric;
 v_novo_pago numeric;
 v_id uuid;
begin
 select empresa_id,nome into v_empresa,v_nome from public.usuarios
 where id=v_usuario;
 if v_empresa is null or not public.fn_pode_conferir_financeiro_v1(v_empresa) then raise exception 'Sem permissão para corrigir pagamentos'; end if;
 if length(trim(coalesce(p_justificativa,'')))<8 or length(p_justificativa)>500 then
   raise exception 'Justificativa obrigatoria, entre 8 e 500 caracteres'; end if;
 if p_valor_novo is null or p_valor_novo<=0 or p_valor_novo>999999999
    or round(p_valor_novo,2)<>p_valor_novo then
   raise exception 'Valor recebido invalido'; end if;
 if not exists(select 1 from public.vendas_obras
   where id=p_venda_id and empresa_id=v_empresa and status<>'cancelada') then
   raise exception 'Venda nao localizada ou cancelada'; end if;
 select * into v_rec from public.financeiro_recebimentos
 where id=p_recebimento_id and empresa_id=v_empresa for update;
 if not found or v_rec.status in ('cancelado','estornado') then
   raise exception 'Recebimento indisponivel para correcao'; end if;
 if v_rec.valor is distinct from p_valor_anterior then
   raise exception 'O pagamento mudou. Atualize a pagina e confira novamente'; end if;
 if v_rec.valor=p_valor_novo then raise exception 'Informe um valor diferente'; end if;
 select count(*) into v_qtd from public.financeiro_recebimento_alocacoes
 where recebimento_id=p_recebimento_id and empresa_id=v_empresa;
 if v_qtd<>1 then
   raise exception 'Pagamento distribuido ou com desconto: concilie no Financeiro'; end if;
 select * into v_aloc from public.financeiro_recebimento_alocacoes
 where recebimento_id=p_recebimento_id and empresa_id=v_empresa for update;
 if v_aloc.tipo<>'conta' or v_aloc.valor is distinct from v_rec.valor then
   raise exception 'Alocacao composta nao permite correcao direta'; end if;
 select * into v_conta from public.financeiro_contas_receber
 where id=v_aloc.conta_receber_id and empresa_id=v_empresa and venda_obra_id=p_venda_id
   and status<>'cancelado' for update;
 if not found then raise exception 'O pagamento nao pertence a esta venda'; end if;
 v_delta := p_valor_novo - v_rec.valor;
 v_novo_pago := round(coalesce(v_conta.valor_pago,0)+v_delta,2);
 if v_novo_pago<0 or v_novo_pago+coalesce(v_conta.valor_desconto,0)>v_conta.valor+0.009 then
   raise exception 'Correcao excede o saldo da parcela ou gera pagamento negativo'; end if;
 insert into public.financeiro_recebimentos_correcoes_master(
   empresa_id,venda_obra_id,recebimento_id,conta_receber_id,
   valor_anterior,valor_novo,justificativa,antes,depois,criado_por_id,criado_por_nome)
 values (v_empresa,p_venda_id,p_recebimento_id,v_conta.id,
   v_rec.valor,p_valor_novo,trim(p_justificativa),
   jsonb_build_object('recebimento',to_jsonb(v_rec),'alocacao',to_jsonb(v_aloc),'conta',to_jsonb(v_conta)),
   jsonb_build_object('recebimento_valor',p_valor_novo,'alocacao_valor',p_valor_novo,
      'conta_valor_pago',v_novo_pago,'em',now()),v_usuario,v_nome)
 returning id into v_id;
 update public.financeiro_recebimentos set valor=p_valor_novo,updated_at=now()
   where id=p_recebimento_id and empresa_id=v_empresa;
 update public.financeiro_recebimento_alocacoes set valor=p_valor_novo
   where id=v_aloc.id and empresa_id=v_empresa;
 update public.financeiro_contas_receber
 set valor_pago=v_novo_pago,
   status=case when v_novo_pago+coalesce(valor_desconto,0)>=valor-0.009 then 'pago'
          when vencimento is not null and vencimento<current_date then 'vencido'
          else 'aberto' end,
   data_pagamento=case when v_novo_pago+coalesce(valor_desconto,0)>=valor-0.009
       then coalesce(data_pagamento,v_rec.data_recebimento) else null end,
   updated_at=now()
 where id=v_conta.id and empresa_id=v_empresa;
 return jsonb_build_object('ok',true,'correcao_id',v_id,'valor_anterior',v_rec.valor,
   'valor_novo',p_valor_novo,'parcela_id',v_conta.id);
end;
$$;
create or replace function public.fn_conferir_importacao_venda_financeiro_v1(
 p_venda_id uuid, p_tipo text, p_financeiro_id uuid, p_acao text,
 p_valor_anterior numeric, p_valor_novo numeric, p_justificativa text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_usuario uuid:=auth.uid();
 v_empresa uuid;
 v_nome text;
 v_venda public.vendas_obras%rowtype;
 v_numero text;
 v_origem numeric;
 v_ultimo public.venda_conferencias_importacao%rowtype;
 v_atual numeric;
 v_novo numeric;
 v_id uuid;
 v_justificativa text;
begin
 select empresa_id,nome into v_empresa,v_nome
 from public.usuarios where id=v_usuario;
 if v_empresa is null or not public.fn_pode_conferir_financeiro_v1(v_empresa) then raise exception 'Sem permissão para conferir esta importação'; end if;
 if p_tipo not in ('wvetro_venda','atlas_venda','wvetro_pagamento') then
   raise exception 'Tipo de conferência inválido'; end if;
 if p_acao not in ('validado','corrigido') then raise exception 'Ação inválida'; end if;
 if p_tipo='atlas_venda' and p_acao<>'validado' then
   raise exception 'Use Corrigir valor da venda Atlas para alterar seu financeiro'; end if;
 if (p_tipo='wvetro_pagamento') is distinct from (p_financeiro_id is not null) then
   raise exception 'Identificação do pagamento inválida'; end if;
 v_justificativa:=trim(coalesce(p_justificativa,''));
 if p_acao='corrigido' and (length(v_justificativa)<8 or length(v_justificativa)>500) then
   raise exception 'Justificativa entre 8 e 500 caracteres obrigatória'; end if;
 select * into v_venda from public.vendas_obras
 where id=p_venda_id and empresa_id=v_empresa and status<>'cancelada'
 for update;
 if not found then raise exception 'Venda não encontrada nesta empresa'; end if;
 if p_tipo='atlas_venda' then
   v_origem:=round(v_venda.valor_venda,2);
 else
   select coalesce(wvetro_fluxo->>'numero',wvetro_fluxo->>'numero_wvetro')
   into v_numero from public.orcamentos
   where id=v_venda.orcamento_id and empresa_id=v_empresa;
   if nullif(v_numero,'') is null then
     raise exception 'Venda sem número W.Vetro vinculado'; end if;
   if p_tipo='wvetro_venda' then
     select round(valor_total,2) into v_origem
     from public.wvetro_orcamentos_historico
     where empresa_id=v_empresa and wvetro_numero=v_numero
     order by updated_at desc limit 1;
   else
     select round(valor_recebido,2) into v_origem
     from public.wvetro_historico_financeiro
     where empresa_id=v_empresa and id=p_financeiro_id
       and cliente_id=v_venda.cliente_id and orcamento_wvetro=v_numero
       and tipo_titulo='R' and status_vinculo='seguro'
     limit 1;
   end if;
 end if;
 if v_origem is null then raise exception 'Referência importada não localizada ou sem vínculo seguro'; end if;
 select * into v_ultimo from public.venda_conferencias_importacao
 where empresa_id=v_empresa and venda_obra_id=p_venda_id and tipo=p_tipo
  and wvetro_financeiro_id is not distinct from p_financeiro_id
 order by created_at desc,id desc limit 1;
 -- No Atlas, prevalece sempre o valor atual da venda, não um snapshot antigo.
 v_atual:=case when p_tipo='atlas_venda' then v_origem
  else coalesce(v_ultimo.valor_conferido,v_origem) end;
 if p_valor_anterior is null or round(p_valor_anterior,2)<>v_atual then
   raise exception 'O valor foi alterado; atualize a página antes de conferir'; end if;
 v_novo:=case when p_acao='validado' then v_atual else p_valor_novo end;
 if v_novo is null or v_novo<0 or v_novo>999999999 or round(v_novo,2)<>v_novo
   or (p_tipo<>'wvetro_pagamento' and v_novo<=0) then
   raise exception 'Informe um valor monetário válido com até duas casas decimais'; end if;
 if p_acao='corrigido' and v_novo=v_atual then
   raise exception 'O valor informado é igual ao atual; utilize Validar'; end if;
 if p_acao='validado' then v_justificativa:='Conferência manual da informação exibida'; end if;
 insert into public.venda_conferencias_importacao (
 empresa_id,venda_obra_id,tipo,wvetro_financeiro_id,acao,
 valor_origem,valor_anterior,valor_conferido,justificativa,criado_por_id,criado_por_nome
 ) values(v_empresa,p_venda_id,p_tipo,p_financeiro_id,p_acao,
 v_origem,v_atual,v_novo,v_justificativa,v_usuario,v_nome)
 returning id into v_id;
 return jsonb_build_object('ok',true,'conferencia_id',v_id,'tipo',p_tipo,
 'valor_origem',v_origem,'valor_anterior',v_atual,'valor_conferido',v_novo,
 'acao',p_acao,'financeiro_atlas_alterado',false);
end;
$$;
-- Consultas de auditoria usam a MESMA regra de autorização, sempre por empresa.
drop policy if exists "Master consulta revisoes de importacao da empresa" on public.venda_conferencias_importacao;
create policy "Conferentes autorizados consultam revisoes de importacao"
on public.venda_conferencias_importacao for select to authenticated
using (public.fn_pode_conferir_financeiro_v1(empresa_id));

drop policy if exists "master consulta correcoes do tenant" on public.financeiro_recebimentos_correcoes_master;
create policy "Conferentes autorizados consultam correcoes financeiras"
on public.financeiro_recebimentos_correcoes_master for select to authenticated
using (public.fn_pode_conferir_financeiro_v1(empresa_id));
