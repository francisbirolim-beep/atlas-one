-- Migration: linha_tipologias_produtos_biblioteca_tecnica_v1
-- Data: 2026-08-18
--
-- Objetivo: popular linha_tipologias e linha_produtos SOMENTE com vinculos
-- comprovados, sem inventar vinculo por semelhanca de nome e sem sobrescrever
-- nenhum dado existente.
--
-- Fontes usadas (rastreaveis ate W.Vetro, conforme regra do usuario):
--   1) tipologias.label ja contem o padrao "Modelo (Linha)" herdado da extracao
--      historica de dados reais do W.Vetro (1.038 vendas/orcamentos analisados).
--   2) produtos.dados_origem->>'linha_raw' preserva o campo "Linha" bruto de
--      ExportWWAcessorios.xlsx (fonte W.Vetro), sem alteracao.
--
-- Os 1.307 perfis de ExportWWPerfil (ExportWWPerfil (1)(1).xlsx) NAO possuem
-- campo de Linha na fonte original (somente fabricante_raw e nome livre), por
-- isso NAO sao tocados por esta migration -- vincula-los exigiria comparar por
-- semelhanca de nome, o que e proibido.
--
-- Regra de match: SOMENTE igualdade exata (case-insensitive, sem normalizacao
-- fonetica/fuzzy) contra linhas_tecnicas.nome ou algum item de
-- linhas_tecnicas.apelidos. Por isso REVESTIMENTO_RIPADO (apelidos "RIPADO" /
-- "REVESTIMENTO RIPADO") nao recebe nenhum vinculo automatico aqui: as
-- tipologias da fonte usam o token "Ripados" (plural), que nao e igual a
-- nenhum apelido cadastrado. Fica pendente de decisao humana.
--
-- Idempotente: nenhum INSERT duplica em reexecucao (PK composta + ON CONFLICT
-- DO NOTHING). Nao ha UPDATE nem DELETE em nenhuma tabela.
--
-- Efeito esperado (validado por SELECT read-only antes de escrever este
-- arquivo):
--   linha_tipologias: +46 (SUPREMA 23, GOLD 17, LINHA 30 5, PELE DE VIDRO /
--     FACHADA ATLANTA 1)
--   linha_produtos:   +8  (SUPREMA 2, GOLD 1, PELE DE VIDRO / FACHADA ATLANTA 5)

begin;

insert into linha_tipologias (linha_id, tipologia_id)
select lt.id, t.id
from tipologias t
join lateral (
  select substring(t.label from '\(([^)]+)\)\s*$') as linha_token
) x on true
join linhas_tecnicas lt on (
  x.linha_token is not null
  and (
    upper(x.linha_token) = upper(lt.nome)
    or upper(x.linha_token) = any (select upper(a) from unnest(lt.apelidos) as a)
  )
)
on conflict (linha_id, tipologia_id) do nothing;

insert into linha_produtos (linha_id, produto_id)
select lt.id, p.id
from produtos p
join linhas_tecnicas lt on (
  p.dados_origem ->> 'linha_raw' is not null
  and (
    upper(p.dados_origem ->> 'linha_raw') = upper(lt.nome)
    or upper(p.dados_origem ->> 'linha_raw') = any (select upper(a) from unnest(lt.apelidos) as a)
  )
)
on conflict (linha_id, produto_id) do nothing;

-- Pos-checks: garantem o estado minimo esperado. Usam limiares (>=) para nao
-- quebrar em reexecucao idempotente nem se novas linhas/tipologias/produtos
-- legitimos forem cadastrados depois com o mesmo padrao.
do $$
declare
  v_suprema_tipologias int;
  v_gold_tipologias int;
  v_linha30_tipologias int;
  v_atlanta_tipologias int;
  v_suprema_porta_correr_03 int;
  v_suprema_produtos int;
  v_gold_produtos int;
  v_atlanta_produtos int;
begin
  select count(*) into v_suprema_tipologias
    from linha_tipologias lti join linhas_tecnicas lt on lt.id = lti.linha_id
    where lt.chave = 'suprema';

  select count(*) into v_gold_tipologias
    from linha_tipologias lti join linhas_tecnicas lt on lt.id = lti.linha_id
    where lt.chave = 'gold';

  select count(*) into v_linha30_tipologias
    from linha_tipologias lti join linhas_tecnicas lt on lt.id = lti.linha_id
    where lt.chave = 'linha_30';

  select count(*) into v_atlanta_tipologias
    from linha_tipologias lti join linhas_tecnicas lt on lt.id = lti.linha_id
    where lt.chave = 'pele_de_vidro_atlanta';

  select count(*) into v_suprema_porta_correr_03
    from linha_tipologias lti
    join linhas_tecnicas lt on lt.id = lti.linha_id
    join tipologias t on t.id = lti.tipologia_id
    where lt.chave = 'suprema' and t.chave = 'l_suprema_porta_de_correr_03_folhas';

  select count(*) into v_suprema_produtos
    from linha_produtos lp join linhas_tecnicas lt on lt.id = lp.linha_id
    where lt.chave = 'suprema';

  select count(*) into v_gold_produtos
    from linha_produtos lp join linhas_tecnicas lt on lt.id = lp.linha_id
    where lt.chave = 'gold';

  select count(*) into v_atlanta_produtos
    from linha_produtos lp join linhas_tecnicas lt on lt.id = lp.linha_id
    where lt.chave = 'pele_de_vidro_atlanta';

  if v_suprema_tipologias < 23 then
    raise exception 'Gate falhou: esperado >=23 tipologias vinculadas a SUPREMA, encontrado %', v_suprema_tipologias;
  end if;

  if v_gold_tipologias < 17 then
    raise exception 'Gate falhou: esperado >=17 tipologias vinculadas a GOLD, encontrado %', v_gold_tipologias;
  end if;

  if v_linha30_tipologias < 5 then
    raise exception 'Gate falhou: esperado >=5 tipologias vinculadas a LINHA 30, encontrado %', v_linha30_tipologias;
  end if;

  if v_atlanta_tipologias < 1 then
    raise exception 'Gate falhou: esperado >=1 tipologia vinculada a PELE DE VIDRO / FACHADA ATLANTA, encontrado %', v_atlanta_tipologias;
  end if;

  if v_suprema_porta_correr_03 < 1 then
    raise exception 'Gate falhou: SUPREMA -> Porta de Correr 03 Folhas nao foi vinculada';
  end if;

  if v_suprema_produtos < 2 then
    raise exception 'Gate falhou: esperado >=2 produtos vinculados a SUPREMA, encontrado %', v_suprema_produtos;
  end if;

  if v_gold_produtos < 1 then
    raise exception 'Gate falhou: esperado >=1 produto vinculado a GOLD, encontrado %', v_gold_produtos;
  end if;

  if v_atlanta_produtos < 5 then
    raise exception 'Gate falhou: esperado >=5 produtos vinculados a PELE DE VIDRO / FACHADA ATLANTA, encontrado %', v_atlanta_produtos;
  end if;
end $$;

commit;
