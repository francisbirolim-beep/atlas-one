-- Atlas One v7: tipo de medida no orçamento detalhado + número/bairro na assistência

alter table orcamentos add column if not exists tipo_medida text; -- comum, final

alter table assistencias add column if not exists numero text;
alter table assistencias add column if not exists bairro text;
