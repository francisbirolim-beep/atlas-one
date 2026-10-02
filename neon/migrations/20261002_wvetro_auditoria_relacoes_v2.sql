create or replace view wvetro_migracao.auditoria_relacoes as
with orcamentos as (
  select
    payload->>'Nro' as nro,
    chave_externa_canonica as chave
  from wvetro_migracao.raw_canonico
  where recurso = 'orcamentos'
),
lotes as (
  select
    payload->>'id' as lote_id,
    chave_externa_canonica as chave
  from wvetro_migracao.raw_canonico
  where recurso = 'lotes_producao'
),
producao as (
  select
    payload->>'loteId' as lote_id,
    payload->>'id' as projeto_id,
    payload->>'orcamento' as orcamento,
    chave_externa_canonica as chave
  from wvetro_migracao.raw_canonico
  where recurso = 'producao_projeto'
),
lote_projetos as (
  select
    l.chave_externa_canonica as lote_chave,
    l.payload->>'id' as lote_id,
    p->>'id' as projeto_id,
    p->>'orcamento' as orcamento
  from wvetro_migracao.raw_canonico l
  cross join lateral jsonb_array_elements(coalesce(l.payload->'projetos','[]'::jsonb)) p
  where l.recurso = 'lotes_producao'
),
instalacao_projetos as (
  select
    i.chave_externa_canonica as instalacao_chave,
    p->>'loteId' as lote_id,
    p->>'loteProjetoId' as projeto_id,
    p->>'orcamento' as orcamento
  from wvetro_migracao.raw_canonico i
  cross join lateral jsonb_array_elements(coalesce(i.payload->'Projetos','[]'::jsonb)) p
  where i.recurso = 'instalacoes'
),
titulos_orcamento as (
  select
    t.chave_externa_canonica as titulo_chave,
    coalesce(
      (regexp_match(coalesce(t.payload->>'TituloOrigem',''), '(?i)OR[ÇC]AMENTO\s*([0-9]+)'))[1],
      (regexp_match(coalesce(t.payload->>'TituloOrigem',''), '(?i)ORC:\s*([0-9]+)'))[1]
    ) as orcamento
  from wvetro_migracao.raw_canonico t
  where t.recurso = 'titulos'
),
pedidos as (
  select
    chave_externa_canonica as pedido_chave,
    payload->>'Nro' as nro
  from wvetro_migracao.raw_canonico
  where recurso = 'pedidos'
),
baixas as (
  select
    chave_externa_canonica as baixa_chave,
    payload->>'TituloId' as titulo_id
  from wvetro_migracao.raw_canonico
  where recurso = 'titulos_baixados'
),
titulos as (
  select
    chave_externa_canonica as titulo_chave,
    payload->>'TituloId' as titulo_id
  from wvetro_migracao.raw_canonico
  where recurso = 'titulos'
)
select
  'producao_projeto'::text as origem_recurso,
  pr.chave::text as origem_chave,
  'lote_producao'::text as tipo_relacao,
  'lotes_producao'::text as destino_recurso,
  coalesce(l.chave, 'lote:' || coalesce(pr.lote_id,''))::text as destino_chave,
  pr.lote_id::text as referencia,
  (l.chave is not null) as encontrado,
  'forte'::text as confianca,
  'lote_id_declarado_producao'::text as regra
from producao pr
left join lotes l on l.lote_id = pr.lote_id

union all

select
  'lotes_producao',
  lp.lote_chave || ':projeto:' || coalesce(lp.projeto_id,''),
  'orcamento_declarado',
  'orcamentos',
  coalesce(o.chave, 'orcamento:' || coalesce(lp.orcamento,'')),
  lp.orcamento,
  (o.chave is not null),
  'declarada_payload',
  'orcamento_declarado_projeto_lote'
from lote_projetos lp
left join orcamentos o on o.nro = lp.orcamento

union all

select
  'producao_projeto',
  pr.chave,
  'orcamento_declarado',
  'orcamentos',
  coalesce(o.chave, 'orcamento:' || coalesce(pr.orcamento,'')),
  pr.orcamento,
  (o.chave is not null),
  'declarada_payload',
  'orcamento_declarado_producao'
from producao pr
left join orcamentos o on o.nro = pr.orcamento

union all

select
  'instalacoes',
  ip.instalacao_chave || ':lote:' || coalesce(ip.lote_id,'') || ':projeto:' || coalesce(ip.projeto_id,''),
  'lote_producao',
  'lotes_producao',
  coalesce(l.chave, 'lote:' || coalesce(ip.lote_id,'')),
  ip.lote_id,
  (l.chave is not null),
  'forte',
  'lote_id_declarado_instalacao'
