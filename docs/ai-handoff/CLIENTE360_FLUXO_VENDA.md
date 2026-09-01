# Cliente 360 — Fluxo da Venda e Andamento

Data: 2026-08-26
Status: implementado na branch `feat/cliente-360-obras-financeiro-v1`, PR #280, aguardando validação visual antes de merge.

## Regra central

O Cliente 360 é a visão consolidada da relação com o cliente. A Obra é o agrupador operacional. Os Kanbans dos setores continuam sendo as fontes de trabalho das equipes; a aba **Andamento** apenas consolida os mesmos cards por `cliente_id` e `obra_id`, sem duplicar estado.

## Fluxo oficial da venda sob medida

### 1. Venda confirmada

Ao arrastar para **Vendido**, o orçamento NÃO é persistido nessa coluna imediatamente. Primeiro abre `/vendas/confirmar`. Somente quando a confirmação termina com sucesso, no mesmo fluxo:

- cria/garante uma `vendas_obras` com snapshot do orçamento vendido;
- congela `valor_venda`, `custo_previsto`, condições, forma de pagamento e itens do momento da venda;
- cria/garante um pré-lançamento em `financeiro_contas_receber`, vinculado à venda, cliente, obra e orçamento;
- dispara o evento configurável `venda_confirmada`;
- pelas regras padrão ativas, cria/garante Financeiro e `Engenharia — Conferir Projeto / A conferir`;
- move o orçamento para **Vendido** e marca `status='vendido'`;
- NÃO cria Medição Final, Perfis, Acessórios, Vidros, Outros, Produção ou Instalação neste momento.

Regra permanente: **um card não pode parecer Vendido se ainda não existir a venda confirmada e seu lançamento financeiro**.

A operação é idempotente por orçamento: reprocessar não deve duplicar venda, conta, card, tarefa ou notificação.

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

Ao concluir a conferência, o Atlas dispara `projeto_conferido`. Pelas regras padrão ativas:

- cria/garante a Medição Final;
- cria/garante o fluxo de Perfis;
- cria/garante o fluxo de Acessórios;
- cria/garante o fluxo de Outros materiais;
- NÃO cria Vidros ainda.

A conclusão funciona tanto para venda já vinculada a uma `obra_id` quanto para venda ainda em **Sem obra definida**. Quando não houver obra cadastrada, a Medição usa os dados disponíveis do cliente/orçamento sem bloquear o fluxo.

Perfis/Acessórios/Outros usam inicialmente:

