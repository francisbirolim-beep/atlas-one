-- Inativacao reversivel de clientes. Todos os registros existentes permanecem ativos.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.cadastros_status_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  cadastro text NOT NULL,
  registro_id uuid NOT NULL,
  ativo_anterior boolean NOT NULL,
  ativo_novo boolean NOT NULL,
  motivo text,
  usuario_id uuid NOT NULL,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cadastros_status_auditoria_registro_idx
  ON public.cadastros_status_auditoria (empresa_id, cadastro, registro_id, alterado_em DESC);

ALTER TABLE public.cadastros_status_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cadastros_status_auditoria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cadastros_status_auditoria TO authenticated;
DROP POLICY IF EXISTS cadastros_status_auditoria_master_select ON public.cadastros_status_auditoria;
CREATE POLICY cadastros_status_auditoria_master_select ON public.cadastros_status_auditoria
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT private.current_empresa_id()) AND (SELECT private.is_master_atlas()));

-- Ninguem altera a situacao diretamente pelo cliente REST.
-- A alteracao autorizada ocorre somente na funcao SECURITY DEFINER, com trilha de auditoria.
CREATE OR REPLACE FUNCTION private.bloquear_alteracao_direta_status_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.ativo IS DISTINCT FROM OLD.ativo AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Situacao do cliente deve ser alterada pela rotina autorizada'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bloquear_status_cliente ON public.clientes;
CREATE TRIGGER trg_bloquear_status_cliente BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_alteracao_direta_status_cliente();

CREATE OR REPLACE FUNCTION public.alterar_status_cadastro_cliente(
  p_cliente_id uuid, p_ativo boolean, p_motivo text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_empresa_id uuid;
  v_role text;
  v_ativo_atual boolean;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF v_usuario_id IS NULL OR p_cliente_id IS NULL OR p_ativo IS NULL THEN
    RAISE EXCEPTION 'Sessao ou dados invalidos' USING ERRCODE = '42501';
  END IF;
  SELECT u.empresa_id, u.role INTO v_empresa_id, v_role
    FROM public.usuarios u WHERE u.id = v_usuario_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa autorizada' USING ERRCODE = '42501';
  END IF;
  IF v_role IS DISTINCT FROM 'master' AND NOT (
    EXISTS (SELECT 1 FROM public.permissoes p
      WHERE p.usuario_id = v_usuario_id AND p.empresa_id = v_empresa_id
        AND p.setor_id = 'cadastro' AND p.nivel = 'edicao')
    AND EXISTS (SELECT 1 FROM public.usuario_cadastros_360_permissoes up
      WHERE up.usuario_id = v_usuario_id AND up.empresa_id = v_empresa_id
        AND up.config->'visiveis' ? 'clientes'
        AND up.config->'acoes'->'clientes' ? (CASE WHEN p_ativo THEN 'reativar' ELSE 'inativar' END))
  ) THEN
    RAISE EXCEPTION 'Sem permissao para inativar ou reativar clientes'
      USING ERRCODE = '42501';
  END IF;
  IF NOT p_ativo AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da inativacao';
  END IF;
  IF length(coalesce(v_motivo, '')) > 500 THEN
    RAISE EXCEPTION 'Motivo deve ter no maximo 500 caracteres';
  END IF;

  SELECT c.ativo INTO v_ativo_atual FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado na empresa' USING ERRCODE = '42501';
  END IF;
  IF v_ativo_atual = p_ativo THEN
    RETURN false;
  END IF;

  UPDATE public.clientes SET ativo = p_ativo, updated_at = now()
    WHERE id = p_cliente_id AND empresa_id = v_empresa_id;
  INSERT INTO public.cadastros_status_auditoria
    (empresa_id, cadastro, registro_id, ativo_anterior, ativo_novo, motivo, usuario_id)
  VALUES (v_empresa_id, 'clientes', p_cliente_id, v_ativo_atual, p_ativo, v_motivo, v_usuario_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_status_cadastro_cliente(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_status_cadastro_cliente(uuid, boolean, text) TO authenticated;
