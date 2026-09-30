-- Atlas One — leitura canônica do staging W.Vetro
-- Preserva wvetro_migracao.raw imutável e corrige chaves lógicas para consumo futuro.

create or replace view wvetro_migracao.raw_canonico as
with normalizado as (
  select
    r.*,
    case
      when r.recurso = 'producao_projeto'
       and nullif(r.payload->>'loteId', '') is not null
       and nullif(r.payload->>'id', '') is not null
        then 'producao-projeto:' || (r.payload->>'loteId') || ':' || (r.payload->>'id')
      else r.chave_externa
    end as chave_externa_canonica
  from wvetro_migracao.raw r
),
sem_copia_identica as (
  select
    n.*,
    row_number() over (
      partition by n.recurso, n.chave_externa_canonica, n.payload_hash
      order by n.capturado_em desc, n.id desc
    ) as rn_hash
  from normalizado n
),
versionado as (
  select
    s.*,
    row_number() over (
      partition by s.recurso, s.chave_externa_canonica
      order by s.capturado_em asc, s.id asc
    ) as versao_canonica
  from sem_copia_identica s
  where s.rn_hash = 1
)
select
  id,
  execucao_id,
  recurso,
  chave_externa as chave_externa_original,
  chave_externa_canonica,
  versao as versao_origem,
  versao_canonica,
  data_referencia,
  payload,
  payload_hash,
  capturado_em,
  created_at
from versionado;

comment on view wvetro_migracao.raw_canonico is
  'Leitura canônica e não destrutiva do staging W.Vetro; corrige chaves compostas e elimina cópias logicamente idênticas.';

revoke all on wvetro_migracao.raw_canonico from public;
