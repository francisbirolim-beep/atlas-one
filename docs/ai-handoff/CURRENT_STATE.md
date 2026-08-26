# CURRENT_STATE.md — Atlas One

> Checkpoints anteriores permanecem no histórico Git e em `docs/ai-handoff/archive/`.

## EM VALIDAÇÃO — CLIENTE 360 + OBRAS + WORKFLOW OPERACIONAL — 2026-08-26

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft, não fazer merge antes da validação visual do usuário.

### Cliente 360

Implementado:
- `/clientes/[id]/central` como central do relacionamento com o cliente;
- múltiplas Obras por cliente;
- `/obras` e `/obras/[id]`;
- vínculo opcional `obra_id` em orçamento, orçamento/venda balcão, assistência, medição e financeiro;
- Financeiro consolidado por cliente e filtrável por obra;
- recebimento geral do cliente, recebimento direto por obra e alocação de um mesmo recebimento entre várias obras;
- baixa parcial usando `valor_pago`, mantendo a conta aberta até quitação;
- documentos, histórico, relatórios e resumo inteligente;
- contexto Cliente + Obra preservado também na fila offline.

### Andamento do cliente

Nova visão:
- `/clientes/[id]/central?aba=andamento`;
- lê os mesmos cards dos setores, sem duplicar estado;
- agrupa por obra e mostra cadeia macro:
  `Venda → Conferir Projeto → Medição Final → Engenharia final → Materiais → Produção → Instalação`;
- mostra Perfis, Vidros, Acessórios e Outros em paralelo;
- exibe status real e `Bloqueio atual`;
- gates visuais impedem cards legados de liberar etapas antes da hora;
- Perfis/Vidros/Acessórios/Outros abertos pelo Andamento possuem retorno contextual para a mesma aba.

### Fluxo oficial da venda sob medida

**Venda confirmada**:
1. snapshot em `vendas_obras`;
2. conta em `financeiro_contas_receber` se a regra Financeiro estiver ativa;
3. dispara evento `venda_confirmada`;
4. regras padrão criam Financeiro + `Engenharia — Conferir Projeto / A conferir`;
5. somente então marca o orçamento `status='vendido'`.

Não criar Medição Final, materiais, Produção ou Instalação diretamente em `Vendido`.

**Projeto conferido** dispara `projeto_conferido`. Regras padrão ativas criam:
- Medição Final;
- Perfis;
- Acessórios;
- Outros;
- ainda não Vidros.

**Medição Final aprovada** dispara `medicao_aprovada`. Regras padrão ativas criam:
- Vidros;
- MEE/Engenharia técnica pós-medição.

