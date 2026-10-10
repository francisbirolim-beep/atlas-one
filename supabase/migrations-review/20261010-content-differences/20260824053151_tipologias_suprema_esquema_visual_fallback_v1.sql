-- Fallback visual para tipologias da Linha Suprema que ainda nao possuem foto real.
--
-- O objetivo e evitar cards vazios no Orcamento enquanto as imagens originais
-- do W.Vetro nao forem sincronizadas. O SVG e apenas um esquema frontal Atlas,
-- gerado a partir do nome da tipologia. Nao representa validacao de receita.
--
-- Regra de seguranca:
-- - nunca sobrescreve foto_url existente;
-- - preserva a Porta de Correr 03 Folhas, que ja possui imagens validadas no codigo;
-- - uma futura sincronizacao de imagem real deve poder substituir somente estes
--   fallbacks data:image/svg+xml;base64, sem sobrescrever foto Atlas real.

with suprema as (
  select t.id,t.label,
         greatest(1,least(9,coalesce(((regexp_match(t.label,'([0-9]{1,2})\s*Folh','i'))[1])::int,1))) as folhas,
         lower(t.label) as ll
  from public.tipologias t
  join public.linha_tipologias lt on lt.tipologia_id=t.id
  join public.linhas_tecnicas l on l.id=lt.linha_id
  where upper(l.nome)='SUPREMA'
    and t.foto_url is null
    and t.label <> 'Porta De Correr 03 Folhas (L. Suprema)'
), desenhos as (
  select s.*,
    case
      when ll like '%correr%' then (
        select string_agg(
          format('<rect x="%s" y="22" width="%s" height="76" rx="1"/><line x1="%s" y1="22" x2="%s" y2="98"/>%s',
            18 + (i-1)*(144.0/s.folhas),
            144.0/s.folhas,
            18 + (i-1)*(144.0/s.folhas),
            18 + (i-1)*(144.0/s.folhas),
            case when mod(i,2)=1
              then format('<path d="M %s 60 H %s M %s 56 L %s 60 L %s 64"/>', 24+(i-1)*(144.0/s.folhas), 12+i*(144.0/s.folhas), 7+i*(144.0/s.folhas), 12+i*(144.0/s.folhas), 7+i*(144.0/s.folhas))
              else format('<path d="M %s 60 H %s M %s 56 L %s 60 L %s 64"/>', 12+i*(144.0/s.folhas), 24+(i-1)*(144.0/s.folhas), 29+(i-1)*(144.0/s.folhas), 24+(i-1)*(144.0/s.folhas), 29+(i-1)*(144.0/s.folhas))
            end
          ), '' order by i)
        from generate_series(1,s.folhas) i
      )
      when ll like '%maxim%' then '<rect x="28" y="28" width="124" height="62"/><path d="M 28 28 L 90 88 L 152 28"/><path d="M 82 36 L 90 28 L 98 36"/>'
      when ll like '%basculante%' then '<rect x="28" y="28" width="124" height="62"/><line x1="28" y1="59" x2="152" y2="59"/><path d="M 36 51 L 90 74 L 144 51"/>'
      when ll like '%guilhotina%' then '<rect x="28" y="20" width="124" height="78"/><line x1="28" y1="59" x2="152" y2="59"/><path d="M 82 82 L 90 72 L 98 82"/>'
      when ll like '%pivotante%' then '<rect x="28" y="12" width="124" height="92"/><line x1="90" y1="12" x2="90" y2="104" stroke-dasharray="4 3"/><path d="M 90 20 L 140 32 L 140 84 L 90 96 Z"/><circle cx="90" cy="58" r="3" fill="#64748b"/>'
      when ll like '%giro%' or ll like '%vai e vem%' then '<rect x="28" y="12" width="124" height="92"/><line x1="90" y1="12" x2="90" y2="104"/><path d="M 32 16 L 62 58 L 32 100 M 148 16 L 118 58 L 148 100"/>'
      when ll like '%camarao%' then '<rect x="20" y="18" width="140" height="82"/><polyline points="28,92 52,28 76,92 100,28 124,92 152,28"/>'
      when ll like '%fixo%' then '<rect x="28" y="22" width="124" height="76"/><line x1="34" y1="28" x2="146" y2="92" opacity=".35"/><line x1="146" y1="28" x2="34" y2="92" opacity=".35"/>'
      else '<rect x="28" y="18" width="124" height="82"/>'
    end as miolo
  from suprema s
), svg as (
  select id,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 130"><rect width="180" height="130" rx="8" fill="white"/><g fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="8" width="152" height="98" rx="3"/>' || miolo || '</g><text x="90" y="121" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" fill="#94a3b8">ESQUEMA ATLAS</text></svg>' as conteudo
  from desenhos
)
update public.tipologias t
set foto_url = 'data:image/svg+xml;base64,' || replace(encode(convert_to(svg.conteudo,'UTF8'),'base64'), E'\n','')
from svg
where t.id=svg.id and t.foto_url is null;
