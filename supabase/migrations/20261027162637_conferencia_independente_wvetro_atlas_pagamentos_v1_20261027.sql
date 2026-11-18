-- Modulo ADITIVO. Nao substitui valores nem as funcoes financeiras existentes.
-- Toda validacao e correcao aqui e uma REVISAO da informacao importada,
-- nao um pagamento, nao uma baixa e nao uma alteracao do payload W.Vetro.
create table if not exists public.venda_conferencias_importacao (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 venda_obra_id uuid not null,
 tipo text not null check (tipo in ('wvetro_venda','atlas_venda','wvetro_pagamento')),
 wvetro_financeiro_id uuid,
 acao text not null check (acao in ('validado','corrigido')),
 valor_origem numeric(14,2) not null,
 valor_anterior numeric(14,2) not null,
 valor_conferido numeric(14,2) not null,
 justificativa text not null,
 criado_por_id uuid not null,
 criado_por_nome text not null,
 created_at timestamptz not null default now(),
 constraint conferencia_item_tipo check (
   (tipo='wvetro_pagamento' and wvetro_financeiro_id is not null)
   or (tipo<>'wvetro_pagamento' and wvetro_financeiro_id is null))
);
create index if not exists idx_venda_conferencias_importacao_v1 on public.venda_conferencias_importacao
 (empresa_id,venda_obra_id,tipo,wvetro_financeiro_id,created_at desc);
alter table public.venda_conferencias_importacao enable row level security;
revoke all on public.venda_conferencias_importacao from public,anon,authenticated;
grant select on public.venda_conferencias_importacao to authenticated;
drop policy if exists "Master consulta revisoes de importacao da empresa" on public.venda_conferencias_importacao;
create policy "Master consulta revisoes de importacao da empresa"
on public.venda_conferencias_importacao for select to authenticated
using (exists(select 1 from public.usuarios u where u.id=(select auth.uid())
 and u.empresa_id=venda_conferencias_importacao.empresa_id and lower(u.role)='master'));

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
 from public.usuarios where id=v_usuario and lower(role)='master';
 if v_empresa is null then raise exception 'Somente Master pode validar ou corrigir'; end if;
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
revoke execute on function public.fn_conferir_importacao_venda_financeiro_v1(uuid,text,uuid,text,numeric,numeric,text) from public,anon;
grant execute on function public.fn_conferir_importacao_venda_financeiro_v1(uuid,text,uuid,text,numeric,numeric,text) to authenticated;
