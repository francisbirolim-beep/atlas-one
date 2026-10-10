-- Editor técnico de fórmulas por configuração + sementes Suprema validadas/em validação.
-- Mantém fórmulas de produção separadas por configuração e preserva histórico de alterações.

begin;

alter table public.engenharia_tipologia_formulas_corte
  add column if not exists configuracao_chave text,
  add column if not exists configuracao_label text,
  add column if not exists status text not null default 'em_desenvolvimento',
  add column if not exists versao integer not null default 1,
  add column if not exists observacoes text,
  add column if not exists vidro jsonb not null default '{}'::jsonb;

update public.engenharia_tipologia_formulas_corte
set configuracao_chave = coalesce(configuracao_chave, 'legado_wvetro_994'),
    configuracao_label = coalesce(configuracao_label, 'Legado W.Vetro #994'),
    status = coalesce(status, 'em_validacao')
where configuracao_chave is null or configuracao_label is null;

alter table public.engenharia_tipologia_formulas_corte
  alter column configuracao_chave set default 'padrao',
  alter column configuracao_chave set not null,
  alter column configuracao_label set default 'Padrão',
  alter column configuracao_label set not null;

alter table public.engenharia_tipologia_formulas_corte
  drop constraint if exists engenharia_tipologia_formulas_corte_tipologia_id_key;

create unique index if not exists engenharia_tipologia_formula_config_uidx
  on public.engenharia_tipologia_formulas_corte (tipologia_id, configuracao_chave);

