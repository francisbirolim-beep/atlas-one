-- Conversão V2: preserva a RPC V1 em funcionamento e transfere CEP/número à obra.
-- Não aplicar em produção até a homologação e reconciliação do histórico SQL.
begin;

create or replace function public.fn_converter_prospeccao_v2(
  p_prospeccao_id uuid,
  p_cliente_existente_id uuid default null,
  p_criar_obra boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_empresa_id uuid := private.current_empresa_id();
  v_p public.prospeccoes%rowtype;
  v_cliente_id uuid;
  v_obra_id uuid;
  v_numero text;
  v_rua text;
begin
  if v_uid is null or v_empresa_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_p from public.prospeccoes
  where id = p_prospeccao_id
    and empresa_id = v_empresa_id
    and (responsavel_id = v_uid or private.is_master_atlas())
  for update;
  if not found then raise exception 'Prospecção não encontrada ou sem acesso'; end if;

  if v_p.status = 'convertido' and v_p.cliente_id is not null then
    return jsonb_build_object('cliente_id',v_p.cliente_id,'obra_id',v_p.obra_id,'ja_convertido',true);
  end if;

  if p_cliente_existente_id is not null then
    select id into v_cliente_id from public.clientes
    where id = p_cliente_existente_id and empresa_id = v_empresa_id;
    if v_cliente_id is null then raise exception 'Cliente existente inválido'; end if;
    -- O cadastro do cliente existente nunca é sobrescrito pela visita.
  else
    if nullif(trim(v_p.nome_cliente),'') is null then
      raise exception 'Informe o nome do cliente antes de converter';
    end if;
    insert into public.clientes(
      empresa_id,nome,whatsapp,telefone,cidade,endereco,bairro,cep,
      origem,responsavel,observacoes
    )
    values (
      v_empresa_id,v_p.nome_cliente,nullif(v_p.telefone,''),nullif(v_p.telefone,''),
      v_p.cidade,v_p.endereco,v_p.bairro,v_p.cep,
      'prospeccao_campo',v_p.responsavel_nome,
      concat_ws(E'\n',nullif(v_p.observacoes,''),'Criado a partir da Prospecção em Campo.')
    )
    returning id into v_cliente_id;
  end if;

  -- Extração conservadora: só trata como número de imóvel quando o endereço
  -- termina em ", NNN" ou ", 123A". Mantém outros formatos integralmente.
  v_numero := substring(coalesce(v_p.endereco,'') from ',[[:space:]]*([0-9]+[a-zA-Z]?)[[:space:]]*$');
  v_rua := nullif(trim(coalesce(v_p.endereco,'')),'');
  if v_numero is not null then
    v_rua := nullif(trim(regexp_replace(coalesce(v_p.endereco,''),
      ',[[:space:]]*[0-9]+[a-zA-Z]?[[:space:]]*$','')),'');
  end if;

  if p_criar_obra then
    insert into public.obras(
      empresa_id,cliente_id,nome,status,endereco,numero_endereco,cep,
      complemento,bairro,cidade,responsavel,observacoes,criado_por_id,criado_por_nome
    )
    values(
      v_empresa_id,v_cliente_id,
      coalesce(nullif(v_p.nome_obra,''),'Obra de '||v_p.nome_cliente),
      'planejamento',v_rua,v_numero,v_p.cep,
      v_p.complemento,v_p.bairro,v_p.cidade,v_p.nome_cliente,
      concat_ws(E'\n',nullif(v_p.observacoes,''),'Origem: Prospecção em Campo.'),
      v_uid,v_p.responsavel_nome
    )
    returning id into v_obra_id;
  end if;

  update public.prospeccoes
  set cliente_id=v_cliente_id,obra_id=v_obra_id,status='convertido',
      convertido_em=now(),status_atualizado_em=now(),
      proxima_acao=null,proxima_acao_em=null
  where id=v_p.id;

  insert into public.prospeccao_interacoes(
    empresa_id,prospeccao_id,tipo,descricao,status_anterior,status_novo,usuario_id,usuario_nome
  )
  values(
    v_empresa_id,v_p.id,'conversao',
    'Prospecção convertida em Cliente 360'||case when v_obra_id is not null then ' e obra' else '' end,
    v_p.status,'convertido',v_uid,v_p.responsavel_nome
  );

  return jsonb_build_object('cliente_id',v_cliente_id,'obra_id',v_obra_id,'ja_convertido',false);
end;
$$;

revoke all on function public.fn_converter_prospeccao_v2(uuid,uuid,boolean) from public, anon;
grant execute on function public.fn_converter_prospeccao_v2(uuid,uuid,boolean) to authenticated;

commit;
