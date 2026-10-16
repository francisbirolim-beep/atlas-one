-- Triagem opt-in para contatos; sem alterar grupos ou historico.
ALTER TABLE public.atendimento_configuracoes
 ADD COLUMN IF NOT EXISTS triagem_privada_ativa boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS triagem_tempo_minutos integer NOT NULL DEFAULT 10 CHECK (triagem_tempo_minutos BETWEEN 1 AND 1440),
 ADD COLUMN IF NOT EXISTS triagem_destinos uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.atendimento_conversas
 ADD COLUMN IF NOT EXISTS triagem_prazo_em timestamptz,
 ADD COLUMN IF NOT EXISTS triagem_destinos uuid[] NOT NULL DEFAULT '{}'::uuid[],
 ADD COLUMN IF NOT EXISTS triagem_escalonada_em timestamptz;
-- Cada grupo pode ter prazo e substitutos próprios, independentes do canal principal.
ALTER TABLE public.atendimento_whatsapp_grupos
 ADD COLUMN IF NOT EXISTS triagem_privada_ativa boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS triagem_tempo_minutos integer NOT NULL DEFAULT 10
     CHECK (triagem_tempo_minutos BETWEEN 1 AND 1440),
 ADD COLUMN IF NOT EXISTS triagem_destinos uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS atendimento_conversas_triagem_vencidas_idx
 ON public.atendimento_conversas(triagem_prazo_em)
 WHERE triagem_prazo_em IS NOT NULL AND triagem_escalonada_em IS NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_escalonar_triagem(p_empresa_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conversa record;
  destino uuid;
  processadas integer := 0;
  agora timestamptz := now();
BEGIN
  FOR conversa IN
    SELECT c.id, c.empresa_id, c.responsavel_id, c.telefone, c.contato_nome,
           c.grupo_nome, c.whatsapp_chat_tipo, c.triagem_destinos
      FROM public.atendimento_conversas c
      JOIN public.atendimento_configuracoes cfg ON cfg.empresa_id = c.empresa_id
      LEFT JOIN public.atendimento_whatsapp_grupos g
        ON g.empresa_id = c.empresa_id
       AND g.whatsapp_canal_id = c.whatsapp_canal_id
       AND g.grupo_jid = c.whatsapp_chat_jid AND g.ativo = true
      LEFT JOIN public.atendimento_whatsapp_grupo_permissoes gp
        ON gp.empresa_id = c.empresa_id AND gp.grupo_id = g.id
       AND gp.responsavel_principal = true AND gp.nivel IN ('atender','gerenciar')
     WHERE (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
       AND c.canal = 'whatsapp'
       AND (
         (COALESCE(c.whatsapp_chat_tipo, 'contato') = 'contato'
           AND cfg.triagem_privada_ativa = true AND c.responsavel_id = cfg.usuario_padrao_id)
         OR
         (c.whatsapp_chat_tipo = 'grupo'
           AND g.triagem_privada_ativa = true AND c.responsavel_id = gp.usuario_id)
       )
       AND c.status = 'aguardando'
       AND c.triagem_prazo_em <= agora AND c.triagem_escalonada_em IS NULL
       AND cardinality(c.triagem_destinos) > 0
     FOR UPDATE OF c SKIP LOCKED
  LOOP
    UPDATE public.atendimento_conversas
       SET responsavel_id = NULL, responsavel_nome = NULL, triagem_prazo_em = NULL,
           triagem_escalonada_em = agora, updated_at = agora WHERE id = conversa.id;
    UPDATE public.atendimento_sessoes
       SET responsavel_id = NULL, responsavel_nome = NULL, assigned_at = NULL, status = 'aguardando'
     WHERE conversa_id = conversa.id AND closed_at IS NULL;
    INSERT INTO public.atendimento_eventos(empresa_id,conversa_id,tipo,dados)
    VALUES(conversa.empresa_id,conversa.id,'conversa_escalonada_automaticamente',
           jsonb_build_object('responsavel_anterior_id',conversa.responsavel_id,
                              'destinos',conversa.triagem_destinos));
    FOREACH destino IN ARRAY conversa.triagem_destinos LOOP
      IF EXISTS(SELECT 1 FROM public.usuarios WHERE id = destino AND empresa_id = conversa.empresa_id) THEN
        INSERT INTO public.notificacoes(
          empresa_id,usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id,push_status)
        VALUES(conversa.empresa_id,destino,'chat','whatsapp_triagem_escalonada',
          'WhatsApp · aguardando atendimento',
          format('%s aguarda atendimento na sua fila.',COALESCE(conversa.grupo_nome,conversa.contato_nome,conversa.telefone)),
          '/whatsapp?conversaId='||conversa.id::text,
          'whatsapp_triagem_escalonada',conversa.id::text||':'||destino::text,'pendente');
      END IF;
    END LOOP;
    processadas := processadas + 1;
  END LOOP;
  RETURN processadas;
END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_escalonar_triagem(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_escalonar_triagem(uuid) TO service_role;
