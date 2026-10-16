-- Novo fluxo isolado de solicitacoes e carrinhos de compras por fornecedor.
-- Nao modifica Compras 360 legado, estoque, financeiro, producao ou notas.
begin;
create table if not exists public.compras_solicitacoes (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
 destino text not null check (destino in ('obra','estoque')),
 cliente_id uuid references public.clientes(id), obra_id uuid references public.obras(id),
 solicitante_id uuid references auth.users(id), solicitante_nome text not null,
 observacoes text, status text not null default 'aguardando_validacao'
 check(status in ('aguardando_validacao','em_cotacao','aguardando_minimo','comprado','aguardando_entrega','recebido_parcial','recebido','cancelado')),
 atualizado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((destino='estoque' and cliente_id is null and obra_id is null) or
        (destino='obra' and cliente_id is not null and obra_id is not null))
);
create index if not exists compras_solicitacoes_empresa_data_idx on public.compras_solicitacoes (empresa_id,created_at desc);
create index if not exists compras_solicitacoes_obra_idx on public.compras_solicitacoes (empresa_id,obra_id) where obra_id is not null;
create table if not exists public.compras_solicitacao_itens (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
 solicitacao_id uuid not null references public.compras_solicitacoes(id),
 ordem integer not null default 1,
 categoria text not null check(categoria in ('perfil','acessorio','vidro','produto_pronto','outros')),
 descricao text not null check(length(trim(descricao))>=2),
 produto_id uuid references public.produtos(id),
 quantidade_necessaria numeric check(quantidade_necessaria is null or quantidade_necessaria>0),
 unidade text not null default 'UN',foto_path text,
 status text not null default 'ativo' check(status in ('ativo','cancelado')),
 identificacao_status text not null default 'pendente' check(identificacao_status in ('pendente','sugerido','validado')),
 identificacao_por_id uuid references auth.users(id), atualizado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(solicitacao_id,ordem)
);
create index if not exists compras_solicitacao_itens_solicitacao_idx on public.compras_solicitacao_itens (empresa_id,solicitacao_id,ordem);
create table if not exists public.compras_carrinhos (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id),
 fornecedor_id uuid not null references public.fornecedores(id),
 status text not null default 'rascunho' check(status in ('rascunho','pedido_emitido','aguardando_entrega','recebido_parcial','recebido','cancelado')),
 numero_pedido text, pedido_emitido_em timestamptz,recebido_em timestamptz,
 criado_por_id uuid references auth.users(id),atualizado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists compras_carrinhos_fornecedor_idx on public.compras_carrinhos (empresa_id,fornecedor_id,status);
create table if not exists public.compras_carrinho_itens (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
 carrinho_id uuid not null references public.compras_carrinhos(id),
 item_id uuid not null references public.compras_solicitacao_itens(id),
 quantidade_obra numeric not null default 0 check(quantidade_obra>=0),
 quantidade_estoque numeric not null default 0 check(quantidade_estoque>=0),
 preco_unitario numeric check(preco_unitario is null or preco_unitario>=0),
 recebido_obra numeric not null default 0 check(recebido_obra>=0),
 recebido_estoque numeric not null default 0 check(recebido_estoque>=0),
 atualizado_por_id uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(carrinho_id,item_id),check(quantidade_obra+quantidade_estoque>0),
 check(recebido_obra<=quantidade_obra and recebido_estoque<=quantidade_estoque)
);
create index if not exists compras_carrinho_itens_item_idx on public.compras_carrinho_itens (empresa_id,item_id);
create table if not exists public.compras_solicitacao_auditoria (
 id bigint generated always as identity primary key,empresa_id uuid not null,
 solicitacao_id uuid not null, item_id uuid,carrinho_id uuid,
 entidade text not null,acao text not null,
 antes jsonb,depois jsonb,usuario_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists compras_solicitacao_auditoria_sol_idx on public.compras_solicitacao_auditoria(empresa_id,solicitacao_id,created_at desc);

create or replace function private.compras_solicitacao_validar() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.destino='obra' and not exists(
  select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
  where o.id=new.obra_id and c.id=new.cliente_id and o.empresa_id=new.empresa_id and c.empresa_id=new.empresa_id
 ) then raise exception 'Cliente e obra nao correspondem a empresa'; end if;
 if new.solicitante_id is not null and not exists(select 1 from public.usuarios where id=new.solicitante_id and empresa_id=new.empresa_id)
 then raise exception 'Solicitante pertence a outra empresa';end if;
 if tg_op='UPDATE' and new.empresa_id<>old.empresa_id then raise exception 'Empresa da solicitacao imutavel';end if;
 return new;
end; $$;
drop trigger if exists compras_solicitacao_validar on public.compras_solicitacoes;
create trigger compras_solicitacao_validar before insert or update on public.compras_solicitacoes for each row execute function private.compras_solicitacao_validar();

create or replace function private.compras_solicitacao_item_validar() returns trigger language plpgsql security definer set search_path='' as $$
declare v_destino text;
begin
 select destino into v_destino from public.compras_solicitacoes where id=new.solicitacao_id and empresa_id=new.empresa_id;
 if v_destino is null then raise exception 'Solicitacao de outra empresa';end if;
 if v_destino='obra' and new.quantidade_necessaria is null then raise exception 'Quantidade de obra obrigatoria';end if;
 if new.produto_id is not null and not exists(select 1 from public.produtos where id=new.produto_id and empresa_id=new.empresa_id)
 then raise exception 'Produto de outra empresa';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or new.solicitacao_id<>old.solicitacao_id) then raise exception 'Origem do item imutavel';end if;
 return new;