from instalacao_projetos ip
left join lotes l on l.lote_id = ip.lote_id

union all

select
  'instalacoes',
  ip.instalacao_chave || ':lote:' || coalesce(ip.lote_id,'') || ':projeto:' || coalesce(ip.projeto_id,''),
  'projeto_producao',
  'producao_projeto',
  coalesce(
    pr.chave,
    lp.lote_chave || ':projeto:' || coalesce(lp.projeto_id,''),
    'producao-projeto:' || coalesce(ip.lote_id,'') || ':' || coalesce(ip.projeto_id,'')
  ),
  concat_ws(':', ip.lote_id, ip.projeto_id),
  (pr.chave is not null or lp.projeto_id is not null),
  'forte',
  case
    when pr.chave is not null then 'lote_id_projeto_id_instalacao'
    when lp.projeto_id is not null then 'fallback_projeto_embutido_lote'
    else 'lote_id_projeto_id_instalacao'
  end
from instalacao_projetos ip
left join producao pr
  on pr.lote_id = ip.lote_id
 and pr.projeto_id = ip.projeto_id
left join lote_projetos lp
  on lp.lote_id = ip.lote_id
 and lp.projeto_id = ip.projeto_id

union all

select
  'instalacoes',
  ip.instalacao_chave || ':lote:' || coalesce(ip.lote_id,'') || ':projeto:' || coalesce(ip.projeto_id,''),
  'orcamento_declarado',
  'orcamentos',
  coalesce(o.chave, 'orcamento:' || coalesce(ip.orcamento,'')),
  ip.orcamento,
  (o.chave is not null),
  'declarada_payload',
  'orcamento_declarado_instalacao'
from instalacao_projetos ip
left join orcamentos o on o.nro = ip.orcamento

union all

select
  'titulos',
  t.titulo_chave,
  'orcamento_origem',
  'orcamentos',
  coalesce(o.chave, 'orcamento:' || coalesce(t.orcamento,'')),
  t.orcamento,
  (o.chave is not null),
  'documental',
  'numero_extraido_titulo_origem'
from titulos_orcamento t
left join orcamentos o on o.nro = t.orcamento
where t.orcamento is not null

union all

select
  'titulos_baixados',
  b.baixa_chave,
  'titulo_mesmo_id',
  'titulos',
  coalesce(t.titulo_chave, 'titulo:' || coalesce(b.titulo_id,'')),
  b.titulo_id,
  (t.titulo_chave is not null),
  'forte',
  'titulo_id_identico_baixa'
from baixas b
left join titulos t on t.titulo_id = b.titulo_id

union all

select
  'pedidos',
  p.pedido_chave,
  'numero_compartilhado',
  'orcamentos',
  coalesce(o.chave, 'orcamento:' || coalesce(p.nro,'')),
  p.nro,
  (o.chave is not null),
  'observacional',
  'numero_compartilhado_observacional'
from pedidos p
left join orcamentos o on o.nro = p.nro;

revoke all on wvetro_migracao.auditoria_relacoes from public;


create or replace view wvetro_migracao.auditoria_relacoes_classificada as
select
  a.*,
  case
    when a.encontrado then 'resolvida'
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id'
      then 'historico_baixado_sem_titulo_atual'
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado'
      then 'historico_observacional_sem_orcamento'
    when a.tipo_relacao = 'orcamento_declarado'
      and coalesce(a.referencia,'') = '0'
      then 'placeholder_sem_orcamento'
    when a.tipo_relacao in ('orcamento_declarado','orcamento_origem')
      then 'referencia_orcamento_nao_presente_staging'
    else 'revisao_manual'
  end as classificacao,
  case
    when a.encontrado then 'nenhuma'
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id'
      then 'manter_como_historico'
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado'
      then 'manter_como_historico'
    when a.tipo_relacao = 'orcamento_declarado'
      and coalesce(a.referencia,'') = '0'
      then 'ignorar_referencia_zero'
    when a.tipo_relacao in ('orcamento_declarado','orcamento_origem')
      then 'revisar_somente_antes_de_promocao'
    else 'revisar'
  end as acao_recomendada,
  case
    when a.encontrado then false
    when a.origem_recurso = 'titulos_baixados'
      and a.tipo_relacao = 'titulo_mesmo_id'
      then false
    when a.origem_recurso = 'pedidos'
      and a.tipo_relacao = 'numero_compartilhado'
      then false
    when a.tipo_relacao = 'orcamento_declarado'
      and coalesce(a.referencia,'') = '0'
      then false
    else true
  end as bloqueia_promocao_automatica
from wvetro_migracao.auditoria_relacoes a;

revoke all on wvetro_migracao.auditoria_relacoes_classificada from public;
