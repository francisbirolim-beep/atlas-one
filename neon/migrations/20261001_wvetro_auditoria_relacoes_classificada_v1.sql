create or replace view wvetro_migracao.auditoria_relacoes_classificada as
select
  a.*,
  case
    when a.encontrado then 'encontrada'
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id'
      then 'historico_fora_endpoint_atual'
    when a.origem_recurso = 'instalacoes'
      and a.tipo_relacao = 'projeto_producao'
      then 'historico_fora_endpoint_producao'
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado'
      then 'observacional_sem_destino'
    when a.referencia is null
      or btrim(a.referencia) = ''
      or btrim(a.referencia) = '0'
      then 'referencia_sentinela'
    when a.tipo_relacao in ('orcamento_declarado','orcamento_origem')
      then 'orcamento_ausente_staging'
    else 'revisao_manual'
  end as classificacao,
  case
    when a.encontrado then 'nenhuma'
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id'
      then 'manter_historico_isolado'
    when a.origem_recurso = 'instalacoes'
      and a.tipo_relacao = 'projeto_producao'
      then 'usar_lote_como_evidencia_historica'
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado'
      then 'nao_criar_vinculo_por_numero'
    when a.referencia is null
      or btrim(a.referencia) = ''
      or btrim(a.referencia) = '0'
      then 'ignorar_referencia'
    when a.tipo_relacao in ('orcamento_declarado','orcamento_origem')
      then 'recapturar_orcamento_ou_manter_historico_isolado'
    else 'revisar_manualmente'
  end as acao_recomendada,
  case
    when a.encontrado then false
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id' then false
    when a.origem_recurso = 'instalacoes'
      and a.tipo_relacao = 'projeto_producao' then false
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado' then false
    when a.referencia is null
      or btrim(a.referencia) = ''
      or btrim(a.referencia) = '0' then false
    when a.tipo_relacao in ('orcamento_declarado','orcamento_origem') then true
    else true
  end as bloqueia_promocao_relacional
from wvetro_migracao.auditoria_relacoes a;

revoke all on wvetro_migracao.auditoria_relacoes_classificada from public;
