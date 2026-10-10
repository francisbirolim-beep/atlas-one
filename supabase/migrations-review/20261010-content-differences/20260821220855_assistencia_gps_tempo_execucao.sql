-- Atlas One — Assistência em campo com GPS e contagem de tempo
-- Campos opcionais: a localização só é gravada quando o técnico autoriza o navegador.

alter table public.assistencias
  add column if not exists atendimento_iniciado_em timestamptz,
  add column if not exists duracao_atendimento_segundos integer,
  add column if not exists gps_inicio_latitude double precision,
  add column if not exists gps_inicio_longitude double precision,
  add column if not exists gps_inicio_precisao_m double precision,
  add column if not exists gps_inicio_capturado_em timestamptz,
  add column if not exists gps_fim_latitude double precision,
  add column if not exists gps_fim_longitude double precision,
  add column if not exists gps_fim_precisao_m double precision,
  add column if not exists gps_fim_capturado_em timestamptz;

comment on column public.assistencias.atendimento_iniciado_em is
  'Horario de inicio do atendimento em campo acionado pelo tecnico.';
comment on column public.assistencias.duracao_atendimento_segundos is
  'Duracao calculada entre inicio e conclusao do atendimento em campo.';
comment on column public.assistencias.gps_inicio_latitude is
  'Latitude capturada com permissao do tecnico ao iniciar o atendimento.';
comment on column public.assistencias.gps_inicio_longitude is
  'Longitude capturada com permissao do tecnico ao iniciar o atendimento.';
comment on column public.assistencias.gps_inicio_precisao_m is
  'Precisao estimada em metros da localizacao de inicio.';
comment on column public.assistencias.gps_fim_latitude is
  'Latitude capturada com permissao do tecnico ao concluir o atendimento.';
comment on column public.assistencias.gps_fim_longitude is
  'Longitude capturada com permissao do tecnico ao concluir o atendimento.';
comment on column public.assistencias.gps_fim_precisao_m is
  'Precisao estimada em metros da localizacao de conclusao.';
