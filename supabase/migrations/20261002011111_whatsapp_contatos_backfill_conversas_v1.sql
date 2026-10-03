-- Semeia o diretório com os contatos de chats reais já conhecidos pelo Atlas.
insert into public.atendimento_whatsapp_contatos (
  empresa_id,
  whatsapp_canal_id,
  contato_jid,
  telefone,
  nome,
  ativo,
  sincronizado_em,
  updated_at
)
select distinct on (empresa_id, whatsapp_canal_id, telefone_normalizado)
  empresa_id,
  whatsapp_canal_id,
  telefone_normalizado || '@s.whatsapp.net',
  telefone_normalizado,
  contato_nome,
  true,
  now(),
  now()
from (
  select
    c.empresa_id,
    c.whatsapp_canal_id,
    c.contato_nome,
    case
      when regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g') like '55%'
        then regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g')
      else '55' || regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g')
    end as telefone_normalizado,
    c.ultima_mensagem_em
  from public.atendimento_conversas c
  where c.canal = 'whatsapp'
    and c.whatsapp_canal_id is not null
    and coalesce(c.ocultar_da_caixa, false) = false
    and coalesce(c.whatsapp_chat_tipo, 'contato') = 'contato'
    and length(regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g')) between 10 and 13
) base
order by empresa_id, whatsapp_canal_id, telefone_normalizado, ultima_mensagem_em desc nulls last
on conflict (empresa_id, whatsapp_canal_id, contato_jid) do update set
  telefone = excluded.telefone,
  nome = coalesce(excluded.nome, public.atendimento_whatsapp_contatos.nome),
  ativo = true,
  sincronizado_em = now(),
  updated_at = now();
