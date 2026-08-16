# Auditoria de Produtos (W.Vetro) — 2026-08-16

Feita antes da migration `20260816180000_produtos_identidade_tecnica_v1.sql`,
com o script reutilizável `scripts/auditoria-produtos-wvetro.sql`.

## Divergência encontrada em relação ao pedido original

O pedido descreve duas bases já importadas: `ExportWWPerfil` (~1.307 perfis) e
`ExportWWAcessorios` (~1.174 acessórios). No banco real (`public.produtos`)
hoje existem:

- **1.307 perfis** — confere. Importado nesta mesma sessão a partir do
  arquivo `ExportWWPerfil (1).xlsx` (479 produtos já cadastrados
  atualizados + 828 novos cadastrados).
- **392 acessórios** — não confere. Vieram de uma extração histórica via API
  W.Vetro (ver `docs/ai-handoff/NEXT_TASK.md`, seção "W.Vetro extração
  histórica"), com `preco = 0` como placeholder. O arquivo
  `ExportWWAcessorios` (~1.174 linhas) **nunca foi enviado nem importado**
  nesta conversa — não existe no repositório nem no banco.

Esta implementação foi feita para funcionar com os dados que **já existem**
(1.307 perfis + 392 acessórios). Nenhum dado de `ExportWWAcessorios` foi
inventado ou assumido. Quando esse arquivo for enviado, a mesma estrutura
(campos `codigo`/`origem`/`dados_origem`/`ncm_status`/etc.) já está pronta
para recebê-lo.

## Resumo numérico (1.700 produtos: 1.307 perfil + 392 acessório + 1 porta/janela padrão)

| Métrica | Valor |
|---|---|
| Sem código extraível de `nome` | 0 |
| Códigos duplicados (case-insensitive) | 0 |
| Sem unidade | 0 |
| NCM placeholder (`0`, vazio, `12345678`, `12345667`) | 279 |
| NCM com tamanho ≠ 8 dígitos (além dos placeholders) | 14 |
| Peso de perfil suspeito (> 50 kg) | 2 |
| Peso de perfil ≤ 0 | 0 |
| Produtos sem `linha_id` vinculado | 1.700 (100%) |
| Produtos sem `cor_id` vinculado | 1.700 (100%) |
| Linhas cadastradas com nome "GERAL" | 0 |
| Cores cadastradas com nome puramente numérico (ex. "15") | 0 |

## Classificação

| Classificação | Quantidade |
|---|---|
| OK | 1.405 |
| ATENÇÃO | 14 |
| REVISAR | 281 |

REVISAR = 279 com NCM placeholder + 2 com peso de perfil fora da faixa
plausível (nenhum dos dois tem duplicidade ou está sem código).
ATENÇÃO = 14 produtos com NCM presente mas com quantidade de dígitos
diferente de 8 (não é placeholder óbvio, mas não bate com o padrão fiscal).

## Casos específicos sinalizados

- **Código `0000000056` — SU 012 LATERAL LISA**: peso de origem 3462 kg.
  Fora da faixa plausível de perfil de alumínio (0,1–5 kg/m). Ainda não usado
  em nenhuma receita de Engenharia nem Plano de Corte.
- **Código `0000000171` — SU 050 TRAVESSA CENTRAL**: peso de origem 11538
  kg. Mesmo problema do item acima.
- Ambos ficam com `observacao_validacao` preenchida pela migration, sem
  alterar o valor numérico de origem.
- **Tamanho de barra (coluna "Tamanho" do W.Vetro, ainda não populada)**:
  1.262 dos 1.307 perfis vieram com 6000 mm (padrão do setor). 6 vieram com
  valor `6` (provável confusão metro/milímetro) e 1 veio com `60000`
  (provável erro de digitação). As colunas `tamanho_barra_mm` /
  `tamanho_barra_mm_origem` já existem (criadas nesta migration), mas o
  backfill a partir do arquivo `ExportWWPerfil (1).xlsx` **não foi aplicado
  nesta PR** — ficou de fora por tamanho/escopo (é uma segunda migration de
  ~1.300 linhas de `VALUES`, gerável a qualquer momento a partir do mesmo
  arquivo já usado para peso/NCM). Ver `docs/ai-handoff/NEXT_TASK.md`.

## Sem problema hoje, mas risco real na futura importação de acessórios

- Nenhuma linha chamada "GERAL" existe na tabela `linhas` hoje — mas a
  planilha `ExportWWAcessorios` (ainda não importada) tem essa coluna, e o
  pedido é explícito: "GERAL" é dado de origem, não deve virar vínculo
  técnico automático quando essa importação acontecer.
- Nenhuma cor puramente numérica (ex. "15") existe na tabela `cores` hoje —
  mesmo aviso: preservar como código de origem, não criar cor com nome "15".
