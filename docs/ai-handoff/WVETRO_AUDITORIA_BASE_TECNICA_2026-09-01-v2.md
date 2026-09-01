# Auditoria completa — Base técnica W.Vetro para Orçamento Sob Medida (2026-09-01, v2)

Segunda rodada de auditoria, feita com a carga histórica em andamento (após o
retrabalho do ChatGPT em `wvetro_tipologia_componentes`/`updated_at`, tratado
na PR #306). Números obtidos por consulta direta ao Supabase de produção
(projeto `urtqbvjpwnrfaayolymt`) nesta data. Esta auditoria **não altera**
execução/checkpoint/cursor/retry/pendências da carga — é só leitura.

A versão anterior (pré-retomada) está em
`WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01.md`. Esta substitui os números,
mantém a estrutura.

## 1. Execução da carga histórica (contexto — tratado pelo ChatGPT/PR #306)

| Item | Valor |
|---|---|
| Status | `em_andamento` |
| Dias processados | 859 de ~987 (87%) |
| Dias em pendência (registrados, não travam o cursor) | 128 |
| Cursor em | 2026-05-09 |
| Período alvo | 2024-01-01 a 2026-09-01 |

## 2. Tipologias / Linhas / Modelos

| Item | Valor |
|---|---|
| Tipologias no Atlas | 122 (aprox., não remedido nesta rodada) |
| Referências de tipologia (`wvetro_referencias_tipologias`) | 113 |
| Referências vinculadas a tipologia Atlas | ver tela do explorador (>98% historicamente) |
| Referências com imagem de tipologia | 86 de 113 (76%) — subiu de 11% (auditoria anterior) para 34/111 (30%) e agora 76% |
| Referências com composição (BOM) | 21 de 113 (19%) |

## 3. Catálogo de referência — perfis e acessórios (`wvetro_referencias_componentes`)

| Item | Total | Vinculados a produto Atlas |
|---|---|---|
| Perfis | 1.529 | 1.385 (91%) |
| Acessórios | 1.294 | 1.265 (98%) |

Sem mudança relevante desde a auditoria anterior — este catálogo de
identidade/preço histórico já estava avançado e não depende diretamente do
avanço da carga de composição.

## 4. Composição por tipologia (BOM) — `wvetro_tipologia_componentes` — PRINCIPAL GARGALO

| Item | Valor anterior (664 dias) | Valor atual (859 dias) |
|---|---|---|
| Linhas de BOM | 504 | **668** |
| Vinculadas a produto Atlas | 264 | **338** (51%) |
| Tipologias com alguma composição | 17 de 111 | **21 de 113** (19%) |
| Linhas tipo vidro | 3 (rodada original) | **21** |
| Com posições preenchidas | — | 354 |
| Com cortes preenchidos | — | 369 |
| Com NCM preenchido | — | 913 |
| Com unidade de origem preenchida | — | **0** (gap real — coluna nunca alimentada nesta etapa da carga) |
| Com cor preenchida | — | 892 |
| Com custo (min/max) preenchido | — | 913 |
| Com venda (min/max) preenchida | — | 913 |

**Ainda é o gargalo.** Mesmo com a carga em 87% do período, só 19% das
tipologias-referência têm alguma linha de composição — a maioria dos dias
processados ainda não gerou BOM para a maior parte das 113 tipologias.
Achado novo: `unidade_origem` está sempre nulo em `wvetro_tipologia_componentes`
apesar de existir como coluna — não é um problema desta auditoria resolver
(pertence à extração da carga, tratada pelo ChatGPT), mas fica documentado.

## 5. Custo/venda refletidos em `produtos`

| Item | Valor |
|---|---|
| Produtos no Atlas | 2.485 |
| Produtos com `custo_wvetro_ultimo` preenchido | 177 (7,1%, subiu de 1,9%) |

## 6. Variáveis / configurações de tipologia

| Item | Valor |
|---|---|
| Total de referências de variável | 59 (sem mudança) |
| Tipologias-referência com ao menos 1 variável | 59 |

**Continua cobrindo só "número de folhas".** Não há, nesta rodada, evidência
de novas variáveis extraídas (dimensão, tipo de abertura, montagem etc.) —
segue não auditado se a API W.Vetro fornece esses dados por pedido
individual. Nenhuma tabela armazena a combinação completa de variáveis por
orçamento histórico individual — apenas o valor agregado por
tipologia-referência. Isso limita a seção "configurações diferentes
encontradas entre orçamentos" pedida para a tela de auditoria: hoje só é
possível mostrar, por componente, os **valores distintos observados** de
posição/corte (já expostos na tela), não a combinação completa de variáveis
por pedido — não existe granularidade de pedido individual nas tabelas atuais.

## 7. Receitas técnicas oficiais validadas

| Item | Valor |
|---|---|
| Tipologias com receita oficial ativa (`engenharia_tipologia_formulas_corte`, `ativo=true`) | 2 |

Sem mudança desde a auditoria anterior — nenhuma nova receita foi promovida
manualmente ainda.

---

## Resumo objetivo

### Já temos
- Catálogo de referência de perfis (1.529, 91% vinculado) e acessórios
  (1.294, 98% vinculado) estável e avançado.
- Carga avançando de forma saudável: 859/987 dias (87%), com pendências
  tratadas como registro auditável (128) em vez de travar o cursor.
- Composição por tipologia cresceu 33% desde a última rodada (504→668 linhas
  de BOM), imagens de tipologia saltaram de 34 para 86 (30%→76%).
- Tela `/configuracoes/integracoes/wvetro/base-tecnica/tipologias` (lista) e
  `/tipologias/[id]` (detalhe), agora com: cards de catálogo global
  (perfis/acessórios/linhas de BOM/sem vínculo), rótulos explícitos
  **REFERÊNCIA HISTÓRICA** vs **RECEITA TÉCNICA VALIDADA** em cada seção, e
  lista real de posições/cortes observados por componente.

### Está incompleto
- Só 21 de 113 tipologias (19%) têm alguma composição — a maioria zerada.
- `unidade_origem` nunca preenchida em `wvetro_tipologia_componentes` (gap na
  extração, não desta frente).
- Variáveis seguem limitadas a "número de folhas".
- Só 2 tipologias com receita oficial validada.

### Ainda falta
- Completar os ~13% restantes de dias da carga e reprocessar as 128
  pendências (frente do ChatGPT/PR #306).
- Expandir composição BOM proporcionalmente ao avanço da carga.
- Investigar se a API W.Vetro expõe variáveis por pedido individual
  (necessário para "configurações diferentes observadas entre orçamentos"
  granular — hoje só temos valor agregado por tipologia).
- Validar manualmente mais receitas oficiais a partir dos padrões observados.

### Próximo passo recomendado
1. Aguardar a carga completar e as pendências serem reprocessadas
   (ChatGPT/PR #306) — segue sendo o bloqueador raiz do volume de dado.
2. Ir promovendo manualmente, via a tela de detalhe, tipologias com
   composição já robusta para receita técnica oficial — nunca em lote,
   nunca automático.
3. Investigar granularidade de variáveis por pedido individual na API
   W.Vetro antes de expandir a extração de variáveis.
4. Reauditar periodicamente pela própria tela do explorador, não por SQL
   solto.
