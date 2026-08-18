# Carga de linha_tipologias e linha_produtos — 2026-08-18

## Problema

`linhas_tecnicas` já tinha 5 linhas cadastradas (SUPREMA, GOLD, LINHA 30, PELE
DE VIDRO / FACHADA ATLANTA, REVESTIMENTO RIPADO), mas `linha_tipologias` e
`linha_produtos` estavam com 0 registros. Como
`components/orcamento/SeletorEsquadriaInteligente.tsx` filtra o dropdown de
modelo estritamente por `linha.tipologia_ids` (vindo de `linha_tipologias`),
qualquer linha selecionada no orçamento mostrava "Nenhum modelo disponível" —
incluindo SUPREMA → Porta de Correr 03 Folhas.

## Fontes W.Vetro disponíveis (ETAPA 2/3)

Não existe integração/API viva do W.Vetro configurada no repositório ou no
ambiente. Toda a base W.Vetro hoje em produção veio de dois exports manuais já
importados e reconciliados:

- `ExportWWPerfil (1)(1).xlsx` → 1.307 produtos `categoria = 'perfil'`.
- `ExportWWAcessorios.xlsx` → 1.174 produtos `categoria = 'acessorio'`.

Isso resolve a pendência histórica "Explicar ao usuário a limitação de
credenciais Wvetro": não há nova extração possível agora além do que já está
em `produtos.dados_origem`.

## Fonte usada para linha_tipologias

`tipologias.label` já segue o padrão `"Modelo (Linha)"`, herdado de uma
extração anterior de 1.038 vendas/orçamentos W.Vetro (109 tipologias novas
identificadas naquela época). O token entre parênteses no final do label foi
comparado, com igualdade exata (case-insensitive, sem fuzzy/normalização) ao
`nome` ou a algum item de `apelidos` de `linhas_tecnicas`.

Resultado (vínculos seguros, todos com match exato):

| Linha técnica | Tipologias vinculadas |
|---|---|
| SUPREMA | 23 |
| GOLD | 17 |
| LINHA 30 | 5 |
| PELE DE VIDRO / FACHADA ATLANTA | 1 |
| REVESTIMENTO RIPADO | 0 |

Total: **46 pares**. Inclui explicitamente `SUPREMA → Porta De Correr 03
Folhas` (`tipologias.chave = 'l_suprema_porta_de_correr_03_folhas'`).

REVESTIMENTO RIPADO não recebeu vínculo: seus apelidos cadastrados são
`"RIPADO"` e `"REVESTIMENTO RIPADO"`, mas as tipologias da fonte usam o token
`"Ripados"` (plural) — não é igualdade exata. Também existe uma tipologia solta
`painel_ripado_revestimento`, sem nenhuma linha entre parênteses no label.
Ambos ficam pendentes de decisão humana (ajustar apelidos da linha técnica ou
tratar manualmente).

## Fonte usada para linha_produtos

`produtos.dados_origem->>'linha_raw'` preserva o campo "Linha" bruto da
planilha de origem, mas **somente para acessórios** — perfis
(`ExportWWPerfil`) não têm esse campo na fonte, apenas `fabricante_raw` (marca,
ex. "ASA") e a descrição livre do produto.

Resultado (vínculos seguros, todos com `linha_raw` idêntico a nome/apelido):

| Linha técnica | Produtos vinculados | Códigos |
|---|---|---|
| SUPREMA | 2 | FRA-820, GUA256 |
| GOLD | 1 | ANTIPANICO |
| PELE DE VIDRO / FACHADA ATLANTA | 5 | BMT-GUA-2202, BMT-ANC-3246-NAT, BMT-LUV-0346, BMT-GUA-2250, BMT-ESP-1806-PEE |

Total: **8 pares**.

Não vinculados, ficam pendentes:

- Todos os 1.307 perfis: sem campo de Linha na fonte; vincular pelo nome
  (ex. "MARCO LATERAL / SUPREMA") seria semelhança de nome, proibido pela
  regra do usuário.
- 1 acessório com `linha_raw = "GOLD - LINHA GOLD"` (não é igual a nenhum
  apelido cadastrado de GOLD).
- LINHA 30 e REVESTIMENTO RIPADO: nenhum acessório com `linha_raw` idêntico.

## Achado à parte (RLS)

Auditoria de segurança do Supabase aponta RLS desabilitado em
`engenharia_conferencias`, `engenharia_receitas` e
`engenharia_receita_componentes`. Não foi alterado nesta tarefa; fica
registrado para decisão futura.

## Migration

`supabase/migrations/20260818020000_linha_tipologias_produtos_biblioteca_tecnica_v1.sql`

- Idempotente (`ON CONFLICT DO NOTHING`), sem UPDATE/DELETE em nenhuma tabela.
- Gera os 46 + 8 pares acima via SELECT idêntico ao usado nesta auditoria.
- Contém pós-checks que abortam a transação se os limiares mínimos esperados
  não forem atingidos, incluindo a checagem explícita de
  `SUPREMA → Porta de Correr 03 Folhas`.
- Não aplicada em produção nesta etapa — depende de autorização explícita.
