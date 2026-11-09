create or replace function public.atendimento_whatsapp_registrar_mensagem_orcamento(
  p_empresa_id uuid,
  p_automacao_id uuid,
  p_grupo_id uuid,
  p_conversa_id uuid,
  p_participante_jid text,
  p_participante_telefone text,
  p_participante_nome text,
  p_mensagem_id text,
  p_raw_line text,
  p_anexo jsonb,
  p_now timestamptz,
  p_cutoff timestamptz,
  p_criar_se_ausente boolean default true
)
returns table (intake_id uuid, appended boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_intake public.atendimento_whatsapp_intakes%rowtype;
  v_conteudo text;
begin
  -- Serializa apenas mensagens do mesmo remetente na mesma automação/grupo.
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_empresa_id::text, p_automacao_id::text, coalesce(p_participante_jid, 'desconhecido')),
    0
  ));

  select *
    into v_intake
    from public.atendimento_whatsapp_intakes
   where empresa_id = p_empresa_id
     and automacao_id = p_automacao_id
     and participante_jid is not distinct from p_participante_jid
     and status = 'aberto'
     and fechado_em is null
     and ultima_mensagem_em >= p_cutoff
   order by ultima_mensagem_em desc
   limit 1
   for update;

  if found then
    v_conteudo := btrim(coalesce(v_intake.conteudo_bruto, ''));
    if coalesce(p_raw_line, '') <> '' then
      v_conteudo := case when v_conteudo = '' then p_raw_line else v_conteudo || E'\n\n' || p_raw_line end;
    end if;

    update public.atendimento_whatsapp_intakes
       set participante_telefone = coalesce(nullif(p_participante_telefone, ''), participante_telefone),
           participante_nome = coalesce(nullif(p_participante_nome, ''), participante_nome),
           conteudo_bruto = v_conteudo,
           mensagens_ids = coalesce(mensagens_ids, '[]'::jsonb) || jsonb_build_array(p_mensagem_id),
           anexos = case
             when p_anexo is null then coalesce(anexos, '[]'::jsonb)
             else coalesce(anexos, '[]'::jsonb) || jsonb_build_array(p_anexo)
           end,
           ai_status = 'pendente',
           ai_erro = null,
           ultima_mensagem_em = p_now,
           updated_at = p_now
     where id = v_intake.id
     returning * into v_intake;

    return query select v_intake.id, true;
    return;
  end if;

  if not p_criar_se_ausente then
    return;
  end if;

  insert into public.atendimento_whatsapp_intakes (
    empresa_id, automacao_id, grupo_id, conversa_id, participante_jid,
    participante_telefone, participante_nome, status, orcamento_id, tarefa_id,
    conteudo_bruto, mensagens_ids, anexos, ai_status, fechamento_pausado,
    fechado_em, gatilho_fechamento, primeira_mensagem_em, ultima_mensagem_em, updated_at
  ) values (
    p_empresa_id, p_automacao_id, p_grupo_id, p_conversa_id, p_participante_jid,
    p_participante_telefone, p_participante_nome, 'aberto', null, null,
    coalesce(p_raw_line, ''), jsonb_build_array(p_mensagem_id),
    case when p_anexo is null then '[]'::jsonb else jsonb_build_array(p_anexo) end,
    'pendente', false, null, null, p_now, p_now, p_now
  )
  returning * into v_intake;

  return query select v_intake.id, false;
end;
$$;

revoke all on function public.atendimento_whatsapp_registrar_mensagem_orcamento(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.atendimento_whatsapp_registrar_mensagem_orcamento(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamptz, timestamptz, boolean
) to service_role;