`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

A necessidade detalhada de material será alimentada pelas receitas/configurações técnicas do Atlas conforme o orçamento e a Engenharia forem amadurecendo.

### 4. Medição Final aprovada

Somente quando `medicoes_finais.status_operacional` muda para `aprovado`, o Atlas dispara `medicao_aprovada`. Pelas regras padrão ativas:

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

Os gates da tela são rígidos. Cards legados criados cedo demais não podem fazer uma etapa futura parecer liberada antes de seu evento de negócio.

Materiais aparecem em paralelo:

- Perfis;
- Vidros;
- Acessórios;
- Outros.

Antes do gate correspondente, o card aparece bloqueado e não abre o setor. Depois da liberação, ao abrir Perfis/Vidros/Acessórios/Outros pelo Andamento, a rota recebe `voltar` e mostra uma seta **Voltar** para retornar exatamente ao Cliente 360 → Andamento.

A tela deve responder rapidamente:

- onde a obra está;
- qual setor está pendente;
- se perfil/vidro/acessório está pendente, em compra, comprado, aguardando entrega, recebido, separado ou liberado;
- qual é o bloqueio atual.

Nunca criar uma segunda tabela manual de status para o Cliente 360 quando o status puder ser derivado do card real do setor.

## Financeiro

O Financeiro nasce em paralelo imediatamente após a venda confirmada, desde que a regra `Venda confirmada → Financeiro` esteja ativa. O pré-lançamento pode ser ajustado depois pelo Financeiro para refletir condição real, parcelas, vencimentos, recebimentos, abatimentos e demais ajustes.

A aba Cliente 360 lê `financeiro_contas_receber` e exibe o valor real a receber. A tabela mantém RLS e possui policy de **SELECT apenas para usuário autenticado**; a criação da conta continua centralizada no fluxo/RPC de confirmação da venda.

A venda original deve permanecer rastreável. Alterações posteriores relevantes devem usar revisão/ajuste com justificativa, mantendo antes/depois e impacto de valor/custo.

## Motor configurável de automações

Rota master: `/configuracoes/automacoes-fluxo`.

O motor substitui a ideia limitada de apenas `coluna do Kanban Comercial → setor`. Cada regra de `workflow_automacoes` configura:

- evento/gatilho;
- ação e setor/coluna de destino;
- responsável pelo processo;
- criação opcional de tarefa;
- prazo e prioridade da tarefa;
- aviso ao responsável;
- usuários adicionais em **Notificar também**;
- mensagem com variáveis `{cliente}`, `{numero}`, `{valor}`, `{obra}` e `{evento}`;
- ordem de execução;
- proteção contra duplicidade;
- ativo/inativo.

Cada execução é auditada em `workflow_execucoes`. Cards do setor podem guardar `responsavel_id`, `responsavel_nome` e `workflow_automacao_id`. Tarefas criadas pelo workflow carregam orçamento, cliente e obra.

O Atlas reaproveita o sistema existente de `tarefas` e `notificacoes`; não existe uma segunda caixa de tarefas. Quando a automação cria uma tarefa para outra pessoa, o trigger existente já gera o aviso no sino e o workflow evita uma segunda notificação duplicada para o mesmo responsável.

Configuração padrão atual:

- `Venda confirmada → Financeiro`: ativa, responsável padrão Gabrielle, cria tarefa e aviso;
- `Venda confirmada → Conferir Projeto`: ativa;
- `Projeto conferido → Medição Final`: ativa;
- `Projeto conferido → Perfis`: ativa;
- `Projeto conferido → Acessórios`: ativa;
- `Projeto conferido → Outros materiais`: ativa;
- `Medição aprovada → Vidros`: ativa;
- `Medição aprovada → MEE`: ativa;
- `Materiais liberados → Produção`: cadastrada e **inativa** até definição do gate;
- `Produção concluída → Instalação`: cadastrada e **inativa** até definição do gate.

Responsáveis ainda não definidos nas demais etapas devem ser escolhidos na tela de automações antes de ativar criação de tarefas/avisos para eles.

## Custos

`vendas_obras.custo_previsto` preserva o custo previsto do momento da venda. A evolução planejada do controle de custos é:

`Previsto → Otimizado → Comprado → Realizado`.

O custo deve ser consultável por Cliente → Obra → produto/material. Venda Balcão continua com custo por item no seu fluxo próprio e não entra no Kanban de obras.

## Fluxos ainda não automatizados nesta V1

Produção e Instalação já estão representadas no motor, mas suas regras permanecem inativas até a definição explícita dos gates operacionais.

Antes de ativar, definir:

- quais materiais precisam estar em `Liberado` para Produção iniciar;
- se Produção pode iniciar parcialmente;
- quando Instalação nasce e como se relaciona com agendamento;
- tratamento de itens produzidos em momentos diferentes;
- reabertura de etapas após revisão de venda/projeto.

## Validação transacional feita

Teste do novo motor para **Venda confirmada**, revertido sem deixar dados:

- venda: 1;
- conta a receber: 1;
- card Financeiro: 1;
- card Conferir Projeto: 1;
- tarefa para Gabrielle: 1;
- notificação nova para Gabrielle: 1;
- execuções do workflow: 2;
- Medição/Perfis/Acessórios/Outros/Vidros/MEE/Produção/Instalação: 0.

Teste encadeado também confirmou:

- `Projeto conferido` cria Medição + Perfis + Acessórios + Outros e ainda não Vidros;
- `Medição aprovada` cria Vidros + MEE;
- ao final desse cenário existem 8 execuções coerentes: 2 da venda + 4 do projeto + 2 da medição;
- os testes foram executados com `ROLLBACK` e não deixaram registros temporários.

## Segurança do workflow

- `workflow_automacoes` tem RLS: leitura autenticada e escrita somente por master;
- `workflow_execucoes` tem RLS para leitura autenticada e é escrita internamente pelo motor;
- funções internas `fn_workflow_renderizar_v1`, `fn_workflow_executar_automacao_v1`, `fn_workflow_disparar_evento_v1` e `fn_workflow_coluna_tarefa_v1` não são executáveis por `anon` nem `authenticated`;
- continuam expostas somente as RPCs de negócio necessárias, como `fn_iniciar_fluxo_venda_v2` e `fn_concluir_conferencia_projeto_v1`.

## Migrations

- `20260826212725_fluxo_venda_conferir_projeto_materiais_v1.sql`;
- `20260826213310_fluxo_engenharia_separar_projeto_mee_v1.sql`;
- `20260826221809_fluxo_vendido_confirmacao_atomica_v1.sql`;
- `20260826222110_conferir_projeto_sem_obra_v1.sql`;
- `20260826222310_financeiro_contas_receber_cliente360_leitura_v1.sql`;
- `20260826232740_workflow_automacoes_responsaveis_notificacoes_v1.sql`;
- `20260826233029_workflow_evitar_notificacao_duplicada_v1.sql`;
- `20260826233648_workflow_restringir_funcoes_internas_v1.sql`.
