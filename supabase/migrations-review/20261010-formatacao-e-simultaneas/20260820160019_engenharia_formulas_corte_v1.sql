-- Migration: engenharia_formulas_corte_v1
-- Data: 2026-08-20
--
-- Objetivo: estrutura declarativa de variaveis condicionais e formulas de
-- corte por tipologia (nao por configuracao individual). Complementa
-- (nao substitui) o campo campos_corte de texto livre ja existente em
-- engenharia_variaveis_preset.
--
-- Fórmulas e variaveis desta migration foram derivadas de amostras reais
-- do W.Vetro (orcamento de teste #994), confirmadas com 2+ amostras cada,
-- fornecidas explicitamente pelo usuario. Nenhuma formula foi inventada
-- por semelhanca.
--
-- Regras de seguranca:
-- - aditiva, nao altera nenhuma tabela existente;
-- - as formulas sao texto interpretado por um parser aritmetico restrito
--   no aplicativo (lib/formulasCorteEngine.ts), sem eval;
-- - nenhum plano de corte real e gerado automaticamente por esta migration.

begin;

create table if not exists public.engenharia_tipologia_formulas_corte (
  id uuid primary key default gen_random_uuid(),
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  variaveis jsonb not null default '[]'::jsonb,
  pecas jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipologia_id)
);

comment on table public.engenharia_tipologia_formulas_corte is
  'Variaveis condicionais e formulas de corte por tipologia, derivadas de amostras reais do W.Vetro. Complementa engenharia_variaveis_preset.campos_corte (texto livre).';

alter table public.engenharia_tipologia_formulas_corte enable row level security;

drop policy if exists "authenticated_full_access" on public.engenharia_tipologia_formulas_corte;
create policy "authenticated_full_access"
  on public.engenharia_tipologia_formulas_corte
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed: Porta De Correr 03 Folhas (L. Suprema)
-- tipologia_id confirmado via UI: dce9da1d-7e03-4c1c-ad1b-2f101b51a52e
insert into public.engenharia_tipologia_formulas_corte (tipologia_id, variaveis, pecas, criado_por_nome)
values (
  'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e',
  '[
    {"chave": "perfil_mao_amigo", "label": "Perfil Mao-de-Amigo", "opcoes": ["largo", "comum"]},
    {"chave": "reforco_mao_amigo", "label": "Reforco Mao-de-Amigo", "opcoes": ["sem", "interno", "externo", "interno_e_externo"]},
    {"chave": "contramarco", "label": "Contramarco", "opcoes": ["nao", "cm200", "cm060"]}
  ]'::jsonb,
  '[
    {
      "codigo": "SU010",
      "descricao": "Marco Superior",
      "formula": "Largura - 30",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Largura - 54"}]
    },
    {
      "codigo": "TMC",
      "descricao": "Trilho macarrao de embutir",
      "formula": "SU010"
    },
    {
      "codigo": "SU012",
      "descricao": "Marco lateral / Correr 3",
      "formula": "Altura - 4",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Altura - 16"}]
    },
    {
      "codigo": "SU008",
      "descricao": "Mata junta / complemento do marco",
      "formula": "Altura - 17",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Altura - 29"}]
    },
    {
      "codigo": "SU280",
      "descricao": "Montante lateral da folha / reforco",
      "formula": "Altura - 34",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Altura - 46"}]
    },
    {
      "codigo": "SU102(H)",
      "descricao": "Baguete vertical",
      "formula": "Altura - 185"
    },
    {
      "grupo": "montante_mao_amigo_interno",
      "descricao": "Montante Mao-de-Amigo Interno (codigo do perfil varia por combinacao)",
      "formula": "Altura - 34",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Altura - 46"}],
      "variaveis_chave": ["perfil_mao_amigo", "reforco_mao_amigo"],
      "mapa_codigo": {
        "largo|sem": "SU243", "largo|interno": "SU289", "largo|externo": "SU243", "largo|interno_e_externo": "SU289",
        "comum|sem": "SU040", "comum|interno": "SU047", "comum|externo": "SU040", "comum|interno_e_externo": "SU047"
      }
    },
    {
      "grupo": "montante_mao_amigo_externo",
      "descricao": "Montante Mao-de-Amigo Externo (codigo do perfil varia por combinacao)",
      "formula": "Altura - 34",
      "condicoes": [{"quando": {"contramarco": ["cm200", "cm060"]}, "formula": "Altura - 46"}],
      "variaveis_chave": ["perfil_mao_amigo", "reforco_mao_amigo"],
      "mapa_codigo": {
        "largo|sem": "SU242", "largo|interno": "SU242", "largo|externo": "SU290", "largo|interno_e_externo": "SU290",
        "comum|sem": "SU041", "comum|interno": "SU041", "comum|externo": "SU049", "comum|interno_e_externo": "SU049"
      }
    },
    {
      "grupo": "travessas",
      "descricao": "SU053 / SU225 / SU102(L) baguete horizontal, por folha",
      "variaveis_chave": ["perfil_mao_amigo"],
      "formula_por_variavel": {
        "largo": "ROUND(SU010 / 3) - 67",
        "comum": "ROUND(SU010 / 3) - 52"
      }
    },
    {
      "codigo": "CM",
      "descricao": "Contramarco (CM200 26mm ou CM060 38mm, mesma formula de corte)",
      "formula_L": "Largura - 48",
      "formula_H": "Altura - 24",
      "condicao_ativa": {"contramarco": ["cm200", "cm060"]}
    },
    {
      "codigo": "MP347",
      "descricao": "Arremate face interna",
      "formula_L": "Largura + 20",
      "formula_H": "Altura + 10",
      "condicao_ativa": {"contramarco": ["cm200", "cm060"]}
    }
  ]'::jsonb,
  'francis (via amostras reais W.Vetro, orcamento teste #994)'
)
on conflict (tipologia_id) do update set
  variaveis = excluded.variaveis,
  pecas = excluded.pecas,
  updated_at = now();

commit;
