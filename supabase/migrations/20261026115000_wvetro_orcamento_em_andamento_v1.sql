-- Kanban Comercial: etapa de conferência entre receber e orçamento feito.
-- A migração é por empresa, mantém IDs, cores e dados comerciais existentes.
begin;

alter table public.orcamentos
  add column if not exists kanban_motivo_andamento text;

-- Criar somente quando a etapa ainda não existir. Ordem 2, sem tocar em
-- __BALCAO_INTERNO__. Ordens anteriores são preservadas relativamente.
do $$
declare e record;
begin
 for e in
   select distinct k.empresa_id
     from public.kanban_colunas k
    where lower(btrim(k.nome))='fazer orçamento'
      and exists(select 1 from public.kanban_colunas v where v.empresa_id=k.empresa_id and lower(btrim(v.nome))='orçamento feito')
 loop
  perform 1 from public.empresas where id=e.empresa_id for update;
  if not exists(select 1 from public.kanban_colunas where empresa_id=e.empresa_id and lower(btrim(nome))='em andamento') then
    update public.kanban_colunas
       set ordem=ordem+1
     where empresa_id=e.empresa_id and ordem>=2 and ordem<999999;
    insert into public.kanban_colunas
      (empresa_id,nome,ordem,cor,cor_cards,gera_medicao_final,personalizada)
    values (e.empresa_id,'Em andamento',2,'#2563eb','#f59e0b',false,false);
  end if;
 end loop;
end $$;

-- Ponto de restauração: registrar os cartões elegíveis antes de qualquer movimento.
-- Tabela privada, nunca exposta aos usuários; não inclui PDFs, dados pessoais ou valores.
create table if not exists private.atlas_wvetro_em_andamento_backup_20261026 (
  orcamento_id uuid primary key,
  empresa_id uuid not null,
  coluna_id uuid,
  coluna_atualizada_em timestamptz,
  kanban_motivo_andamento text,
  registrado_em timestamptz not null default now()
);
revoke all on private.atlas_wvetro_em_andamento_backup_20261026 from public, anon, authenticated;
grant select on private.atlas_wvetro_em_andamento_backup_20261026 to service_role;

insert into private.atlas_wvetro_em_andamento_backup_20261026
  (orcamento_id,empresa_id,coluna_id,coluna_atualizada_em,kanban_motivo_andamento)
select o.id,o.empresa_id,o.coluna_id,o.coluna_atualizada_em,o.kanban_motivo_andamento
  from public.orcamentos o
  join public.kanban_colunas feito on feito.id=o.coluna_id and feito.empresa_id=o.empresa_id
 where lower(btrim(feito.nome))='orçamento feito'
   and coalesce(o.wvetro_fluxo->>'origem','')='wvetro_api'
   and lower(coalesce(o.wvetro_fluxo->>'validacao_status',''))<>'validado'
   and coalesce(o.modo_entrada,'')<>'wvetro_api_vinculado'
on conflict (orcamento_id) do nothing;

create or replace function public.validar_etapa_andamento_orcamento_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare nome_destino text; eh_wvetro boolean; item jsonb; validacao jsonb; parte record;
begin
 if new.coluna_id is null then return new; end if;
 if tg_op='UPDATE' then
   if new.coluna_id is not distinct from old.coluna_id then return new; end if;
 end if;
 select lower(btrim(k.nome)) into nome_destino
   from public.kanban_colunas k
  where k.id=new.coluna_id and k.empresa_id=new.empresa_id;
 if nome_destino='em andamento' and length(btrim(coalesce(new.kanban_motivo_andamento,'')))<8 then
   raise exception 'Informe por que o orçamento está em andamento (mínimo 8 caracteres).';
 end if;
 eh_wvetro = coalesce(new.wvetro_fluxo->>'origem','')='wvetro_api';
 if nome_destino='orçamento feito' and eh_wvetro then
   if lower(coalesce(new.wvetro_fluxo->>'validacao_status',''))<>'validado' then
     raise exception 'Orçamento W.Vetro só pode ir para Orçamento feito após validação.';
   end if;
   if new.wvetro_fluxo->>'validacao_por_item'='true' then
     if jsonb_typeof(new.itens)<>'array' or jsonb_array_length(new.itens)=0 then
       raise exception 'Valide todas as esquadrias W.Vetro antes de concluir o orçamento.';
     end if;
     for item in select value from jsonb_array_elements(new.itens) loop
       validacao = new.wvetro_fluxo->'validacoes_itens'->(item->>'id')->'snapshot';
       if jsonb_typeof(validacao)<>'object' or validacao='{}'::jsonb then
         raise exception 'Há esquadrias W.Vetro sem validação.';
       end if;
       for parte in select key,value from jsonb_each(validacao) loop
         if coalesce(item->parte.key,'null'::jsonb) is distinct from parte.value then
           raise exception 'Uma esquadria W.Vetro foi alterada depois da validação.';
         end if;
       end loop;
     end loop;
   end if;
 end if;
 return new;
end $$;

drop trigger if exists validar_etapa_andamento_orcamento_v1 on public.orcamentos;
create trigger validar_etapa_andamento_orcamento_v1
before insert or update of coluna_id on public.orcamentos
for each row execute function public.validar_etapa_andamento_orcamento_v1();

-- Apenas documentos importados ainda pendentes no lugar incorreto.
-- NÃO tocar os validados, enviados, vendidos ou em outra etapa.
with alterados as (
 update public.orcamentos o
    set coluna_id=em.id,
        kanban_motivo_andamento='Orçamento importado do W.Vetro; aguardando validação, conferência técnica ou correções pendentes.',
        coluna_atualizada_em=now()
   from public.kanban_colunas feito
   join public.kanban_colunas em on em.empresa_id=feito.empresa_id and lower(btrim(em.nome))='em andamento'
  where feito.id=o.coluna_id and feito.empresa_id=o.empresa_id and lower(btrim(feito.nome))='orçamento feito'
    and coalesce(o.wvetro_fluxo->>'origem','')='wvetro_api'
    and lower(coalesce(o.wvetro_fluxo->>'validacao_status',''))<>'validado'
    and coalesce(o.modo_entrada,'')<>'wvetro_api_vinculado'
 returning o.id,o.empresa_id
)
insert into public.historico (empresa_id,orcamento_id,usuario_nome,acao,detalhes)
select a.empresa_id,a.id,'Sistema Atlas',
       'Reclassificou orçamento W.Vetro pendente',
       'Importação W.Vetro aguardando conferência. Movido de Orçamento feito para Em andamento, sem excluir dados.'
  from alterados a;

commit;