end; $$;
drop trigger if exists compras_solicitacao_item_validar on public.compras_solicitacao_itens;
create trigger compras_solicitacao_item_validar before insert or update on public.compras_solicitacao_itens for each row execute function private.compras_solicitacao_item_validar();

create or replace function private.compras_carrinho_validar() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.fornecedores where id=new.fornecedor_id and empresa_id=new.empresa_id and ativo)
 then raise exception 'Fornecedor invalido';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or new.fornecedor_id<>old.fornecedor_id)
 then raise exception 'Fornecedor do carrinho imutavel';end if;
 return new;
end; $$;
drop trigger if exists compras_carrinho_validar on public.compras_carrinhos;
create trigger compras_carrinho_validar before insert or update on public.compras_carrinhos for each row execute function private.compras_carrinho_validar();

create or replace function private.compras_carrinho_item_validar() returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_status text;v_uso numeric;
begin
 select i.solicitacao_id,i.quantidade_necessaria,i.status,s.destino into v_item
 from public.compras_solicitacao_itens i join public.compras_solicitacoes s on s.id=i.solicitacao_id
 where i.id=new.item_id and i.empresa_id=new.empresa_id and s.empresa_id=new.empresa_id for update of i;
 if not found or v_item.status='cancelado' then raise exception 'Item da solicitacao invalido';end if;
 select status into v_status from public.compras_carrinhos where id=new.carrinho_id and empresa_id=new.empresa_id;
 if v_status is null or v_status<>'rascunho' then raise exception 'Carrinho precisa estar em rascunho e na mesma empresa';end if;
 if v_item.destino='estoque' and new.quantidade_obra<>0 then raise exception 'Destino obra invalido';end if;
 select coalesce(sum(ci.quantidade_obra),0) into v_uso from public.compras_carrinho_itens ci
 join public.compras_carrinhos ca on ca.id=ci.carrinho_id
 where ci.item_id=new.item_id and ci.id<>new.id and ca.status<>'cancelado';
 if v_item.destino='obra' and v_uso+new.quantidade_obra>v_item.quantidade_necessaria
 then raise exception 'Quantidade de obra excede solicitacao';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or new.item_id<>old.item_id or new.carrinho_id<>old.carrinho_id)
 then raise exception 'Origem de item do carrinho imutavel';end if;
 return new;
end; $$;
drop trigger if exists compras_carrinho_item_validar on public.compras_carrinho_itens;
create trigger compras_carrinho_item_validar before insert or update on public.compras_carrinho_itens for each row execute function private.compras_carrinho_item_validar();

create or replace function private.compras_solicitacao_auditar() returns trigger language plpgsql security definer set search_path='' as $$
declare v_sol uuid;v_item uuid;v_cart uuid;v_user uuid;
begin
 if tg_table_name='compras_solicitacoes' then v_sol=new.id;v_user=new.atualizado_por_id;
 elsif tg_table_name='compras_solicitacao_itens' then v_sol=new.solicitacao_id;v_item=new.id;v_user=new.atualizado_por_id;
 elsif tg_table_name='compras_carrinho_itens' then
  v_item=new.item_id;v_cart=new.carrinho_id;v_user=new.atualizado_por_id;
  select solicitacao_id into v_sol from public.compras_solicitacao_itens where id=new.item_id;
 else return new;end if;
 insert into public.compras_solicitacao_auditoria(empresa_id,solicitacao_id,item_id,carrinho_id,entidade,acao,antes,depois,usuario_id)
 values(new.empresa_id,v_sol,v_item,v_cart,tg_table_name,lower(tg_op),
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),v_user);
 return new;
end; $$;

drop trigger if exists compras_solicitacao_audit_on_header on public.compras_solicitacoes;
create trigger compras_solicitacao_audit_on_header after insert or update on public.compras_solicitacoes
 for each row execute function private.compras_solicitacao_auditar();
drop trigger if exists compras_solicitacao_audit_on_item on public.compras_solicitacao_itens;
create trigger compras_solicitacao_audit_on_item after insert or update on public.compras_solicitacao_itens
 for each row execute function private.compras_solicitacao_auditar();
drop trigger if exists compras_solicitacao_audit_on_cart_line on public.compras_carrinho_itens;
create trigger compras_solicitacao_audit_on_cart_line after insert or update on public.compras_carrinho_itens
 for each row execute function private.compras_solicitacao_auditar();

alter table public.compras_solicitacoes enable row level security;
alter table public.compras_solicitacao_itens enable row level security;
alter table public.compras_carrinhos enable row level security;
alter table public.compras_carrinho_itens enable row level security;
alter table public.compras_solicitacao_auditoria enable row level security;
revoke all on public.compras_solicitacoes,public.compras_solicitacao_itens,public.compras_carrinhos,
 public.compras_carrinho_itens,public.compras_solicitacao_auditoria from public,anon,authenticated;
grant select,insert,update,delete on public.compras_solicitacoes,public.compras_solicitacao_itens,
 public.compras_carrinhos,public.compras_carrinho_itens to service_role;
grant select on public.compras_solicitacao_auditoria to service_role;
grant usage,select on sequence public.compras_solicitacao_auditoria_id_seq to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('compras-solicitacoes','compras-solicitacoes',false,5242880,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];
commit;