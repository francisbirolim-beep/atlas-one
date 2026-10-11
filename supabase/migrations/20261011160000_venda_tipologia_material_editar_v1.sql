-- Ajustes por tipologia, sem modificar o orçamento vendido, CMV WVetro ou cotação já emitida.
create table if not exists public.venda_tipologia_materiais_historico(
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 pacote_id uuid not null references public.pacotes_tecnicos(id),
 venda_obra_id uuid not null references public.vendas_obras(id),
 item_ref text not null,
 material_id uuid,
 material_novo_id uuid,
 acao text not null check(acao in ('incluir','substituir','excluir','ajustar')),
 antes jsonb,
 depois jsonb,
 justificativa text not null,
 usuario_id uuid,
 usuario_nome text,
 created_at timestamptz not null default now()
);
create index if not exists idx_venda_tipologia_materiais_historico
 on public.venda_tipologia_materiais_historico(empresa_id,venda_obra_id,item_ref,created_at desc);
alter table public.venda_tipologia_materiais_historico enable row level security;
revoke all on public.venda_tipologia_materiais_historico from anon,authenticated;
grant select,insert,update,delete on public.venda_tipologia_materiais_historico to service_role;

create or replace function public.fn_venda_tipologia_material_editar_v1(
 p_empresa uuid,p_venda uuid,p_pacote uuid,p_item_ref text,
 p_acao text,p_material uuid,p_novo jsonb,p_motivo text,p_usuario uuid,p_usuario_nome text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
 v_venda record;v_pacote record;v_material record;v_produto record;
 v_antes jsonb;v_depois jsonb;v_novo_id uuid;v_cat text;
 v_codigo text;v_desc text;v_un text;v_cor text;v_qty numeric;
 v_corte numeric;v_barra numeric;v_produto_id uuid;
 v_op text:=lower(trim(coalesce(p_acao,'')));
 v_historico_id uuid;
begin
 if p_empresa is null or p_venda is null or p_pacote is null or p_item_ref is null
    or v_op not in ('incluir','substituir','excluir','ajustar')
    or length(trim(coalesce(p_motivo,'')))<5 then
  raise exception 'Dados ou justificativa inválidos';
 end if;
 select v.id,v.orcamento_id into v_venda
 from public.vendas_obras v where v.id=p_venda and v.empresa_id=p_empresa;
 if not found then raise exception 'Venda não encontrada nesta empresa'; end if;
 select t.id,t.status,t.orcamento_id into v_pacote
 from public.pacotes_tecnicos t
 where t.id=p_pacote and t.empresa_id=p_empresa and t.orcamento_id=v_venda.orcamento_id
  and (t.venda_obra_id is null or t.venda_obra_id=p_venda)
  and t.status<>'substituido' for update;
 if not found then raise exception 'Pacote técnico indisponível para esta venda'; end if;
 if not exists(
  select 1 from public.orcamentos o,
  lateral jsonb_array_elements(case when jsonb_typeof(o.itens)='array' then o.itens else '[]'::jsonb end) item
  where o.id=v_venda.orcamento_id and o.empresa_id=p_empresa and item->>'id'=p_item_ref
 ) then raise exception 'Tipologia não pertence ao orçamento desta venda'; end if;
 if v_op<>'incluir' then
  select * into v_material from public.pacote_tecnico_materiais m
  where m.id=p_material and m.empresa_id=p_empresa and m.pacote_id=p_pacote
   and m.item_ref=p_item_ref and not m.excluido for update;
  if not found then raise exception 'Material ativo não pertence a esta tipologia'; end if;
  if v_material.status_compra in ('aprovado','pedido_emitido','aguardando_entrega','recebido') then
   raise exception 'Material já avançou nas compras; revise a compra antes de editar esta peça';
  end if;
  if exists(select 1 from public.pacote_tecnico_separacoes s
   where s.pacote_id=p_pacote and s.material_id=p_material and s.status<>'cancelado') then
   raise exception 'Material possui separação de estoque; cancele a separação antes de editar';
  end if;
  if exists(select 1 from public.ordens_producao op
   where op.venda_obra_id=p_venda and op.item_ref=p_item_ref
    and lower(coalesce(op.status,'')) not in ('cancelado','cancelada')) then
   raise exception 'Há ordem de produção desta tipologia; revise-a antes de editar os materiais';
  end if;
  if exists(select 1 from public.venda_cotacao_lotes l,
   lateral jsonb_array_elements(l.itens) i
   where l.empresa_id=p_empresa and l.venda_obra_id=p_venda and l.status<>'cancelado'
    and i->>'material_id'=p_material::text
    and coalesce(i->>'status_etapa',l.status) in ('comprado','entrega','recebido')) then
   raise exception 'Material avançou no Kanban de compras. Reverta essa etapa antes de editar';
  end if;
  v_antes:=to_jsonb(v_material);
 end if;
 if v_op in ('incluir','substituir','ajustar') then
  v_cat:=coalesce(nullif(trim(p_novo->>'categoria'),''),case when v_op='ajustar' then v_material.categoria else null end);
  if v_cat not in ('perfil','contramarco','acessorio','vidro','outro') then raise exception 'Categoria inválida'; end if;
  if v_op='ajustar' and v_cat<>v_material.categoria then raise exception 'Categoria não pode mudar em um ajuste; use Substituir'; end if;
  v_desc:=left(trim(coalesce(p_novo->>'descricao','')),500);
  if v_desc='' then raise exception 'Descrição obrigatória'; end if;
  v_un:=left(coalesce(nullif(trim(p_novo->>'unidade'),''),'UN'),30);
  v_cor:=nullif(left(trim(coalesce(p_novo->>'cor_ref','')),100),'');
  v_qty:=nullif(p_novo->>'quantidade_ajustada','')::numeric;
  if v_qty is null or v_qty<=0 or v_qty>1000000 then raise exception 'Quantidade inválida'; end if;
  v_corte:=nullif(p_novo->>'comprimento_corte_mm','')::numeric;
  v_barra:=nullif(p_novo->>'comprimento_barra_mm','')::numeric;
  if v_corte<0 or v_corte>30000 or v_barra<0 or v_barra>30000 then
   raise exception 'Comprimento fora do limite'; end if;
  v_produto_id:=nullif(p_novo->>'produto_id','')::uuid;
  v_codigo:=nullif(left(trim(coalesce(p_novo->>'codigo','')),100),'');
  if v_produto_id is not null then
   select id,codigo,nome,foto_url into v_produto from public.produtos
    where id=v_produto_id and empresa_id=p_empresa and ativo=true;
   if not found then raise exception 'Produto não encontrado no catálogo desta empresa'; end if;
   if v_codigo is not null and upper(v_codigo)<>upper(trim(coalesce(v_produto.codigo,''))) then
    raise exception 'Código informado não corresponde ao produto selecionado'; end if;
   v_codigo:=v_produto.codigo;
   if v_op<>'ajustar' and v_codigo is not null
    and nullif(trim(coalesce(v_produto.foto_url,'')),'') is null then
    raise exception 'O produto escolhido não possui desenho técnico cadastrado'; end if;
  elsif v_codigo is not null and v_op<>'ajustar' then
   raise exception 'Selecione o código no catálogo de produtos para manter o desenho correto';
  end if;
  if v_op<>'ajustar' and v_cat in ('perfil','contramarco') and v_produto_id is null then
   raise exception 'Para incluir ou substituir perfis, selecione um produto com desenho no catálogo';
  end if;
  if v_op='ajustar' and v_material.produto_id is distinct from v_produto_id then
   raise exception 'Para trocar de produto use Substituir, preservando o histórico';
  end if;
 end if;
 if v_op in ('substituir','excluir') then
  update public.pacote_tecnico_materiais set excluido=true,
   justificativa_ajuste=left(trim(p_motivo),1000),updated_at=now()
  where id=p_material and empresa_id=p_empresa;
 end if;
 if v_op='ajustar' then
  update public.pacote_tecnico_materiais set
   quantidade_ajustada=v_qty,cor_ref=v_cor,comprimento_corte_mm=v_corte,
   comprimento_barra_mm=v_barra,descricao=v_desc,unidade=v_un,
   status_calculo='manual',justificativa_ajuste=left(trim(p_motivo),1000),updated_at=now()
  where id=p_material and empresa_id=p_empresa;
  v_novo_id:=p_material;
 elsif v_op in ('incluir','substituir') then
  insert into public.pacote_tecnico_materiais(
   empresa_id,pacote_id,item_ref,categoria,produto_id,codigo,descricao,unidade,
   cor_ref,quantidade_tecnica,quantidade_ajustada,comprimento_corte_mm,comprimento_barra_mm,
   origem_calculo,status_calculo,incluido_manual,excluido,justificativa_ajuste,
   custo_wvetro,venda_wvetro,wvetro_dados,ordem)
  values(p_empresa,p_pacote,p_item_ref,v_cat,v_produto_id,v_codigo,v_desc,v_un,
   v_cor,0,v_qty,v_corte,v_barra,'manual_tipologia','manual',true,false,
   left(trim(p_motivo),1000),null,null,jsonb_build_object('origem','ajuste_atlas_tipologia'),
   coalesce((select max(ordem)+1 from public.pacote_tecnico_materiais
    where pacote_id=p_pacote and item_ref=p_item_ref),10000))
  returning id into v_novo_id;
 end if;
 if v_novo_id is not null then
  select to_jsonb(m) into v_depois from public.pacote_tecnico_materiais m where m.id=v_novo_id;
 end if;
 insert into public.venda_tipologia_materiais_historico(
  empresa_id,pacote_id,venda_obra_id,item_ref,material_id,material_novo_id,
  acao,antes,depois,justificativa,usuario_id,usuario_nome)
 values(p_empresa,p_pacote,p_venda,p_item_ref,p_material,v_novo_id,v_op,
  v_antes,v_depois,left(trim(p_motivo),1000),p_usuario,left(p_usuario_nome,150))
 returning id into v_historico_id;
 return jsonb_build_object('ok',true,'material_novo_id',v_novo_id,'historico_id',v_historico_id,
 'aviso','As listas de cotação e pedidos antigos permanecem intactos. Revalide compras e plano de corte antes da produção.');
end;
$$;
revoke execute on function public.fn_venda_tipologia_material_editar_v1(uuid,uuid,uuid,text,text,uuid,jsonb,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.fn_venda_tipologia_material_editar_v1(uuid,uuid,uuid,text,text,uuid,jsonb,text,uuid,text)
 to service_role;
