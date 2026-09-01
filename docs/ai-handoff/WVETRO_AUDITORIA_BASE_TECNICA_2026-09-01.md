# Auditoria — Base técnica W.Vetro para Orçamento Sob Medida (2026-09-01)

Auditoria objetiva do estado real do banco/código para os dados técnicos W.Vetro
necessários ao Orçamento Sob Medida. Números obtidos por consulta direta ao
Supabase de produção (projeto `urtqbvjpwnrfaayolymt`) nesta data.

**Não altera** a lógica de execução/checkpoint/pendências da carga histórica —
essa frente está sob responsabilidade da PR #306
(`fix/wvetro-pendencias-historico-v9`). Este documento é só leitura/diagnóstico.

## 1. Tipologias / Linhas / Modelos

| Item | Valor |
|---|---|
| Tipologias no Atlas | 122 |
| Tipologias com origem W.Vetro (`origem_referencia='wvetro'`) | 109 |
| Referências de tipologia (`wvetro_referencias_tipologias`) | 111 |
| Referências mapeadas para tipologia Atlas | 109 (98%) |
| Linhas distintas identificadas (`linha_raw`) | 29 |
| Referências com imagem de tipologia | 12 de 111 (11%) |

**Status: quase completo no vínculo Linha+Modelo → Tipologia Atlas.** A
lacuna real é imagem de tipologia (só 11% têm `imagem_url`).

## 2. Perfis e Acessórios (catálogo de referência)

| Item | Total | Mapeados p/ produto Atlas | Com imagem |
|---|---|---|---|
| Perfis (`wvetro_referencias_componentes`, tipo=perfil) | 1.529 | 1.385 (91%) | 0 |
| Acessórios (idem, tipo=acessorio) | 1.294 | 1.265 (98%) | 0 |

**Status: catálogo de referência (identidade + preço histórico) está bem
avançado.** A coluna `imagem_url` dessa tabela está zerada — as imagens reais
ficam em `wvetro_produtos_snapshot` (ver seção 5), não nesta tabela; não há
gap real aqui, só um campo não usado neste fluxo.

## 3. Composição por tipologia (BOM: Linha+Modelo → componentes) — **PRINCIPAL GARGALO**

Tabela `wvetro_tipologia_componentes` (criada na PR #305, é o que
`/api/orcamento/wvetro-referencias` já expõe pronto para o orçamento):

| Item | Valor |
|---|---|
| Linhas na tabela (component × tipologia) | **97** |
| Vinculadas a produto Atlas | 56 (58%) |
| Com posições (`posicoes` preenchido) | 36 (37%) |
| Com cortes (`cortes` preenchido) | 38 (39%) |
| Componentes tipo perfil | 35 |
| Componentes tipo acessório | 59 |
| Componentes tipo vidro | **3** |
| Com custo e venda (min/max/último) | 97 (100% do que existe) |

**Isto é a fonte real que falta.** Com apenas 111 tipologias-referência e só
97 linhas de composição no total, a esmagadora maioria das tipologias ainda
não tem nenhum componente (perfil/acessório/vidro) associado. Vidro em
particular está praticamente vazio (3 linhas).

Isso é consequência direta da carga histórica estar parada: ela processou
626 de ~975 dias do período (01/01/2024 a 01/09/2026), parou em erro no dia
**2025-09-18**, e é exatamente isso que a PR #306 está corrigindo (transformar
dia com erro em pendência revisável, sem travar o avanço do cursor).

## 4. Custo/venda refletidos em `produtos`

| Item | Valor |
|---|---|
| Produtos no Atlas | 2.485 |
| Produtos com `custo_wvetro_ultimo` preenchido | 47 (1,9%) |
| Produtos com `venda_wvetro_ultimo` preenchido | 47 (1,9%) |

Consistente com a seção 3 (56 componentes vinculados a produto, dos quais 47
produtos distintos receberam o backfill). Volume baixo pelo mesmo motivo:
carga histórica incompleta.

## 5. Imagens

Tabela `wvetro_produtos_snapshot` (status por produto consultado na API
W.Vetro):

| Status | Quantidade |
|---|---|
| `copiada` (imagem já está no Atlas) | 1.287 |
| `pendente` (ainda não processada) | 735 |
| `erro` | 459 |
| **Total consultado** | 2.481 |

