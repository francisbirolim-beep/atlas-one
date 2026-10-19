-- Complemento isolado: não altera estados, triggers ou fluxos existentes.
create table if not exists public.producao_kanban_pendencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  item_ref text not null,
  ordem_id uuid not null references public.ordens_producao(id) on delete cascade,
  motivo text not null check (char_length(trim(motivo)) between 5 and 1000),
  categoria text not null check (categoria in ('perfil','acessorio','vidro','fabricacao','outros')),
  status_anterior text not null,
  aberta_em timestamptz not null default now(),
  aberta_por uuid,
  resolvida_em timestamptz,
  resolvida_por uuid,
  resolucao text,
  check (resolvida_em is null or char_length(trim(coalesce(resolucao,''))) >= 5)
);
create unique index if not exists producao_kanban_pendencia_aberta_idx
  on public.producao_kanban_pendencias(empresa_id,ordem_id) where resolvida_em is null;
create index if not exists producao_kanban_pendencias_venda_idx
  on public.producao_kanban_pendencias(empresa_id,venda_obra_id,aberta_em desc);
alter table public.producao_kanban_pendencias enable row level security;
create policy producao_kanban_pendencias_select_tenant on public.producao_kanban_pendencias
  for select to authenticated using (empresa_id = (select private.current_empresa_id()));
-- Escrita exclusivamente no endpoint autenticado, para validar regras de transição.
revoke insert,update,delete on public.producao_kanban_pendencias from anon,authenticated;
create table if not exists public.producao_kanban_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  ordem_id uuid not null references public.ordens_producao(id) on delete cascade,
  item_ref text not null,
  de_status text not null,
  para_status text not null,
  detalhe text,
  usuario_id uuid,
  criado_em timestamptz not null default now()
);
create index if not exists producao_kanban_historico_venda_idx
  on public.producao_kanban_historico(empresa_id,venda_obra_id,criado_em desc);
alter table public.producao_kanban_historico enable row level security;
create policy producao_kanban_historico_select_tenant on public.producao_kanban_historico
  for select to authenticated using (empresa_id = (select private.current_empresa_id()));
revoke insert,update,delete on public.producao_kanban_historico from anon,authenticated;

