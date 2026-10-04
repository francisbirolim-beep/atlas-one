-- Central de pendencias de cadastro de clientes
-- Mantem validacao humana para nomes incompletos/duplicidades e permite mesclagem transacional.

create table if not exists public.cadastro_pendencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id(),
  tipo text not null check (tipo in ('cadastro_incompleto','possivel_duplicidade','vinculo_wvetro')),
  status text not null default 'pendente' check (status in ('pendente','em_analise','resolvida','ignorada')),
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  titulo text not null,
  descricao text,
  origem text not null default 'atlas',
  chave_unica text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_candidato_id uuid references public.clientes(id) on delete set null,
  dados jsonb not null default '{}'::jsonb,
  criado_por_id uuid,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por_id uuid,
  resolvido_por_nome text,
  unique (empresa_id, chave_unica)
);

create index if not exists cadastro_pendencias_empresa_status_idx
  on public.cadastro_pendencias (empresa_id, status, criado_em desc);
create index if not exists cadastro_pendencias_cliente_idx
  on public.cadastro_pendencias (cliente_id)
  where cliente_id is not null;

alter table public.cadastro_pendencias enable row level security;

drop policy if exists cadastro_pendencias_select_empresa on public.cadastro_pendencias;
create policy cadastro_pendencias_select_empresa
on public.cadastro_pendencias for select
using (empresa_id = private.current_empresa_id());

drop policy if exists cadastro_pendencias_insert_empresa on public.cadastro_pendencias;
create policy cadastro_pendencias_insert_empresa
on public.cadastro_pendencias for insert
with check (empresa_id = private.current_empresa_id());

drop policy if exists cadastro_pendencias_update_empresa on public.cadastro_pendencias;
create policy cadastro_pendencias_update_empresa
on public.cadastro_pendencias for update
using (empresa_id = private.current_empresa_id())
with check (empresa_id = private.current_empresa_id());

create table if not exists public.cliente_mesclagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  cliente_origem_id uuid not null,
  cliente_destino_id uuid not null,
  cliente_origem_snapshot jsonb not null,
  cliente_destino_snapshot jsonb not null,
  vinculos_movidos integer not null default 0,
  mesclado_por_id uuid,
  mesclado_por_nome text,
  mesclado_em timestamptz not null default now()
);

create index if not exists cliente_mesclagens_empresa_idx
  on public.cliente_mesclagens (empresa_id, mesclado_em desc);

alter table public.cliente_mesclagens enable row level security;

drop policy if exists cliente_mesclagens_select_empresa on public.cliente_mesclagens;
create policy cliente_mesclagens_select_empresa
on public.cliente_mesclagens for select
using (empresa_id = private.current_empresa_id());

create or replace function public.sincronizar_pendencia_nome_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
  v_chave text;
begin
  v_nome := regexp_replace(trim(coalesce(new.nome, '')), '\\s+', ' ', 'g');
  v_chave := 'cliente:' || new.id::text || ':nome_incompleto';

  if v_nome <> ''
     and position(' ' in v_nome) = 0
     and upper(v_nome) not like 'TESTE%' then
    insert into public.cadastro_pendencias (
      empresa_id, tipo, status, prioridade, titulo, descricao, origem,
      chave_unica, cliente_id, dados, atualizado_em
    )
    values (
      new.empresa_id,
      'cadastro_incompleto',
      'pendente',
      'normal',
      'Completar cadastro de ' || v_nome,
      'O cliente está com apenas um nome. Confirme nome e sobrenome ou valide o cadastro.',
      coalesce(nullif(new.origem, ''), 'atlas'),
      v_chave,
      new.id,
      jsonb_build_object(
        'nome', new.nome,
        'whatsapp', new.whatsapp,
        'telefone', new.telefone,
        'cpf_cnpj', new.cpf_cnpj,
        'cidade', new.cidade
      ),
      now()
    )
    on conflict (empresa_id, chave_unica) do update set
      titulo = excluded.titulo,
      descricao = excluded.descricao,
      origem = excluded.origem,
      cliente_id = excluded.cliente_id,
      dados = excluded.dados,
      atualizado_em = now(),
      status = case
        when public.cadastro_pendencias.status = 'ignorada' then 'ignorada'
        else 'pendente'
      end,
      resolvido_em = case
        when public.cadastro_pendencias.status = 'ignorada' then public.cadastro_pendencias.resolvido_em
        else null
      end,
      resolvido_por_id = case
        when public.cadastro_pendencias.status = 'ignorada' then public.cadastro_pendencias.resolvido_por_id
        else null
      end,
      resolvido_por_nome = case
        when public.cadastro_pendencias.status = 'ignorada' then public.cadastro_pendencias.resolvido_por_nome
        else null
      end;
  else
    update public.cadastro_pendencias
       set status = 'resolvida',
           resolvido_em = coalesce(resolvido_em, now()),
           resolvido_por_nome = coalesce(resolvido_por_nome, 'Cadastro completado'),
           atualizado_em = now()
     where empresa_id = new.empresa_id
       and chave_unica = v_chave
       and status in ('pendente','em_analise');
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_pendencia_nome_trg on public.clientes;
create trigger clientes_pendencia_nome_trg
after insert or update of nome on public.clientes
for each row execute function public.sincronizar_pendencia_nome_cliente();

