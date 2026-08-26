# Cliente 360 — Fluxo da Venda e Andamento

Data: 2026-08-26
Status: implementado na branch `feat/cliente-360-obras-financeiro-v1`, PR #280, aguardando validação visual antes de merge.

## Regra central

O Cliente 360 é a visão consolidada da relação com o cliente. A Obra é o agrupador operacional. Os Kanbans dos setores continuam sendo as fontes de trabalho das equipes; a aba **Andamento** apenas consolida os mesmos cards por `cliente_id` e `obra_id`, sem duplicar estado.

## Fluxo oficial da venda sob medida

### 1. Venda confirmada

Ao confirmar a venda do orçamento sob medida:

- cria/garante uma `vendas_obras` com snapshot do orçamento vendido;
- congela `valor_venda`, `custo_previsto`, condições, forma de pagamento e itens do momento da venda;
- cria/garante um pré-lançamento em `financeiro_contas_receber`, vinculado à venda, cliente, obra e orçamento;
- cria/garante um card no setor `financeiro`;
- cria/garante um card em `engenharia-projeto`, na coluna inicial **A conferir**;
- NÃO cria Medição Final, Perfis, Acessórios, Vidros, Outros, Produção ou Instalação neste momento.

A operação é idempotente por orçamento: reprocessar não deve duplicar venda, conta ou card.

### 2. Engenharia — Conferir Projeto

Este é o portão técnico pré-medição da venda.

Colunas:

1. A conferir
2. Em conferência
3. Aguardando ajuste
4. Projeto conferido

Nesta etapa devem ser revisados e corrigidos, conforme o Atlas evoluir:

- tipologia;
- linha/modelo;
- tipo de montagem;
- perfis;
- acessórios e ferragens;
- sentidos de abertura;
- reforços;
- configurações técnicas;
- itens e demais definições necessárias antes de compra/medição.

Mover o card para **Projeto conferido** é um evento de negócio, não apenas mudança visual.

### 3. Projeto conferido

Ao concluir a conferência:

- cria/garante a Medição Final;
- cria/garante o fluxo de Perfis;
- cria/garante o fluxo de Acessórios;
- cria/garante o fluxo de Outros materiais;
- NÃO cria Vidros ainda.

Perfis/Acessórios/Outros usam inicialmente:

`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

A necessidade detalhada de material será alimentada pelas receitas/configurações técnicas do Atlas conforme o orçamento e a Engenharia forem amadurecendo.

### 4. Medição Final aprovada

Somente quando `medicoes_finais.status_operacional` muda para `aprovado`:

- cria/garante o card de Vidros;
- envia/atualiza a obra no MEE/Engenharia técnica pós-medição já existente.

Vidros usam:

`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

Regra permanente: **Vidro não deve ser liberado para compra antes da Medição Final aprovada**, porque suas medidas dependem da medição final da obra.

## Engenharia pré e pós-medição

Existem temporariamente duas fases com responsabilidades diferentes:

- `engenharia-projeto`: conferência do projeto vendido antes da Medição Final;
- `mee`: conferência/desenvolvimento técnico baseado nas peças e medidas finais aprovadas.

Não duplicar as responsabilidades. A experiência poderá ser unificada futuramente em uma única área de Engenharia, mas o estágio pós-medição não pode ser removido enquanto suas conferências/receitas/liberação para produção dependerem dos dados de `medicao_itens`.

A automação `fn_medicao_aprovada_para_engenharia()` deve apontar explicitamente para o setor `mee`; nunca voltar a localizar Engenharia por nome/fuzzy.

## Cliente 360 → Andamento

Rota: `/clientes/[id]/central?aba=andamento`.

A tela lê diretamente os mesmos registros dos setores e apresenta por obra:

`Venda → Conferir Projeto → Medição Final → Engenharia final → Materiais → Produção → Instalação`.

Materiais aparecem em paralelo:

- Perfis;
- Vidros;
- Acessórios;
- Outros.

A tela deve responder rapidamente:

- onde a obra está;
- qual setor está pendente;
- se perfil/vidro/acessório está pendente, em compra, comprado, aguardando entrega, recebido, separado ou liberado;
- qual é o bloqueio atual.

Nunca criar uma segunda tabela manual de status para o Cliente 360 quando o status puder ser derivado do card real do setor.

## Financeiro

O Financeiro nasce em paralelo imediatamente após a venda confirmada. O pré-lançamento pode ser ajustado depois pelo Financeiro para refletir condição real, parcelas, vencimentos, recebimentos, abatimentos e demais ajustes.

A venda original deve permanecer rastreável. Alterações posteriores relevantes devem usar revisão/ajuste com justificativa, mantendo antes/depois e impacto de valor/custo.

## Custos

`vendas_obras.custo_previsto` preserva o custo previsto do momento da venda. A evolução planejada do controle de custos é:

`Previsto → Otimizado → Comprado → Realizado`.

O custo deve ser consultável por Cliente → Obra → produto/material. Venda Balcão continua com custo por item no seu fluxo próprio e não entra no Kanban de obras.

## Fluxos ainda não automatizados nesta V1

A aba Andamento já possui posições para Produção e Instalação, mas a criação/liberação automática desses processos ainda depende de definição dos gates operacionais.

Antes de automatizar, definir explicitamente:

- quais materiais precisam estar em `Liberado` para Produção iniciar;
- se Produção pode iniciar parcialmente;
- quando Instalação nasce (na venda, na produção liberada, na produção concluída ou por agendamento);
- tratamento de itens produzidos em momentos diferentes;
- reabertura de etapas após revisão de venda/projeto.

## Validação transacional feita

Teste executado dentro de transação e revertido com `ROLLBACK`:

- venda criada: 1;
- financeiro criado: 1;
- projeto conferido: 1;
- Medição Final aprovada: 1;
- Perfis criado: 1;
- Acessórios criado: 1;
- Outros criado: 1;
- Vidros criado somente após aprovação da medição: 1;
- MEE/Engenharia pós-medição criado: 1;
- todos os cards herdaram o mesmo cliente/obra;
- confirmação posterior: 0 registros temporários de teste restantes.

## Migrations

- `20260826212725_fluxo_venda_conferir_projeto_materiais_v1.sql`;
- `20260826213310_fluxo_engenharia_separar_projeto_mee_v1.sql`.
