-- Disponibilidade técnica por linha/tipologia no Editor Técnico.
-- Inativar não apaga cadastros nem histórico; apenas retira a opção dos fluxos ativos.

alter table public.tipologias
  add column if not exists ativo boolean not null default true;

-- As tipologias PC8/PC9 Suprema foram criadas pelo editor de fórmulas sem vínculo
-- comercial em linha_tipologias. Agora que o editor navega Linha -> Tipologia,
-- vinculamos essas tipologias à Linha Suprema por chave, sem IDs fixos.
insert into public.linha_tipologias (linha_id, tipologia_id)
select l.id, t.id
from public.linhas_tecnicas l
join public.tipologias t
  on t.chave in (
    'l_suprema_porta_de_correr_08_folhas',
    'l_suprema_porta_de_correr_09_folhas'
  )
where l.chave = 'suprema'
  and not exists (
    select 1
    from public.linha_tipologias lt
    where lt.linha_id = l.id
      and lt.tipologia_id = t.id
  );