create table if not exists public.engenharia_tipologia_formulas_corte_historico (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.engenharia_tipologia_formulas_corte(id) on delete cascade,
  versao integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.engenharia_tipologia_formulas_corte_historico enable row level security;
drop policy if exists "authenticated_read_formula_history" on public.engenharia_tipologia_formulas_corte_historico;
create policy "authenticated_read_formula_history"
  on public.engenharia_tipologia_formulas_corte_historico
  for select to authenticated using (true);

create or replace function public.registrar_historico_formula_corte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if row(NEW.variaveis, NEW.pecas, NEW.vidro, NEW.configuracao_label, NEW.status, NEW.ativo, NEW.observacoes)
     is distinct from
     row(OLD.variaveis, OLD.pecas, OLD.vidro, OLD.configuracao_label, OLD.status, OLD.ativo, OLD.observacoes) then
    insert into public.engenharia_tipologia_formulas_corte_historico (formula_id, versao, snapshot)
    values (OLD.id, OLD.versao, to_jsonb(OLD));
    NEW.versao := OLD.versao + 1;
    NEW.updated_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_historico_formula_corte on public.engenharia_tipologia_formulas_corte;
create trigger trg_historico_formula_corte
before update on public.engenharia_tipologia_formulas_corte
for each row execute function public.registrar_historico_formula_corte();

-- Tipologias 8 e 9 folhas ainda não existiam no catálogo. Entram como base técnica,
-- sem associação automática a linha comercial nesta migration.
insert into public.tipologias (chave, label, categoria, ordem)
select 'l_suprema_porta_de_correr_08_folhas', 'Porta De Correr 08 Folhas (L. Suprema)', 'porta', 91
where not exists (select 1 from public.tipologias where chave = 'l_suprema_porta_de_correr_08_folhas');

insert into public.tipologias (chave, label, categoria, ordem)
select 'l_suprema_porta_de_correr_09_folhas', 'Porta De Correr 09 Folhas (L. Suprema)', 'porta', 92
where not exists (select 1 from public.tipologias where chave = 'l_suprema_porta_de_correr_09_folhas');

-- A fórmula usa LF/HF como largura/altura final menos 4 mm de folga total.
-- CEIL é interpretado pelo motor do Atlas e implementa a regra: qualquer decimal arredonda para cima.
do $$
declare
  r record;
  desconto integer;
  desconto_vidro integer;
  pecas jsonb;
  vidro_cfg jsonb;
  status_cfg text;
  ativo_cfg boolean;
begin
  -- Mão-amiga comum/estreita sem reforço: base 162 e +18 mm por folha adicional (2F a 6F).
  for r in
    select * from (values
      ('l_suprema_porta_de_correr_02_folhas', 2),
      ('l_suprema_porta_de_correr_03_folhas', 3),
      ('l_suprema_porta_de_correr_04_folhas', 4),
      ('l_suprema_porta_de_correr_05_folhas', 5),
      ('l_suprema_porta_de_correr_06_folhas', 6)
    ) as x(chave, folhas)
  loop
    desconto := 162 + (18 * (r.folhas - 2));
    desconto_vidro := desconto + (6 * r.folhas);
    status_cfg := case when r.folhas = 2 then 'validada' else 'em_validacao' end;
    ativo_cfg := r.folhas = 2;

    pecas := jsonb_build_array(
      jsonb_build_object('codigo','SU053','descricao','Travessa superior da folha','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas,'eixo','L','composicao_desconto',format('%s mm = 162 + 18 × (%s - 2)', desconto, r.folhas)),
      jsonb_build_object('codigo','SU225','descricao','Travessa inferior da folha','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas,'eixo','L','composicao_desconto',format('%s mm = 162 + 18 × (%s - 2)', desconto, r.folhas)),
      jsonb_build_object('codigo','SU280','descricao','Montante lateral largo com reforço de aba','formula','HF - 30','quantidade',2,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU040','descricao','Mão-amiga interna comum sem reforço','formula','HF - 30','quantidade',r.folhas - 1,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU041','descricao','Mão-amiga externa comum sem reforço','formula','HF - 30','quantidade',r.folhas - 1,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU102','descricao','Baguete horizontal','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas * 2,'eixo','L','composicao_desconto',format('%s mm = mesmo desconto estrutural da travessa', desconto)),
      jsonb_build_object('codigo','SU102','descricao','Baguete vertical','formula','HF - 181','quantidade',r.folhas * 2,'eixo','H','composicao_desconto','181 mm vertical; decomposição física ainda pendente')
    );

    if r.folhas = 2 then
      pecas := jsonb_build_array(
        jsonb_build_object('codigo','CM060','descricao','Contramarco horizontal','formula','LF - 20','quantidade',1,'eixo','L','composicao_desconto','20 mm total; decomposição física ainda pendente'),
        jsonb_build_object('codigo','CM060','descricao','Contramarco vertical','formula','HF - 8','quantidade',2,'eixo','H','composicao_desconto','8 mm total; decomposição física ainda pendente'),
        jsonb_build_object('codigo','MP347','descricao','Arremate face interna horizontal','formula','LF + 48','quantidade',1,'eixo','L','composicao_desconto','acréscimo total de 48 mm; decomposição física ainda pendente'),
        jsonb_build_object('codigo','MP347','descricao','Arremate face interna vertical','formula','HF + 26','quantidade',2,'eixo','H','composicao_desconto','acréscimo total de 26 mm; decomposição física ainda pendente'),
        jsonb_build_object('codigo','SU001','descricao','Marco superior / correr 2','formula','LF - 26','quantidade',1,'eixo','L','composicao_desconto','13 + 13 = 26 mm'),
        jsonb_build_object('codigo','TMC','descricao','Trilho macarrão','formula','LF - 26','quantidade',2,'eixo','L','composicao_desconto','13 + 13 = 26 mm'),
        jsonb_build_object('codigo','SU007','descricao','Marco lateral / correr 2','formula','HF','quantidade',2,'eixo','H','composicao_desconto','sem desconto adicional sobre HF'),
        jsonb_build_object('codigo','SU008','descricao','Mata-junta / complemento do marco','formula','HF - 13','quantidade',2,'eixo','H','composicao_desconto','13 mm')
      ) || pecas;
    end if;

    vidro_cfg := jsonb_build_object(
      'formula_largura', format('CEIL((LF - %s) / %s)', desconto_vidro, r.folhas),
      'formula_altura', 'HF - 163',
      'quantidade', r.folhas,
      'arredondamento', 'sempre_para_cima',
      'composicao_largura', format('%s mm = desconto estrutural %s + 6 mm × %s folhas', desconto_vidro, desconto, r.folhas),
      'composicao_altura', '163 mm total; decomposição física ainda pendente'
    );

    insert into public.engenharia_tipologia_formulas_corte
      (tipologia_id, configuracao_chave, configuracao_label, variaveis, pecas, vidro, status, ativo, observacoes, criado_por_nome)
    select
      t.id,
      'mao_amiga_comum_sem_reforco',
      'Mão-amiga comum sem reforço',
      '[]'::jsonb,
      pecas,
      vidro_cfg,
      status_cfg,
      ativo_cfg,
      case when r.folhas = 2
        then 'PC2 comum validada por comparação em duas medidas. CM060/MP347 mantidos na configuração fixa.'
        else 'Regra de largura confirmada pelo usuário: +18 mm no desconto por folha adicional. Marcos/trilhos específicos desta quantidade ainda devem ser validados antes de liberar produção.'
      end,
      'Francis + ChatGPT — validação técnica 2026-08-22'
    from public.tipologias t where t.chave = r.chave
    on conflict (tipologia_id, configuracao_chave) do update set
      configuracao_label = excluded.configuracao_label,
      pecas = excluded.pecas,
      vidro = excluded.vidro,
      status = excluded.status,
      ativo = excluded.ativo,
      observacoes = excluded.observacoes,
      updated_at = now();
  end loop;

  -- Mão-amiga larga sem reforço: base 181 e +41 mm por folha adicional (2F a 9F).
  for r in
    select * from (values
      ('l_suprema_porta_de_correr_02_folhas', 2),
      ('l_suprema_porta_de_correr_03_folhas', 3),
      ('l_suprema_porta_de_correr_04_folhas', 4),
      ('l_suprema_porta_de_correr_05_folhas', 5),
      ('l_suprema_porta_de_correr_06_folhas', 6),
      ('l_suprema_porta_de_correr_07_folhas', 7),
      ('l_suprema_porta_de_correr_08_folhas', 8),
      ('l_suprema_porta_de_correr_09_folhas', 9)
    ) as x(chave, folhas)
  loop
    desconto := 181 + (41 * (r.folhas - 2));
    desconto_vidro := desconto + (6 * r.folhas);

    pecas := jsonb_build_array(
      jsonb_build_object('codigo','SU053','descricao','Travessa superior da folha','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas,'eixo','L','composicao_desconto',format('%s mm = 181 + 41 × (%s - 2)', desconto, r.folhas)),
      jsonb_build_object('codigo','SU225','descricao','Travessa inferior da folha','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas,'eixo','L','composicao_desconto',format('%s mm = 181 + 41 × (%s - 2)', desconto, r.folhas)),
      jsonb_build_object('codigo','SU280','descricao','Montante lateral largo com reforço de aba','formula','HF - 30','quantidade',2,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU243','descricao','Mão-amiga interna larga sem reforço','formula','HF - 30','quantidade',r.folhas - 1,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU242','descricao','Mão-amiga externa larga sem reforço','formula','HF - 30','quantidade',r.folhas - 1,'eixo','H','composicao_desconto','30 mm total; decomposição física perfil a perfil ainda pendente'),
      jsonb_build_object('codigo','SU102','descricao','Baguete horizontal','formula',format('CEIL((LF - %s) / %s)', desconto, r.folhas),'quantidade',r.folhas * 2,'eixo','L','composicao_desconto',format('%s mm = mesmo desconto estrutural da travessa', desconto)),
      jsonb_build_object('codigo','SU102','descricao','Baguete vertical','formula','HF - 181','quantidade',r.folhas * 2,'eixo','H','composicao_desconto','181 mm vertical; decomposição física ainda pendente')
    );

    if r.folhas = 2 then
      pecas := jsonb_build_array(
        jsonb_build_object('codigo','CM060','descricao','Contramarco horizontal','formula','LF - 20','quantidade',1,'eixo','L','composicao_desconto','20 mm total; decomposição física ainda pendente'),
        jsonb_build_object('codigo','CM060','descricao','Contramarco vertical','formula','HF - 8','quantidade',2,'eixo','H','composicao_desconto','8 mm total; decomposição física ainda pendente'),
        jsonb_build_object('codigo','MP347','descricao','Arremate face interna horizontal','formula','LF + 48','quantidade',1,'eixo','L','composicao_desconto','acréscimo total de 48 mm; decomposição física ainda pendente'),
        jsonb_build_object('codigo','MP347','descricao','Arremate face interna vertical','formula','HF + 26','quantidade',2,'eixo','H','composicao_desconto','acréscimo total de 26 mm; decomposição física ainda pendente'),
        jsonb_build_object('codigo','SU001','descricao','Marco superior / correr 2','formula','LF - 26','quantidade',1,'eixo','L','composicao_desconto','13 + 13 = 26 mm'),
        jsonb_build_object('codigo','TMC','descricao','Trilho macarrão','formula','LF - 26','quantidade',2,'eixo','L','composicao_desconto','13 + 13 = 26 mm'),
        jsonb_build_object('codigo','SU007','descricao','Marco lateral / correr 2','formula','HF','quantidade',2,'eixo','H','composicao_desconto','sem desconto adicional sobre HF'),
        jsonb_build_object('codigo','SU008','descricao','Mata-junta / complemento do marco','formula','HF - 13','quantidade',2,'eixo','H','composicao_desconto','13 mm')
      ) || pecas;
    end if;

    vidro_cfg := jsonb_build_object(
      'formula_largura', format('CEIL((LF - %s) / %s)', desconto_vidro, r.folhas),
      'formula_altura', 'HF - 163',
      'quantidade', r.folhas,
      'arredondamento', 'sempre_para_cima',
      'composicao_largura', format('%s mm = desconto estrutural %s + 6 mm × %s folhas', desconto_vidro, desconto, r.folhas),
      'composicao_altura', '163 mm total; decomposição física ainda pendente'
    );

    insert into public.engenharia_tipologia_formulas_corte
      (tipologia_id, configuracao_chave, configuracao_label, variaveis, pecas, vidro, status, ativo, observacoes, criado_por_nome)
    select
      t.id,
      'mao_amiga_larga_sem_reforco',
      'Mão-amiga larga sem reforço',
      '[]'::jsonb,
      pecas,
      vidro_cfg,
      'em_validacao',
      false,
      case
        when r.folhas = 2 then 'PC2 larga: desconto 181 mm e arredondamento para cima confirmados nesta validação. Aguardando comparação final W.Vetro para liberar produção.'
        when r.folhas = 7 then 'Regra de largura +41 mm confirmada. Composição estrutural superior 4+3 planos permanece em validação; não foi inserida como perfil automático.'
        when r.folhas = 8 then 'Regra matemática +41 mm cadastrada. Composição dos marcos/trilhos de 8 folhas ainda não foi validada e não é gerada automaticamente.'
        when r.folhas = 9 then 'Regra de largura +41 mm confirmada. Composição estrutural superior 5+4 planos permanece em validação; não foi inserida como perfil automático.'
        else 'Regra de largura confirmada pelo usuário: +41 mm no desconto por folha adicional. Marcos/trilhos específicos desta quantidade ainda devem ser validados antes de liberar produção.'
      end,
      'Francis + ChatGPT — validação técnica 2026-08-22'
    from public.tipologias t where t.chave = r.chave
    on conflict (tipologia_id, configuracao_chave) do update set
      configuracao_label = excluded.configuracao_label,
      pecas = excluded.pecas,
      vidro = excluded.vidro,
      status = excluded.status,
      ativo = excluded.ativo,
      observacoes = excluded.observacoes,
      updated_at = now();
  end loop;
end;
$$;

commit;