Fluxo de materiais:
`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

Detalhamento permanente: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

### Motor de Automações do Fluxo

Criado módulo master `/configuracoes/automacoes-fluxo`.

`workflow_automacoes` permite configurar:
- evento/gatilho;
- ação;
- setor e coluna de destino;
- responsável;
- criação de tarefa;
- prazo/prioridade;
- aviso ao responsável;
- usuários adicionais em `Notificar também`;
- mensagem parametrizada;
- ordem, ativo/inativo e proteção contra duplicidade.

`workflow_execucoes` audita cada execução. Cards e tarefas carregam contexto do workflow/orçamento/cliente/obra.

O motor reaproveita `tarefas`, `tarefa_colunas` e `notificacoes` existentes. Não há um segundo sistema de tarefas. Quando uma tarefa atribuída já gera notificação, o workflow evita mandar outro sino duplicado para o mesmo responsável.

Regras padrão:
- Venda confirmada → Financeiro: ativa; Gabrielle responsável; cria tarefa + aviso;
- Venda confirmada → Conferir Projeto: ativa;
- Projeto conferido → Medição Final: ativa;
- Projeto conferido → Perfis: ativa;
- Projeto conferido → Acessórios: ativa;
- Projeto conferido → Outros materiais: ativa;
- Medição aprovada → Vidros: ativa;
- Medição aprovada → MEE: ativa;
- Materiais liberados → Produção: cadastrada, inativa;
- Produção concluída → Instalação: cadastrada, inativa.

Produção ganhou cadastro/colunas iniciais apenas para permitir desenho do fluxo. Não ativar o gate até definição funcional.

### Venda e revisões

`vendas_obras` preserva snapshot do orçamento vendido: valor, custo previsto, condições, forma, itens, cliente e obra.

`venda_obra_revisoes` é a base para alterações pós-venda com justificativa obrigatória e histórico antes/depois.

### Financeiro

- continua sendo base única;
- cliente e obra são dimensões da mesma base;
- confirmação cria pré-lançamento idempotente quando a automação Financeiro está ativa;
- Financeiro poderá ajustar parcelas/vencimentos sem apagar o snapshot da venda;
- recebimento geral pode ser distribuído entre várias obras.

### Balcão

- Venda/Orçamento Balcão rápido não entra no Kanban de obras;
- `balcao_orcamentos` é a tabela transacional própria;
- cadastros e financeiro continuam compartilhados;
- vínculo cliente/obra no Balcão serve a relatório, sem disparar workflow de obra automaticamente.

### Validações concluídas

Financeiro Cliente 360 com `ROLLBACK`:
- R$ 10.000 gerais → R$ 6.000 em uma obra + R$ 4.000 em outra;
- baixa integral/parcial, crédito excedente e bloqueio entre obras;
- 0 registros temporários restantes.

Workflow, com `ROLLBACK`:
- Venda confirmada: venda 1, conta 1, Financeiro 1, Conferir Projeto 1, tarefa Gabrielle 1, notificação Gabrielle 1, downstream 0;
- Projeto conferido: Medição + Perfis + Acessórios + Outros; Vidros 0;
- Medição aprovada: Vidros + MEE;
- 8 execuções coerentes no cenário completo (2 + 4 + 2);
- 0 registros temporários restantes.

### Banco / migrations desta evolução

Cliente 360:
- `20260826185419_cliente_360_obras_financeiro_v1.sql`;
- `20260826190418_cliente_360_propagacao_obra_v1.sql`;
- `20260826192848_cliente360_recebimento_multiobra_v1.sql`;
- `20260826193046_cliente360_recebimento_status_compativel_v1.sql`.

Fluxo / workflow:
- `20260826212725_fluxo_venda_conferir_projeto_materiais_v1.sql`;
- `20260826213310_fluxo_engenharia_separar_projeto_mee_v1.sql`;
- `20260826221809_fluxo_vendido_confirmacao_atomica_v1.sql`;
- `20260826222110_conferir_projeto_sem_obra_v1.sql`;
- `20260826222310_financeiro_contas_receber_cliente360_leitura_v1.sql`;
- `20260826232740_workflow_automacoes_responsaveis_notificacoes_v1.sql`;
- `20260826233029_workflow_evitar_notificacao_duplicada_v1.sql`;
- `20260826233648_workflow_restringir_funcoes_internas_v1.sql`.

### Segurança

- `workflow_automacoes` tem RLS: leitura autenticada, escrita somente por master;
- `workflow_execucoes` é leitura autenticada e escrita pelo motor;
- helpers internos do workflow tiveram EXECUTE revogado de `anon` e `authenticated`;
- `fn_iniciar_fluxo_venda_v2` e `fn_concluir_conferencia_projeto_v1` permanecem RPCs autenticadas intencionais;
- advisors ainda apontam hardening legado de outras áreas; tratar em PR separado.

### Pendente antes do merge

- validar visualmente `/configuracoes/automacoes-fluxo` no Preview;
- escolher responsáveis das etapas além do Financeiro;
- validar no Preview uma Venda confirmada e conferir tarefa/sino do responsável;
- validar Cliente 360 → Andamento e gates;
- definir gates de Produção e Instalação antes de ativar suas regras;
- validar checks do HEAD final do PR;
- não fazer merge do PR #280 até aprovação do usuário.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- Cliente é o centro do relacionamento; Obra é o centro da execução.
- Financeiro é único; cliente/obra são dimensões do mesmo financeiro.
- Cliente 360 Andamento deriva status dos processos reais, nunca de cópia manual.
- Eventos do workflow devem ser idempotentes e auditados.
- Configuração do workflow é master-only; responsáveis recebem tarefas/avisos pelo sistema existente.
- Venda confirmada = Financeiro + Conferir Projeto pelas regras padrão; não liberar downstream cedo.
- Perfis/Acessórios/Outros só após Projeto conferido.
- Vidros só após Medição Final aprovada.
- MEE permanece pós-medição enquanto depender de `medicao_itens`.
- Produção/Instalação não ativar até seus gates estarem definidos.
- Venda fechada preserva snapshot; alterações posteriores exigem justificativa/histórico.
- Venda/Orçamento Balcão rápido não alimenta workflow de obra.
- `kanban_entrada_em` é fixa; `coluna_atualizada_em` é movimentação/SLA.
- W.Vetro é referência/origem; regra técnica Atlas validada tem prioridade.
