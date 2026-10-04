-- Rastreia a origem da margem do orçamento para que sincronizações não sobrescrevam negociação manual.
alter table public.orcamentos
  add column if not exists margem_padrao_origem text not null default 'sistema',
  add column if not exists margem_regra_cidade_id uuid null references public.orcamento_margens_cidade(id) on delete set null;

alter table public.orcamentos
  drop constraint if exists orcamentos_margem_padrao_origem_check;
alter table public.orcamentos
  add constraint orcamentos_margem_padrao_origem_check
  check (margem_padrao_origem in ('sistema','cidade','manual'));

-- Antes desta versão, valores diferentes do padrão histórico de 40% só poderiam ter sido ajustados pelo usuário.
update public.orcamentos
set margem_padrao_origem = 'manual'
where margem_padrao_pct is distinct from 40
  and margem_padrao_origem = 'sistema';

create index if not exists orcamentos_margem_regra_cidade_idx
  on public.orcamentos(empresa_id, margem_regra_cidade_id)
  where margem_regra_cidade_id is not null;

comment on column public.orcamentos.margem_padrao_origem is
  'Origem do markup geral: sistema, regra por cidade ou ajuste manual. Sincronizações não sobrescrevem manual.';
comment on column public.orcamentos.margem_regra_cidade_id is
  'Regra versionada por cidade usada como snapshot ao criar/sincronizar o orçamento.';