-- Movimentações e histórico devem ser confirmados na mesma transação.
create or replace function public.fn_producao_kanban_movimentar_v1(
  p_empresa uuid,p_venda uuid,p_ref text,p_destino text,p_usuario uuid,
  p_motivo text default '',p_categoria text default 'outros',
  p_resolucao text default '',p_quantidade integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_ord record;
  v_pend record;
  v_total integer;
  v_de text;
  v_para text;
  v_indices integer[];
  v_prontas integer;
  v_quantidade integer;
  v_status text;
  v_motivo text:=trim(coalesce(p_motivo,''));
  v_resolucao text:=trim(coalesce(p_resolucao,''));
begin
  if p_empresa is null or p_venda is null or p_usuario is null or
     nullif(trim(coalesce(p_ref,'')),'') is null then
    raise exception 'Parâmetros incompletos para movimentação.';
  end if;
  if not exists(select 1 from public.vendas_obras v where v.empresa_id=p_empresa and v.id=p_venda) then
    raise exception 'Venda não localizada nesta empresa.';
  end if;
  select count(*) into v_total from public.ordens_producao o
    where o.empresa_id=p_empresa and o.venda_obra_id=p_venda
      and o.item_ref=p_ref and o.status<>'cancelada';
  if v_total<>1 then raise exception 'A tipologia precisa ter exatamente uma ordem ativa.'; end if;
  select o.* into v_ord from public.ordens_producao o
    where o.empresa_id=p_empresa and o.venda_obra_id=p_venda
      and o.item_ref=p_ref and o.status<>'cancelada' for update;
  select q.* into v_pend from public.producao_kanban_pendencias q
    where q.empresa_id=p_empresa and q.ordem_id=v_ord.id and q.resolvida_em is null for update;
  v_de:=case when v_pend.id is not null then 'pendente' else v_ord.status end;
  if p_destino=v_de then return jsonb_build_object('ok',true,'semAlteracao',true,'etapa',v_de); end if;
  if v_ord.bloqueada or v_ord.status='aguardando' then
    raise exception 'Produção bloqueada até aprovação técnica e liberação da Medição Final.';
  end if;
  if v_ord.status='concluida' then raise exception 'Ordem concluída: reabertura exige revisão técnica.'; end if;
  if p_destino='pendente' then
    if v_pend.id is not null then raise exception 'Já existe uma pendência em aberto.'; end if;
    if v_ord.status not in ('liberada','em_producao','conferencia') then raise exception 'Etapa inválida para pendência.'; end if;
    if length(v_motivo)<5 or length(v_motivo)>1000 or
       p_categoria not in ('perfil','acessorio','vidro','fabricacao','outros') then
      raise exception 'Informe uma categoria e justificativa de 5 a 1000 caracteres.';
    end if;
    insert into public.producao_kanban_pendencias
      (empresa_id,venda_obra_id,item_ref,ordem_id,motivo,categoria,status_anterior,aberta_por)
      values(p_empresa,p_venda,p_ref,v_ord.id,v_motivo,p_categoria,v_ord.status,p_usuario);
    v_para:='pendente';
  elsif v_pend.id is not null then
    if p_destino <> (case when v_ord.status='liberada' then 'liberada' else 'em_producao' end) then
      raise exception 'Resolva a pendência retornando à etapa anterior.';
    end if;
    if length(v_resolucao)<5 or length(v_resolucao)>1000 then
      raise exception 'Informe como a pendência foi resolvida (5 a 1000 caracteres).';
    end if;
    update public.producao_kanban_pendencias
      set resolvida_em=now(),resolvida_por=p_usuario,resolucao=v_resolucao
      where id=v_pend.id and empresa_id=p_empresa and resolvida_em is null;
    v_para:=p_destino;
  elsif p_destino='em_producao' and v_ord.status='liberada' then
    update public.ordens_producao set status='em_producao'
      where id=v_ord.id and empresa_id=p_empresa;
    v_para:='em_producao';
  elsif p_destino='conferencia' and v_ord.status='em_producao' then
    update public.ordens_producao set status='conferencia'
      where id=v_ord.id and empresa_id=p_empresa;
    v_para:='conferencia';
  elsif p_destino='concluida' and v_ord.status='conferencia' then
    if p_quantidade is null or p_quantidade<1 or p_quantidade>300 then
      raise exception 'Informe a quantidade de unidades conferidas (1 a 300).';
    end if;
    if v_ord.quantidade<>trunc(v_ord.quantidade) or v_ord.quantidade<1 or v_ord.quantidade>300 then
      raise exception 'Quantidade original inválida para conferência individual.';
    end if;
    select array_agg(g.i order by g.i) into v_indices
    from (select i from generate_series(1,v_ord.quantidade::integer) i
      where not exists (select 1 from public.ordens_producao_unidades u
        where u.ordem_id=v_ord.id and u.empresa_id=p_empresa and u.indice=i and u.status='produzida')
      order by i limit p_quantidade) g;
    if coalesce(cardinality(v_indices),0)<>p_quantidade then
      raise exception 'Quantidade solicitada supera unidades restantes.';
    end if;
    select max(t.produzidas),max(t.quantidade),max(t.ordem_status)
      into v_prontas,v_quantidade,v_status
      from public.fn_marcar_producao_unidades_v1(p_empresa,v_ord.id,v_indices,p_usuario,'Kanban da Produção') t;
    v_para:=case when v_status='concluida' then 'concluida' else 'conferencia' end;
  else
    raise exception 'Transição não permitida: libere a produção e conclua pela conferência de unidades.';
  end if;
  insert into public.producao_kanban_historico
    (empresa_id,venda_obra_id,ordem_id,item_ref,de_status,para_status,detalhe,usuario_id)
    values(p_empresa,p_venda,v_ord.id,p_ref,v_de,v_para,
      case when p_destino='pendente' then v_motivo
           when v_pend.id is not null then v_resolucao
           when p_destino='concluida' then p_quantidade::text||' unidade(s) conferida(s)'
           else null end,p_usuario);
  return jsonb_build_object('ok',true,'etapa',v_para,'produzidas',v_prontas,'quantidade',v_quantidade);
end; $$;
revoke all on function public.fn_producao_kanban_movimentar_v1(uuid,uuid,text,text,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.fn_producao_kanban_movimentar_v1(uuid,uuid,text,text,uuid,text,text,text,integer) to service_role;