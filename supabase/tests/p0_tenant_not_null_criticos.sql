begin;

do $$
declare
  v_faltando integer;
begin
  select count(*) into v_faltando
  from (values
    ('clientes'),('obras'),('orcamentos'),('vendas_obras'),('venda_obra_revisoes'),
    ('financeiro_contas_receber'),('financeiro_contas_pagar'),
    ('compras_necessidades'),('compras_cotacoes'),('compras_nfs'),('compras_nf_itens'),('compras_recebimentos'),
    ('estoque_saldos'),('estoque_reservas'),('estoque_movimentos'),
    ('medicoes_finais'),('medicao_itens'),('producao_itens'),
    ('setor_kanban_itens'),('setor_kanban_colunas')
  ) as t(table_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema='public'
      and c.table_name=t.table_name
      and c.column_name='empresa_id'
      and c.is_nullable='NO'
  );

  if v_faltando <> 0 then
    raise exception '% tabela(s) crítica(s) sem empresa_id NOT NULL', v_faltando;
  end if;
end $$;

rollback;
