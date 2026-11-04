-- Consolidacao conservadora de cadastros: preserva a origem e o historico.
-- APLICAR SOMENTE DEPOIS DE HOMOLOGACAO / BACKUP, NUNCA AUTOMATICAMENTE.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS mesclado_em_cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS clientes_mesclado_em_cliente_idx
  ON public.clientes (empresa_id, mesclado_em_cliente_id)
  WHERE mesclado_em_cliente_id IS NOT NULL;

-- Nao permitir reativar acidentalmente uma origem ja unificada, nem
-- inserir/trocar o apontamento de unificacao por acesso direto do browser.
CREATE OR REPLACE FUNCTION private.proteger_cliente_ja_unificado()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.mesclado_em_cliente_id IS NOT NULL AND NEW.ativo IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Cadastro ja unificado nao pode ser reativado';
  END IF;
  IF NEW.mesclado_em_cliente_id IS DISTINCT FROM OLD.mesclado_em_cliente_id
     AND current_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'Unificacao de clientes exige rotina autorizada'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proteger_cliente_ja_unificado ON public.clientes;
CREATE TRIGGER trg_proteger_cliente_ja_unificado BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION private.proteger_cliente_ja_unificado();

CREATE OR REPLACE FUNCTION public.unificar_clientes_seguro(
  p_origem uuid, p_destino uuid, p_motivo text,
  p_origem_atualizado_em timestamptz, p_destino_atualizado_em timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_empresa uuid;
  v_role text;
  v_nome_usuario text;
  v_origem public.clientes%ROWTYPE;
  v_destino public.clientes%ROWTYPE;
  v_tab record;
  v_quantidade integer;
  v_total integer := 0;
  v_movidos jsonb := '{}'::jsonb;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_permitidas text[] := ARRAY[
    'assistencias','atendimento_conversas','balcao_orcamentos','balcao_vendas',
    'cliente_documentos','compras_entradas_manuais','compras_entradas_manuais_destinos',
    'compras_necessidades','compras_solicitacao_itens','compras_solicitacoes',
    'crm_interacoes','crm_tarefas','estoque_reservas',
    'financeiro_contas_receber','financeiro_recebimentos','medicoes_finais','obras',
    'orcamentos','ordens_producao','pacotes_tecnicos','planos_corte','prospeccoes',
    'setor_kanban_itens','tarefas','venda_instalacao_itens','vendas_obras',
    'wvetro_historico_comercial','wvetro_historico_financeiro',
    'wvetro_historico_operacional','wvetro_orcamentos_historico'
  ];
BEGIN
  IF v_usuario IS NULL OR p_origem IS NULL OR p_destino IS NULL OR p_origem = p_destino THEN
    RAISE EXCEPTION 'Sessao invalida ou clientes iguais' USING ERRCODE='42501';
  END IF;
  IF length(v_motivo) < 8 OR length(v_motivo) > 500
    OR p_origem_atualizado_em IS NULL OR p_destino_atualizado_em IS NULL THEN
    RAISE EXCEPTION 'Confirme a pre-visualizacao e informe motivo de 8 a 500 caracteres';
  END IF;

  SELECT u.empresa_id, u.role, u.nome INTO v_empresa, v_role, v_nome_usuario
    FROM public.usuarios u WHERE u.id = v_usuario;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa valida' USING ERRCODE='42501';
  END IF;
  IF v_role IS DISTINCT FROM 'master' AND NOT (
    EXISTS (
      SELECT 1 FROM public.permissoes p
       WHERE p.usuario_id=v_usuario AND p.empresa_id=v_empresa
         AND p.setor_id='cadastro' AND p.nivel='edicao'
    ) AND EXISTS (
      SELECT 1 FROM public.usuario_cadastros_360_permissoes up
       WHERE up.usuario_id=v_usuario AND up.empresa_id=v_empresa
         AND up.config->'visiveis' ? 'clientes'
         AND up.config->'acoes'->'clientes' ? 'mesclar'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para unificar clientes' USING ERRCODE='42501';
  END IF;

  -- Serializa mesclagens na mesma empresa e protege contra confirmacao desatualizada.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text, 0));
  PERFORM 1 FROM public.clientes c WHERE c.id IN (p_origem,p_destino)
    ORDER BY c.id FOR UPDATE;
  SELECT * INTO v_origem FROM public.clientes
    WHERE id=p_origem AND empresa_id=v_empresa;
  SELECT * INTO v_destino FROM public.clientes
    WHERE id=p_destino AND empresa_id=v_empresa;
  IF v_origem.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'Clientes nao encontrados na mesma empresa' USING ERRCODE='42501';
  END IF;
  IF NOT v_origem.ativo OR NOT v_destino.ativo
     OR v_origem.mesclado_em_cliente_id IS NOT NULL
     OR v_destino.mesclado_em_cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'A origem e o destino devem ser cadastros ativos e nao mesclados';
  END IF;
  IF v_origem.updated_at IS DISTINCT FROM p_origem_atualizado_em
    OR v_destino.updated_at IS DISTINCT FROM p_destino_atualizado_em THEN
    RAISE EXCEPTION 'Algum cadastro foi atualizado. Reabra a comparacao antes de unificar';
  END IF;
  IF nullif(regexp_replace(coalesce(v_origem.cpf_cnpj,''),'[^0-9]','','g'),'') IS NOT NULL
     AND nullif(regexp_replace(coalesce(v_destino.cpf_cnpj,''),'[^0-9]','','g'),'') IS NOT NULL
     AND regexp_replace(v_origem.cpf_cnpj,'[^0-9]','','g')
      <> regexp_replace(v_destino.cpf_cnpj,'[^0-9]','','g') THEN
    RAISE EXCEPTION 'CPFs/CNPJs diferentes. Revise a identidade antes de unificar';
  END IF;

  -- Cada transferencia ocorre na MESMA transacao, falha de qualquer tabela reverte tudo.
  -- Referencias de auditoria permanecem apontadas ao registro original, que NAO e excluido.
  FOR v_tab IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN pg_class t ON t.relname=c.table_name
      JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
     WHERE c.table_schema='public' AND c.column_name='cliente_id' AND t.relkind='r'
       AND EXISTS (
         SELECT 1 FROM information_schema.columns ce
          WHERE ce.table_schema='public' AND ce.table_name=c.table_name
            AND ce.column_name='empresa_id'
       )
       AND c.table_name NOT IN ('cadastro_pendencias','venda_exclusoes_auditoria',
                                 'wvetro_cliente_orcamento_validacoes')
     ORDER BY c.table_name
  LOOP
    IF NOT (v_tab.table_name = ANY(v_permitidas)) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE empresa_id=$1 AND cliente_id=$2',
                     v_tab.table_name)
        INTO v_quantidade USING v_empresa,p_origem;
      IF v_quantidade > 0 THEN
        RAISE EXCEPTION 'Modulo % possui vinculos nao homologados para a unificacao',
                        v_tab.table_name;
      END IF;
      CONTINUE;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET cliente_id=$1 WHERE empresa_id=$2 AND cliente_id=$3',
      v_tab.table_name
    ) USING p_destino,v_empresa,p_origem;
    GET DIAGNOSTICS v_quantidade = ROW_COUNT;
    v_movidos := v_movidos || jsonb_build_object(v_tab.table_name,v_quantidade);
    v_total := v_total + v_quantidade;
  END LOOP;

  -- Mensagens nao possuem empresa_id: valida a empresa pela conversa.
  IF EXISTS (
    SELECT 1 FROM public.chat_mensagens m
      LEFT JOIN public.atendimento_conversas c ON c.id=m.conversa_id
     WHERE m.cliente_id=p_origem AND (c.id IS NULL OR c.empresa_id IS DISTINCT FROM v_empresa)
  ) THEN
    RAISE EXCEPTION 'Mensagens sem vinculo seguro de empresa impedem a mesclagem';
  END IF;
  UPDATE public.chat_mensagens m SET cliente_id=p_destino
    FROM public.atendimento_conversas c
   WHERE m.conversa_id=c.id AND c.empresa_id=v_empresa AND m.cliente_id=p_origem;
  GET DIAGNOSTICS v_quantidade = ROW_COUNT;
  v_total := v_total + v_quantidade;
  v_movidos := v_movidos || jsonb_build_object('chat_mensagens',v_quantidade);

  UPDATE public.cadastro_pendencias
     SET status='resolvida', resolvido_em=now(), resolvido_por_id=v_usuario,
         resolvido_por_nome=coalesce(v_nome_usuario,'Unificacao'), atualizado_em=now()
   WHERE empresa_id=v_empresa AND cliente_id=p_origem
     AND status IN ('pendente','em_analise');
  UPDATE public.cadastro_pendencias
     SET cliente_candidato_id=p_destino, atualizado_em=now()
   WHERE empresa_id=v_empresa AND cliente_candidato_id=p_origem;

  -- Preserva dados ja cadastrados no destino; preenche somente campos vazios.
  UPDATE public.clientes SET
    apelido=coalesce(nullif(btrim(apelido),''),nullif(btrim(v_origem.apelido),'')),
    whatsapp=coalesce(nullif(btrim(whatsapp),''),nullif(btrim(v_origem.whatsapp),'')),
    telefone=coalesce(nullif(btrim(telefone),''),nullif(btrim(v_origem.telefone),'')),
    email=coalesce(nullif(btrim(email),''),nullif(btrim(v_origem.email),'')),
    cpf_cnpj=coalesce(nullif(btrim(cpf_cnpj),''),nullif(btrim(v_origem.cpf_cnpj),'')),
    cidade=coalesce(nullif(btrim(cidade),''),nullif(btrim(v_origem.cidade),'')),
    bairro=coalesce(nullif(btrim(bairro),''),nullif(btrim(v_origem.bairro),'')),
    endereco=coalesce(nullif(btrim(endereco),''),nullif(btrim(v_origem.endereco),'')),
    cep=coalesce(nullif(btrim(cep),''),nullif(btrim(v_origem.cep),'')),
    data_nascimento=coalesce(data_nascimento,v_origem.data_nascimento),
    updated_at=now()
  WHERE id=p_destino AND empresa_id=v_empresa;

  UPDATE public.clientes SET
    ativo=false, mesclado_em_cliente_id=p_destino, updated_at=now()
  WHERE id=p_origem AND empresa_id=v_empresa;

  INSERT INTO public.cadastros_status_auditoria
    (empresa_id,cadastro,registro_id,ativo_anterior,ativo_novo,motivo,usuario_id)
  VALUES (v_empresa,'clientes',p_origem,true,false,
          'Unificado em '||p_destino::text||'. '||v_motivo,v_usuario);
  INSERT INTO public.cliente_mesclagens
    (empresa_id,cliente_origem_id,cliente_destino_id,
     cliente_origem_snapshot,cliente_destino_snapshot,
     vinculos_movidos,mesclado_por_id,mesclado_por_nome)
  VALUES (v_empresa,p_origem,p_destino,
          to_jsonb(v_origem),to_jsonb(v_destino),v_total,v_usuario,v_nome_usuario);

  RETURN jsonb_build_object('ok',true,'origem',p_origem,'destino',p_destino,
           'vinculos_movidos',v_total,'por_modulo',v_movidos);
END;
$$;
REVOKE ALL ON FUNCTION public.unificar_clientes_seguro(uuid,uuid,text,timestamptz,timestamptz)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.unificar_clientes_seguro(uuid,uuid,text,timestamptz,timestamptz)
  TO authenticated;
