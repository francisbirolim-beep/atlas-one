# IMPLEMENTATIONS.md — Atlas One

> Histórico anterior a 2026-08-23 preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-IMPLEMENTATIONS.md`. Implementações intermediárias de 23–26/08 permanecem também no histórico Git deste arquivo.

## 2026-08-26 — Cliente 360 + Obras + Financeiro por cliente/obra — PR #280

### Central do Cliente
- criada `/clientes/[id]/central` como ponto principal do relacionamento;
- busca de Clientes abre a Central 360;
- cliente pode possuir múltiplas Obras;
- criada `/obras` e workspace `/obras/[id]`;
- `Obras` incluído no menu operacional;
- operações passam a poder carregar `cliente_id` + `obra_id`, mantendo Obra opcional para operações simples;
- documentos, histórico, assistências, orçamentos/vendas e relatórios aparecem consolidados por cliente.

### Financeiro único, filtrado por cliente/obra
- criado vínculo de obra em `financeiro_contas_receber`;
- recebimento geral do cliente pode permanecer sem obra e ser alocado posteriormente;
- um mesmo recebimento pode ser distribuído entre várias obras;
- recebimento direto de uma obra não pode ser redirecionado para outra;
- baixa parcial usa `valor_pago` e mantém status `aberto` até a quitação, preservando compatibilidade com o financeiro existente;
- crédito excedente pode permanecer vinculado à obra;
- Medição Final e conta vinculadas a orçamento herdam `obra_id` automaticamente.

### Validação financeira
Teste em transação com `ROLLBACK`:
- R$ 10.000 gerais divididos em R$ 6.000 na Obra A + R$ 4.000 na Obra B;
- baixa integral e parcial;
- crédito excedente por obra;
- bloqueio de redirecionamento entre obras;
- 0 registros de teste restantes.

Migrations:
- `20260826185419_cliente_360_obras_financeiro_v1.sql`;
- `20260826190418_cliente_360_propagacao_obra_v1.sql`;
- `20260826192848_cliente360_recebimento_multiobra_v1.sql`;
- `20260826193046_cliente360_recebimento_status_compativel_v1.sql`.

---

## 2026-08-26 — Fluxo Venda → Conferir Projeto → Materiais/Medição

### Venda confirmada
A confirmação da venda sob medida foi transformada em evento de negócio idempotente.

Agora cria somente:
- snapshot em `vendas_obras` com valor, custo previsto, condições, forma de pagamento e itens;
- pré-lançamento em `financeiro_contas_receber` e card Financeiro;
- card `Engenharia — Conferir Projeto` em `A conferir`.

As automações antigas `Vendido → Instalação` e `Vendido → Medida Final` foram desativadas. O fluxo não cria mais o operacional completo cedo demais.

### Conferir Projeto
Criado setor `engenharia-projeto` com:
`A conferir → Em conferência → Aguardando ajuste → Projeto conferido`.

`lib/setorKanban.ts` reconhece `Projeto conferido` como gate. Somente nesta transição:
- cria/garante Medição Final;
- cria/garante Perfis;
- cria/garante Acessórios;
- cria/garante Outros materiais.

Materiais usam:
`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

### Vidros somente pós-medição
- criado setor `compras-vidros` com o mesmo fluxo de materiais;
- trigger cria Vidros somente quando Medição Final muda para `aprovado`;
- Medição Final aprovada também alimenta o MEE/Engenharia técnica existente.

### Separação Engenharia pré/pós-medição
Foi encontrado conflito no trigger legado: `fn_medicao_aprovada_para_engenharia()` procurava qualquer setor com “Engenharia” no nome e passou a encontrar o novo `Engenharia — Conferir Projeto`.

Correção:
- automação pós-medição agora aponta explicitamente para setor `mee`;
- Conferir Projeto permanece pré-medição;
- MEE permanece pós-medição, baseado nas peças/medidas finais.

Migrations:
- `20260826212725_fluxo_venda_conferir_projeto_materiais_v1.sql`;
- `20260826213310_fluxo_engenharia_separar_projeto_mee_v1.sql`.

### Histórico e contexto
- `setor_kanban_itens` ganhou `cliente_id`, `obra_id` e metadados de atualização;
- cards herdam automaticamente cliente/obra do orçamento;
- criada `setor_kanban_movimentos` para registrar movimentações;
- criada `venda_obra_revisoes` com justificativa obrigatória como base de auditoria das futuras alterações pós-venda.

### Teste transacional do fluxo
Após corrigir a colisão de Engenharia, teste com `ROLLBACK` confirmou:
- venda = 1;
- financeiro = 1;
- projeto conferido = 1;
- Medição Final aprovada = 1;
- Perfis = 1;
- Acessórios = 1;
- Outros = 1;
- Vidros = 1 somente pós-medição;
- MEE = 1;
- 7 cards com o mesmo cliente/obra;
- 0 registros de teste restantes.

---

## 2026-08-26 — Cliente 360 / Andamento

- criada `components/clientes/Cliente360Andamento.tsx`;
- rota: `/clientes/[id]/central?aba=andamento`;
- a tela não mantém status paralelo: lê os mesmos cards dos setores;
- agrupa por obra e mostra a cadeia macro:
  `Venda → Conferir Projeto → Medição Final → Engenharia final → Materiais → Produção → Instalação`;
- Perfis, Vidros, Acessórios e Outros aparecem em paralelo;
- cada material mostra seu estado real;
- tela identifica um `Bloqueio atual` para facilitar leitura rápida;
- filtro por obra;
- links levam ao processo original do setor.

Produção e Instalação aparecem no painel, mas seus gates automáticos ainda não foram definidos nesta V1.

Referência completa: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

---

## 2026-08-26 — Balcão fora do Kanban + data fixa de entrada

- criado `balcao_orcamentos` como tabela transacional própria do orçamento rápido;
- Orçamento/Venda Balcão rápido deixou de alimentar `orcamentos`, fonte do Kanban;
- cadastros mestres continuam compartilhados;
- criada `orcamentos.kanban_entrada_em` como data fixa da entrada no Kanban;
- `coluna_atualizada_em` continua sendo movimentação/SLA;
- cards do Kanban exibem a data de entrada;
- backfill e isolamento validados: 49/49 cards com data e 0 balcão em `orcamentos`.

---

## 2026-08-25 — Busca Padrão Atlas V1

- criado `lib/buscaAtlas.ts` e `BuscaAtlasInput.tsx`;
- buscas operacionais ignoram caixa/acentos, aceitam múltiplos termos e documentos/telefones sem pontuação;
- padrão integrado em Clientes, Balcão, Assistência, Produtos, Linhas, Estoque, Compras, NFs, Vínculos e Pesquisa/Histórico de Orçamentos;
- seleção de cliente existente preserva o mesmo `clientes.id`, evitando cadastro paralelo.

---

## 2026-08-23/24 — Referência e auditoria W.Vetro

- referência técnica W.Vetro consolidada sem substituir regra Atlas validada;
- perfis, acessórios, tipologias, linhas, vidros, variáveis e imagens preservados com proveniência;
- configuração/fórmula/receita Atlas validada tem prioridade absoluta;
- W.Vetro não cria automaticamente custo, preço, margem, unidade operacional ou estoque;
- auditoria histórica completa não deve ser repetida sem necessidade real.

Referências atuais preservadas:
- 1.307 perfis;
- 1.174 acessórios;
- 111 tipologias referência, 109 mapeadas;
- 119 linhas referência;
- 14 vidros referência;
- 2.481 produtos consultados;
- 1.287 imagens copiadas.