**Status: parcial, ~52% concluído.** 459 imagens em erro merecem uma
segunda passada (fora do escopo desta auditoria — não é execução/checkpoint
da carga histórica, é reprocessamento de imagem, mas como está integrado ao
mesmo pipeline, recomenda-se tratar junto quando a carga for retomada).

## 6. Variáveis / configurações de tipologia

Tabela `wvetro_referencias_variaveis`:

| Item | Valor |
|---|---|
| Total de referências de variável | 59 |
| Mapeadas/validadas (`mapeada_exata` ou `validada_atlas`) | 59 (100%) |
| Vinculadas a `engenharia_variaveis` do Atlas | 59 (100%) |

**Status: completo para o que já foi extraído.** Hoje só cobre "número de
folhas" (extraído via regex do campo Modelo). Não há, ainda, extração de
outras variáveis (dimensão mínima/máxima, tipo de abertura etc.) — não foi
auditado se a API W.Vetro fornece esses dados; recomenda-se checar isso
antes de expandir `fn_wvetro_reconstruir_variaveis_explicitas`.

## 7. Execução da carga histórica (contexto, não é objeto desta tarefa)

| Item | Valor |
|---|---|
| Execução ativa | 1 |
| Status | `erro` |
| Dias processados | 626 de ~975 (64%) |
| Cursor parado em | 2025-09-18 |
| Período alvo | 2024-01-01 a 2026-09-01 |

Esta frente é tratada pela PR #306. Não foi alterada por esta auditoria.

---

## Resumo objetivo

### Já temos
- Vínculo Linha+Modelo → Tipologia Atlas: **98% completo** (109/111).
- Catálogo de referência de perfis e acessórios (identidade + histórico de
  preço): **91–98% mapeado** para produto Atlas (1.529 perfis, 1.294
  acessórios).
- Variáveis de tipologia (nº de folhas): **100% do que foi extraído**, mas
  cobertura limitada a uma única variável.
- Endpoint pronto (`/api/orcamento/wvetro-referencias`) já expõe composição,
  variáveis e custos por tipologia para quem for montar o Orçamento Sob
  Medida — o consumidor já pode ler os dados assim que existirem.
- Imagens: 1.287 já copiadas para o Atlas (52% do catálogo consultado).

### Falta
- **Composição por tipologia (BOM)**: só 97 linhas em
  `wvetro_tipologia_componentes` para 111 tipologias — a grande maioria das
  tipologias não tem nenhum perfil/acessório/vidro associado ainda. Vidro em
  especial (3 registros) está praticamente ausente.
- Backfill de custo/venda em `produtos`: só 47 de 2.485 produtos (1,9%).
- Imagens de tipologia: só 12 de 111 (11%).
- Imagens de produto: 735 pendentes + 459 em erro (48% do catálogo).
- Variáveis além de "número de folhas" (dimensões, tipo de abertura etc.):
  não extraídas — nem auditado se a API fornece.

### Por que isso ainda impede reproduzir o orçamento sob medida do W.Vetro
O gargalo não é código nem schema — a infraestrutura (tabelas, endpoint,
função de reconciliação) já existe e está correta. O gargalo é **volume de
dado real**: a carga histórica que preenche `wvetro_tipologia_componentes`
processou só 64% do período e parou em erro. Sem composição por tipologia
(perfis+acessórios+vidros com quantidade/medida/custo), o Atlas não tem como
montar um orçamento por variáveis fiel ao que o W.Vetro produzia — só
consegue reproduzir corretamente as poucas tipologias (dentre as 111) que já
têm composição na tabela.

### Próximo passo recomendado
1. Aguardar/validar a PR #306 (retomada da carga sem travar em erro) —
   é o bloqueador raiz de tudo acima.
2. Depois da carga completa, rodar novamente esta auditoria para confirmar
   cobertura de composição (`wvetro_tipologia_componentes`) por tipologia
   individualmente (hoje só temos o agregado; falta saber quais das 111
   tipologias já têm BOM completo vs. quais ainda estão zeradas).
3. Só então iniciar o desenho do fluxo de Orçamento Sob Medida por
   variáveis usando os dados como referência auditável — nunca promovendo
   automaticamente histórico observado a fórmula de engenharia oficial sem
   validação humana (regra já registrada em `DECISIONS.md`/`CLAUDE.md`).
4. Tratar separadamente (não bloqueante): reprocessar as 459 imagens em
   erro e completar as 735 pendentes.
