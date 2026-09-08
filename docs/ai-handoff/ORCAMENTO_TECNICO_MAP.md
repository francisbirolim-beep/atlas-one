# ORCAMENTO_TECNICO_MAP.md — Atlas One

## Objetivo

Mapear a base real já existente para o novo fluxo **Cliente 360 → Obra → Orçamento sob medida → Composição e precificação → Lista de materiais → Produção**, evitando duplicação de dados e, principalmente, qualquer cálculo técnico inventado.

Este documento descreve somente estruturas confirmadas no código da `main` e no Supabase de produção em 2026-09-07.

## Estruturas que devem ser reaproveitadas

### Orçamento e tipologias

- `orcamentos`: orçamento principal, cliente, obra, cidade, itens/tipologias em `itens`, revisão, margem geral e política geral de sobra.
- `orcamentos.empresa_id`: tenant obrigatório.
- `orcamentos.margem_padrao_pct`: margem geral já existente.
- `orcamentos.cobrar_sobra_padrao`: política geral de cobrança de sobra já existente.
- `orcamentos.custo_otimizado` e `orcamentos.custo_sobra_cobrada`: totais já previstos para a camada de precificação.

### Política comercial por tipologia

- `orcamento_item_precificacao`: uma linha por `orcamento_id + item_ref`.
- já possui herança/override de margem por item;
- já possui herança/override de cobrança de sobra por item;
- já separa `custo_produtivo`, `custo_sobra`, `custo_extras`, `custo_total` e `preco_venda`.

Esta tabela deve permanecer como núcleo da política de margem/sobra por tipologia. Não criar uma segunda tabela para a mesma finalidade.

### Componentes e origem de custo

- `orcamento_precificacao_componentes`: componentes de custo do orçamento por item/tipologia.
- já registra categoria, produto, catálogo de custo, código, descrição, unidade, quantidade, custo unitário/total, margem e preço.
- já possui `origem_custo`, `custo_pendente`, `incluido_manual` e `excluido`.

A evolução deve ampliar a semântica de `origem_custo` para distinguir claramente **Atlas**, **W.Vetro importado**, **manual** e **pendente**, sem promover automaticamente valor do W.Vetro a custo oficial.

### Alterações controladas de materiais

- `orcamento_item_componentes_overrides`: histórico estruturado de adicionar/substituir/remover componente por tipologia.
- já registra origem/destino, quantidade/comprimento override, justificativa, usuário e data.
- `lib/orcamentoPrecificacao.ts` aplica estes overrides ao pacote técnico.

Esta estrutura deve ser reaproveitada para edição de Perfis, Acessórios, Vidros e Outros. O que falta é tornar a **pendência de validação técnica** uma invariável explícita e bloqueante após qualquer alteração manual.

### Pacote técnico e materiais

- `pacotes_tecnicos`: snapshot técnico versionado ligado a orçamento/venda/cliente/obra.
- `pacote_tecnico_materiais`: necessidade técnica individual por `item_ref`, com categoria, quantidade, corte, origem/status de cálculo, ajuste manual e justificativa.
- `pacote_tecnico_barras`: plano de barras, comprimento usado, sobra final e flag reaproveitável.
- `pacote_tecnico_cortes`: cortes associados à barra/material/item.
- `pacote_tecnico_separacoes` e `pacote_tecnico_compras`: estruturas downstream de separação/compra já existentes.

A Lista de Materiais individual e consolidada deve ser derivada destas estruturas, sem duplicar estoque, compra ou consumo.

### Produção

- `ordens_producao`: ordem por item/tipologia, com cliente, obra, orçamento, revisão, `item_ref`, snapshot, dimensões, status, bloqueio e motivo.
- o PR #437 já endureceu a criação/liberação de Ordem de Produção e o isolamento por empresa.

A nova ficha **Lista Completa de Produção A4 por Tipologia** deve ser uma representação versionada da ordem/pacote técnico existente, e não uma fonte paralela de materiais ou cortes.

## Regras que já existem e devem ser preservadas

- Venda Balcão fica fora do Kanban de obra.
- `empresa_id` é obrigatório nas estruturas transacionais relevantes.
- orçamento possui revisão versionada.
- materiais técnicos podem estar `pendente_formula`/pendentes; pendência não pode ser mascarada como custo zero válido.
- edição de componente já exige justificativa no fluxo atual.
- sobras de barras já distinguem comprimento usado, sobra final e reaproveitamento.
- Ordem de Produção possui bloqueio persistido no banco.

## Lacunas reais para o novo fluxo

1. **Composição e precificação** ainda não possui um estado técnico único por tipologia que diga, de forma persistida, se preço final pode ser emitido.
2. `origem_custo` precisa de contrato explícito para Atlas/W.Vetro/manual/pendente e rastreabilidade da referência importada.
3. alteração manual de componente precisa marcar automaticamente a tipologia como **pendente de validação técnica** e bloquear preço final/liberação de produção até validação.
4. margem por cidade ainda não possui tabela própria configurável/versionada.
5. mudanças de margem, desconto, custo e sobra precisam de histórico uniforme com valor anterior, novo valor, usuário, data e motivo.
6. falta política global de sobra com três modos explícitos: `respeitar_item`, `cobrar_todas`, `nao_cobrar_nenhuma`.
7. falta consulta consolidada de materiais com rastreamento de quais `item_ref` originaram cada material.
8. falta PDF de cotação sem margem/preço de venda.
9. falta a ficha única **Lista Completa de Produção A4 por Tipologia** com selo PREVIA/LIBERADO e paginação.
10. a impressão precisa consumir somente dados tecnicamente validados; usinagem, ângulo, perda e corte ausentes não podem ser inferidos.

## Sequência segura de implementação

### PR 1 — mapeamento/reuso

Este documento. Nenhuma migration e nenhuma mudança de regra operacional.

### PR 2 — contrato mínimo de composição e precificação

Evoluir as estruturas existentes, sem criar materiais ou custos novos, para armazenar:

- situação técnica por item;
- origem oficial/referência do custo;
- política global de sobra em três modos;
- bloqueio explícito de preço final quando houver pendência técnica/custo obrigatório pendente.

### PR 3 — margem por cidade + auditoria comercial

Criar tabela tenant-aware/versionada de margem sugerida por cidade e histórico uniforme para margem, desconto, custo e sobra.

### PR 4 — edição controlada de materiais

Reaproveitar `orcamento_item_componentes_overrides`, adicionando workflow de validação técnica e gate de preço/produção.

### PR 5 — lista de materiais

Consultas individual/consolidada, filtros e PDF de cotação sem preço de venda/margem.

### PR 6 — Lista Completa de Produção A4

Uma única ficha por tipologia, derivada de `ordens_producao` + pacote técnico + cadastros técnicos existentes.

### PR 7 — integração final dos gates

Amarrar Medição Final, validação técnica, materiais, vidros, produção e instalação no banco/API.

## Regra de não invenção

Nenhum PR deste fluxo pode preencher automaticamente fórmula, material, quantidade, corte, usinagem, ângulo, perda, custo ou preço quando a base técnica não fornecer valor validado. Nesses casos, o estado correto é **pendente** e o sistema deve bloquear preço final/liberação operacional correspondente.