create or replace function public.mesclar_clientes(
  p_origem uuid,
  p_destino uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origem public.clientes%rowtype;
  v_destino public.clientes%rowtype;
  v_destino_final public.clientes%rowtype;
  v_ref record;
  v_linhas integer;
  v_total integer := 0;
begin
  if p_origem is null or p_destino is null or p_origem = p_destino then
    raise exception 'Informe dois clientes diferentes para mesclar.';
  end if;

  select * into v_origem from public.clientes where id = p_origem for update;
  if not found then raise exception 'Cliente de origem não encontrado.'; end if;

  select * into v_destino from public.clientes where id = p_destino for update;
  if not found then raise exception 'Cliente de destino não encontrado.'; end if;

  if v_origem.empresa_id <> v_destino.empresa_id then
    raise exception 'Os clientes pertencem a empresas diferentes.';
  end if;

  update public.clientes
     set whatsapp = coalesce(nullif(trim(v_destino.whatsapp), ''), v_origem.whatsapp),
         cidade = coalesce(nullif(trim(v_destino.cidade), ''), v_origem.cidade),
         cpf_cnpj = coalesce(nullif(trim(v_destino.cpf_cnpj), ''), v_origem.cpf_cnpj),
         data_nascimento = coalesce(v_destino.data_nascimento, v_origem.data_nascimento),
         endereco = coalesce(nullif(trim(v_destino.endereco), ''), v_origem.endereco),
         responsavel = coalesce(nullif(trim(v_destino.responsavel), ''), v_origem.responsavel),
         observacoes = coalesce(nullif(trim(v_destino.observacoes), ''), v_origem.observacoes),
         bairro = coalesce(nullif(trim(v_destino.bairro), ''), v_origem.bairro),
         cep = coalesce(nullif(trim(v_destino.cep), ''), v_origem.cep),
         email = coalesce(nullif(trim(v_destino.email), ''), v_origem.email),
         telefone = coalesce(nullif(trim(v_destino.telefone), ''), v_origem.telefone),
         apelido = coalesce(nullif(trim(v_destino.apelido), ''), v_origem.apelido),
         updated_at = now()
   where id = p_destino
   returning * into v_destino_final;

  update public.cadastro_pendencias
     set status = 'resolvida',
         resolvido_em = now(),
         resolvido_por_id = p_usuario_id,
         resolvido_por_nome = coalesce(nullif(trim(p_usuario_nome), ''), 'Mesclagem de clientes'),
         atualizado_em = now()
   where empresa_id = v_origem.empresa_id
     and cliente_id = p_origem
     and status in ('pendente','em_analise');

  update public.cadastro_pendencias
     set cliente_candidato_id = p_destino,
         atualizado_em = now()
   where empresa_id = v_origem.empresa_id
     and cliente_candidato_id = p_origem;

  for v_ref in
    select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
     where tc.constraint_type = 'FOREIGN KEY'
       and tc.table_schema = 'public'
       and ccu.table_schema = 'public'
       and ccu.table_name = 'clientes'
       and ccu.column_name = 'id'
       and tc.table_name not in ('cadastro_pendencias','cliente_mesclagens')
  loop
    execute format(
      'update public.%I set %I = $1 where %I = $2',
      v_ref.table_name, v_ref.column_name, v_ref.column_name
    )
    using p_destino, p_origem;
    get diagnostics v_linhas = row_count;
    v_total := v_total + v_linhas;
  end loop;

  insert into public.cliente_mesclagens (
    empresa_id,
    cliente_origem_id,
    cliente_destino_id,
    cliente_origem_snapshot,
    cliente_destino_snapshot,
    vinculos_movidos,
    mesclado_por_id,
    mesclado_por_nome
  ) values (
    v_origem.empresa_id,
    p_origem,
    p_destino,
    to_jsonb(v_origem),
    to_jsonb(v_destino_final),
    v_total,
    p_usuario_id,
    p_usuario_nome
  );

  delete from public.clientes where id = p_origem;

  return jsonb_build_object(
    'ok', true,
    'cliente_origem_id', p_origem,
    'cliente_destino_id', p_destino,
    'vinculos_movidos', v_total
  );
end;
$$;

revoke all on function public.mesclar_clientes(uuid, uuid, uuid, text) from public;
revoke all on function public.mesclar_clientes(uuid, uuid, uuid, text) from anon;
revoke all on function public.mesclar_clientes(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.mesclar_clientes(uuid, uuid, uuid, text) to service_role;

-- Pendencias para cadastros atuais com apenas um nome.
insert into public.cadastro_pendencias (
  empresa_id, tipo, status, prioridade, titulo, descricao, origem,
  chave_unica, cliente_id, dados
)
select
  c.empresa_id,
  'cadastro_incompleto',
  'pendente',
  'normal',
  'Completar cadastro de ' || trim(c.nome),
  'O cliente está com apenas um nome. Confirme nome e sobrenome ou valide o cadastro.',
  coalesce(nullif(c.origem, ''), 'atlas'),
  'cliente:' || c.id::text || ':nome_incompleto',
  c.id,
  jsonb_build_object(
    'nome', c.nome,
    'whatsapp', c.whatsapp,
    'telefone', c.telefone,
    'cpf_cnpj', c.cpf_cnpj,
    'cidade', c.cidade
  )
from public.clientes c
where trim(c.nome) <> ''
  and position(' ' in regexp_replace(trim(c.nome), '\\s+', ' ', 'g')) = 0
  and upper(trim(c.nome)) not like 'TESTE%'
on conflict (empresa_id, chave_unica) do nothing;

-- Duplicidades exatas de nome ficam para validacao humana; nenhuma mesclagem automatica por nome.
with base as (
  select
    c.id,
    c.empresa_id,
    c.nome,
    upper(regexp_replace(trim(c.nome), '\\s+', ' ', 'g')) as nome_norm
  from public.clientes c
  where trim(c.nome) <> ''
    and upper(trim(c.nome)) not like 'TESTE%'
)
insert into public.cadastro_pendencias (
  empresa_id, tipo, status, prioridade, titulo, descricao, origem,
  chave_unica, cliente_id, dados
)
select
  b.empresa_id,
  'possivel_duplicidade',
  'pendente',
  'normal',
  'Revisar possível duplicidade: ' || trim(b.nome),
  'Há outro cadastro com o mesmo nome. Confirme se são pessoas diferentes ou mescle os cadastros.',
  'atlas',
  'cliente:' || b.id::text || ':duplicidade_nome',
  b.id,
  jsonb_build_object(
    'nome_normalizado', b.nome_norm,
    'candidatos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome)), '[]'::jsonb)
      from base o
      where o.empresa_id = b.empresa_id
        and o.nome_norm = b.nome_norm
        and o.id <> b.id
    )
  )
from base b
where exists (
  select 1
  from base o
  where o.empresa_id = b.empresa_id
    and o.nome_norm = b.nome_norm
    and o.id <> b.id
)
on conflict (empresa_id, chave_unica) do nothing;
