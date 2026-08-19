-- Migration: configuracoes_composicao_folhas_imagem_v1
-- Data: 2026-08-18
--
-- Objetivo:
-- 1) adicionar imagem_url às configurações validadas do orçamento;
-- 2) cadastrar variáveis estruturadas de composição por folha;
-- 3) cadastrar opções VIDRO / PERSIANA / TELA para cada posição;
-- 4) vincular as posições corretas somente às tipologias L. Suprema >
--    Janela de Correr 02/03/04/06 folhas já comprovadas no banco.
--
-- Regras de segurança:
-- - aditiva e idempotente;
-- - nenhuma configuração real é criada/validada automaticamente;
-- - nenhum produto, receita ou fórmula é inferido;
-- - joins por tipologias.chave, nunca por UUID fixo;
-- - composição é variável declarativa e inicialmente opcional
--   (obrigatorio = false), conforme decisão validada pelo usuário.

begin;

alter table public.engenharia_variaveis_preset
  add column if not exists imagem_url text;

comment on column public.engenharia_variaveis_preset.imagem_url is
  'URL do desenho técnico/foto da configuração, exibido no card do seletor de orçamento.';

insert into public.engenharia_variaveis (chave, label, ordem) values
  ('composicao_folha_1', 'Composição da folha 1', 101),
  ('composicao_folha_2', 'Composição da folha 2', 102),
  ('composicao_folha_3', 'Composição da folha 3', 103),
  ('composicao_folha_4', 'Composição da folha 4', 104),
  ('composicao_folha_5', 'Composição da folha 5', 105),
  ('composicao_folha_6', 'Composição da folha 6', 106)
on conflict (chave) do nothing;

insert into public.engenharia_variavel_opcoes (variavel_id, chave, label, ordem)
select v.id, o.chave, o.label, o.ordem
from public.engenharia_variaveis v
join (values
  ('composicao_folha_1', 'vidro', 'Vidro', 1),
  ('composicao_folha_1', 'persiana', 'Persiana', 2),
  ('composicao_folha_1', 'tela', 'Tela', 3),
  ('composicao_folha_2', 'vidro', 'Vidro', 1),
  ('composicao_folha_2', 'persiana', 'Persiana', 2),
  ('composicao_folha_2', 'tela', 'Tela', 3),
  ('composicao_folha_3', 'vidro', 'Vidro', 1),
  ('composicao_folha_3', 'persiana', 'Persiana', 2),
  ('composicao_folha_3', 'tela', 'Tela', 3),
  ('composicao_folha_4', 'vidro', 'Vidro', 1),
  ('composicao_folha_4', 'persiana', 'Persiana', 2),
  ('composicao_folha_4', 'tela', 'Tela', 3),
  ('composicao_folha_5', 'vidro', 'Vidro', 1),
  ('composicao_folha_5', 'persiana', 'Persiana', 2),
  ('composicao_folha_5', 'tela', 'Tela', 3),
  ('composicao_folha_6', 'vidro', 'Vidro', 1),
  ('composicao_folha_6', 'persiana', 'Persiana', 2),
  ('composicao_folha_6', 'tela', 'Tela', 3)
) as o(variavel_chave, chave, label, ordem)
  on o.variavel_chave = v.chave
on conflict (variavel_id, chave) do nothing;

with alvo(tipologia_chave, max_folhas) as (
  values
    ('l_suprema_janela_de_correr_02_folhas', 2),
    ('l_suprema_janela_de_correr_03_folhas', 3),
    ('l_suprema_janela_de_correr_04_folhas', 4),
    ('l_suprema_janela_de_correr_06_folhas', 6)
), composicoes as (
  select
    v.id as variavel_id,
    substring(v.chave from 'composicao_folha_([0-9]+)$')::int as posicao
  from public.engenharia_variaveis v
  where v.chave ~ '^composicao_folha_[1-6]$'
)
insert into public.engenharia_tipologia_variaveis (
  tipologia_id,
  variavel_id,
  ordem,
  obrigatorio
)
select
  t.id,
  c.variavel_id,
  100 + c.posicao,
  false
from alvo a
join public.tipologias t on t.chave = a.tipologia_chave
join composicoes c on c.posicao <= a.max_folhas
on conflict (tipologia_id, variavel_id) do nothing;

do $$
declare
  v_variaveis int;
  v_opcoes int;
  v_tipologias int;
  v_vinculos int;
begin
  select count(*) into v_variaveis
  from public.engenharia_variaveis
  where chave in (
    'composicao_folha_1','composicao_folha_2','composicao_folha_3',
    'composicao_folha_4','composicao_folha_5','composicao_folha_6'
  );

  select count(*) into v_opcoes
  from public.engenharia_variavel_opcoes o
  join public.engenharia_variaveis v on v.id = o.variavel_id
  where v.chave in (
    'composicao_folha_1','composicao_folha_2','composicao_folha_3',
    'composicao_folha_4','composicao_folha_5','composicao_folha_6'
  ) and o.chave in ('vidro','persiana','tela');

  select count(*) into v_tipologias
  from public.tipologias
  where chave in (
    'l_suprema_janela_de_correr_02_folhas',
    'l_suprema_janela_de_correr_03_folhas',
    'l_suprema_janela_de_correr_04_folhas',
    'l_suprema_janela_de_correr_06_folhas'
  );

  select count(*) into v_vinculos
  from public.engenharia_tipologia_variaveis etv
  join public.tipologias t on t.id = etv.tipologia_id
  join public.engenharia_variaveis v on v.id = etv.variavel_id
  where t.chave in (
    'l_suprema_janela_de_correr_02_folhas',
    'l_suprema_janela_de_correr_03_folhas',
    'l_suprema_janela_de_correr_04_folhas',
    'l_suprema_janela_de_correr_06_folhas'
  ) and v.chave ~ '^composicao_folha_[1-6]$';

  if v_variaveis <> 6 then
    raise exception 'Gate falhou: esperado 6 variaveis de composicao, encontrado %', v_variaveis;
  end if;
  if v_opcoes <> 18 then
    raise exception 'Gate falhou: esperado 18 opcoes de composicao, encontrado %', v_opcoes;
  end if;
  if v_tipologias <> 4 then
    raise exception 'Gate falhou: esperado 4 tipologias L. Suprema alvo, encontrado %', v_tipologias;
  end if;
  if v_vinculos < 15 then
    raise exception 'Gate falhou: esperado >=15 vinculos de composicao, encontrado %', v_vinculos;
  end if;
end $$;

commit;
