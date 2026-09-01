insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'configuracoes_precificacao','configuracao_precificacao',id,1,'baseline',to_jsonb(c),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1'
from public.configuracoes_precificacao c
where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='configuracoes_precificacao' and h.entidade_id=c.id);

insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'tipologia_campos_extras','campo_extra_tipologia',id,1,'baseline',to_jsonb(c),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1'
from public.tipologia_campos_extras c
where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='tipologia_campos_extras' and h.entidade_id=c.id);

insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'engenharia_tipologia_variaveis','variavel_tipologia',id,1,'baseline',to_jsonb(v),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1'
from public.engenharia_tipologia_variaveis v
where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='engenharia_tipologia_variaveis' and h.entidade_id=v.id);

insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'estoque_locais','local_estoque',id,1,'baseline',to_jsonb(l),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1'
from public.estoque_locais l
where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='estoque_locais' and h.entidade_id=l.id);

insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_depois,campos_alterados,motivo,origem)
select 'estoque_enderecos','endereco_estoque',id,1,'baseline',to_jsonb(e),'{}','Estado inicial na ativação do histórico global','migracao_historico_v1'
from public.estoque_enderecos e
where not exists(select 1 from public.cadastro_historico h where h.entidade_tabela='estoque_enderecos' and h.entidade_id=e.id);

do $$ declare t text; begin
  foreach t in array array['configuracoes_precificacao','tipologia_campos_extras','engenharia_tipologia_variaveis','estoque_locais','estoque_enderecos'] loop
    execute format('drop trigger if exists trg_cadastro_historico_%I on public.%I',t,t);
    execute format('create trigger trg_cadastro_historico_%I after insert or update or delete on public.%I for each row execute function public.fn_cadastro_historico_append_v1()',t,t);
  end loop;
end $$;
