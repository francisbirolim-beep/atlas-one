# CURRENT_STATE.md — Atlas One

> Checkpoints anteriores permanecem no histórico Git e em `docs/ai-handoff/archive/`.

## EM VALIDAÇÃO — CLIENTE 360 + OBRAS + FLUXO OPERACIONAL DA VENDA — 2026-08-26

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
- exibe o status real de cada fluxo e um `Bloqueio atual`;
- filtro por obra;
- lê a tabela normal `orcamentos` sem depender de `modo_entrada`, preservando orçamentos legados com modo nulo; Balcão já está isolado em `balcao_orcamentos`.

### Fluxo oficial da venda sob medida

**Venda confirmada** gera apenas:
1. snapshot da venda em `vendas_obras`;
2. Financeiro / pré-lançamento em `financeiro_contas_receber`;
3. card `Engenharia — Conferir Projeto` em `A conferir`.

Não criar Medição Final, Instalação ou materiais diretamente em `Vendido`.

**Engenharia — Conferir Projeto**:
`A conferir → Em conferência → Aguardando ajuste → Projeto conferido`.

Ao entrar em **Projeto conferido**:
- cria/garante Medição Final;
- cria/garante Perfis;
- cria/garante Acessórios;
- cria/garante Outros;
- não cria Vidros.

Fluxo de materiais:
`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

**Vidros só nascem depois que a Medição Final muda para `aprovado`.**

Quando a Medição Final é aprovada, o Atlas também mantém a etapa técnica pós-medição no setor `mee`, que trabalha com as peças/medidas finais. O trigger foi corrigido para apontar explicitamente para `mee`, sem busca fuzzy pelo nome Engenharia.

Detalhamento permanente: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

### Venda e revisões

Criada `vendas_obras` para preservar snapshot do orçamento vendido:
- valor da venda;
- custo previsto;
- condições e forma de pagamento;
- itens do momento da confirmação;
- cliente e obra.

Criada `venda_obra_revisoes` com justificativa obrigatória para suportar a próxima evolução de alterações pós-venda sem sobrescrever histórico.

### Financeiro

- continua sendo uma base única;
- cliente e obra são dimensões da mesma base, não financeiros paralelos;
- confirmação da venda cria um pré-lançamento idempotente vinculado a `venda_obra_id`, `orcamento_id`, `cliente_id` e `obra_id`;
- Financeiro poderá ajustar condição, parcelas e vencimentos posteriormente sem apagar o snapshot da venda;
- recebimento geral pode ser distribuído entre várias obras.

### Balcão

Regras preservadas:
- Venda/Orçamento Balcão rápido não entra no Kanban de obras;
- `balcao_orcamentos` é a tabela transacional própria do orçamento rápido;
- clientes, produtos, preços, estoque, compras e financeiro continuam compartilhados com o Atlas;
- venda balcão pode ter cliente/obra para relatório, mas não gera fluxo operacional de obra automaticamente.

### Banco / migrations desta evolução

Cliente 360:
- `20260826185419_cliente_360_obras_financeiro_v1.sql`;
- `20260826190418_cliente_360_propagacao_obra_v1.sql`;
- `20260826192848_cliente360_recebimento_multiobra_v1.sql`;
- `20260826193046_cliente360_recebimento_status_compativel_v1.sql`.

Fluxo da venda:
- `20260826212725_fluxo_venda_conferir_projeto_materiais_v1.sql`;
- `20260826213310_fluxo_engenharia_separar_projeto_mee_v1.sql`.

### Validações já concluídas

Financeiro Cliente 360, em transação com ROLLBACK:
- R$ 10.000 de recebimento geral alocados em R$ 6.000 numa obra + R$ 4.000 em outra;
- baixa integral e parcial;
- crédito excedente por obra;
- recebimento geral permaneceu sem `obra_id`;
- bloqueado redirecionamento de recebimento direto de uma obra para outra;
- Medição Final/conta herdaram obra;
- 0 registros de teste restantes.

Fluxo operacional, em transação com ROLLBACK:
- venda criada = 1;
- financeiro criado = 1;
- projeto conferido = 1;
- Medição Final aprovada = 1;
- Perfis = 1;
- Acessórios = 1;
- Outros = 1;
- Vidros = 1 somente após a aprovação da medição;
- MEE pós-medição = 1;
- 7 cards do fluxo com o mesmo contexto cliente/obra;
- 0 registros de teste restantes após rollback.

CI do commit funcional `bd4ebb084807235c22d9c5fd0934bbc4904d399e`:
- Supabase Database Control: success;
- Build Validation / Next.js: success;
- Vercel Preview: READY;
- rota Cliente 360 Andamento respondeu HTTP 200 no Preview.

Após ajustes/documentação posteriores, validar novamente o HEAD final do PR antes do merge.

### Segurança

- tabelas novas `vendas_obras`, `venda_obra_revisoes` e `setor_kanban_movimentos` têm RLS/policies no padrão atual do Atlas;
- helpers/triggers internos tiveram execução pública revogada;
- `fn_iniciar_fluxo_venda_v2` e `fn_concluir_conferencia_projeto_v1` são RPCs autenticadas e intencionalmente `SECURITY DEFINER`, pois representam ações de negócio do usuário autenticado;
- advisors continuam apontando hardening legado já existente em Engenharia, Estoque, Compras, Financeiro e outras tabelas; tratar em PR separado, sem ampliar este escopo.

### Pendente antes do merge

- validar visualmente Cliente 360 e a aba Andamento no Preview;
- validar manualmente uma venda real/controlada: `Vendido → Confirmar venda → Conferir Projeto`;
- conferir o Financeiro criado;
- mover o projeto entre as etapas e confirmar que apenas `Projeto conferido` cria Medição/Perfis/Acessórios/Outros;
- aprovar uma Medição Final controlada e confirmar que só então Vidros + MEE aparecem;
- definir com o usuário os gates exatos para Produção e Instalação antes de automatizar essas etapas;
- não fazer merge do PR #280 até essa validação.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- Cliente é o centro do relacionamento; Obra é o centro da execução.
- Cliente obrigatório e Obra opcional para transações simples; operações de uma obra devem carregar `cliente_id + obra_id`.
- Financeiro é único; cliente/obra são dimensões do mesmo financeiro.
- Cliente 360 Andamento deve derivar status dos cards reais dos setores, nunca manter uma cópia manual divergente.
- Venda confirmada = Financeiro + Conferir Projeto; não liberar o operacional completo diretamente em `Vendido`.
- Perfis/Acessórios/Outros só após Projeto conferido.
- Vidros só após Medição Final aprovada.
- MEE permanece a etapa técnica pós-medição enquanto depender de `medicao_itens` e conferências técnicas.
- Venda fechada deve preservar snapshot; alterações posteriores relevantes devem ter justificativa e histórico antes/depois.
- Venda/Orçamento Balcão rápido não alimenta o Kanban de obras.
- `kanban_entrada_em` é fixa; `coluna_atualizada_em` é movimentação/SLA.
- W.Vetro é referência/origem; regra técnica Atlas validada tem prioridade.
- Não inventar custo, preço, margem, fórmula ou unidade operacional a partir de referência histórica.
