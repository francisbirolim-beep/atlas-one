-- Modulo de Medicao Final (dentro da Producao): quadro proprio, separado do
-- kanban generico de producao. Guarda cliente/endereco puxados do orcamento,
-- a lista de tipologias vendidas (uma linha por esquadria) e as medidas
-- reais tiradas na obra (3 larguras + 3 alturas, digitadas ou por foto da
-- trena). Campos extras por tipologia (ex: peitoril em janela) sao
-- configuraveis pelo master. Idempotente: pode rodar de novo sem erro.

create table if not exists medicao_colunas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

insert into medicao_colunas (nome, ordem)
select 'Aguardando medida final', 0
where not exists (select 1 from medicao_colunas);

insert into medicao_colunas (nome, ordem)
select 'Liberado para medir', 1
where (select count(*) from medicao_colunas) = 1;

create table if not exists medicoes_finais (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  orcamento_id uuid references orcamentos(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text not null,
  cliente_whatsapp text,
  endereco text,
  bairro text,
  cidade text,
  cep text,
  coluna_id uuid references medicao_colunas(id) on delete set null,
  coluna_atualizada_em timestamptz,
  criado_por_id uuid,
  criado_por_nome text
);

create table if not exists medicao_itens (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  tipo_esquadria text not null,
  tipo_outro_texto text,
  descricao text,
  quantidade integer not null default 1,
  ordem integer not null default 0,
  largura_baixo_mm numeric,
  largura_meio_mm numeric,
  largura_cima_mm numeric,
  altura_direita_mm numeric,
  altura_meio_mm numeric,
  altura_esquerda_mm numeric,
  foto_larguras_url text,
  foto_alturas_url text,
  campos_extras jsonb not null default '{}'::jsonb,
  medido boolean not null default false,
  medido_em timestamptz,
  medido_por_id uuid,
  medido_por_nome text
);

create table if not exists tipologia_campos_extras (
  id uuid primary key default gen_random_uuid(),
  tipo_esquadria text not null,
  chave text not null,
  nome text not null,
  tipo_valor text not null default 'numero',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

-- Exemplo padrao dado pelo usuario: janela/vitro precisa de altura de
-- peitoril, porta nao (ja fica no chao).
insert into tipologia_campos_extras (tipo_esquadria, chave, nome, tipo_valor, ordem)
select * from (values
  ('janela_correr', 'peitoril_mm', 'Altura do peitoril (mm)', 'numero', 0),
  ('janela_maximiar', 'peitoril_mm', 'Altura do peitoril (mm)', 'numero', 0),
  ('janela_basculante', 'peitoril_mm', 'Altura do peitoril (mm)', 'numero', 0),
  ('vitro', 'peitoril_mm', 'Altura do peitoril (mm)', 'numero', 0)
) as v(tipo_esquadria, chave, nome, tipo_valor, ordem)
where not exists (select 1 from tipologia_campos_extras);

-- Diferenca maxima (mm) entre a menor e a maior medida do mesmo grupo (3
-- larguras ou 3 alturas) antes de mostrar alerta pra conferir na hora da
-- medicao. Reaproveita a tabela generica configuracoes_gerais.
insert into configuracoes_gerais (chave, valor)
select 'medicao_alerta_diferenca_mm', '100'
where not exists (select 1 from configuracoes_gerais where chave = 'medicao_alerta_diferenca_mm');
