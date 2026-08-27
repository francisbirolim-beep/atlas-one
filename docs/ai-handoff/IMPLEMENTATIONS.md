# IMPLEMENTATIONS.md — Atlas One

> Histórico anterior permanece no Git e em `docs/ai-handoff/archive/`.

## 2026-08-27 — Novo Orçamento: 3 entradas + catálogo completo de tipologias — PR #280

Implementado em `/orcamento/novo`:
- três entradas principais: `Orçamento Obra`, `Novo Orçamento Sob Medida` e `Venda Balcão`;
- `Orçamento Obra` exibe o catálogo completo de tipologias, com busca em tempo real, filtro por categoria e linha;
- linha é apenas filtro: sem linha selecionada, todas as tipologias ativas ficam visíveis;
- removido o limite visual de 40 cards;
- seleção inicial de tipologia continua sendo repassada ao formulário de orçamento;
- Venda Balcão permanece fora do Kanban de obra.

A tabela `tipologias` já continha 122 tipologias, porém o campo `categoria` aceitava apenas `porta` e `janela`. A migration `20260827171516_tipologias_categorias_completas_v1.sql` ampliou a classificação sem apagar tipologias e redistribuiu os registros em famílias reais: porta, janela, módulo fixo, fachada, box, painel/ripado, ACM, cobertura/clarabóia, contramarco/arremate, espelho, portão/grade, guarda-corpo/corrimão, vidro, tela mosquiteira e outros.

Validação desta rodada:
- Build Validation #620: success;
- Supabase Database Control #343: success;
- Vercel Preview do HEAD `bd9597fb3462b83bfe54c80381067b4c96ed3bae`: READY;
- `/orcamento/novo`: HTTP 200.

---

## 2026-08-27 — Precificação técnica do orçamento — PR #280

Criadas:
- `/orcamento/precificacao`;
- `/orcamento/[id]/precificacao`;
- `lib/orcamentoPrecificacao.ts`;
- `orcamento_precificacao_componentes`;
- `orcamento_item_precificacao`;
- `catalogo_custos_tecnicos`.

Funcionalidades:
- margem geral e individual por item;
- cobrança de sobra geral/individual;
- sobra cobrada somente a custo, sem margem;
- geração de componentes a partir do pacote técnico;
- custo de perfil por peso/comprimento quando cadastro permite;
- custo de produto/catálogo ou pendência explícita;
- custos extras de mão de obra, instalação, deslocamento, frete, pintura, terceiros, consumíveis e outros;
- edição do custo no orçamento;
- opção de salvar custo corrigido no catálogo;
- `custo_otimizado`, `custo_sobra_cobrada` e snapshot de otimização no orçamento.

Migration:
- `20260827020901_orcamento_margem_sobra_otimizacao_v1.sql`;
- `20260827021039_orcamento_precificacao_componentes_catalogo_v1.sql`.

---

## 2026-08-27 — Pacote técnico + aproveitamento + estoque + compra — PR #280

Criada rota `/obras/[id]/materiais` e navegação da Obra.

Estruturas:
- `pacotes_tecnicos`;
- `pacote_tecnico_materiais`;
- `pacote_tecnico_barras`;
- `pacote_tecnico_cortes`;
- `pacote_tecnico_separacoes`;
- `pacote_tecnico_compras`;
- `estoque_sobras_perfis`.

Fluxo implementado:
`Necessidade → otimização de barras → separação de estoque/sobra → compra final`.

A operação permite ajuste manual com justificativa, separação de barra inteira, reserva de retalho, desfazer separação e recalcular o faltante a comprar.

`Projeto conferido` passa a gerar o pacote técnico automaticamente quando o fluxo é concluído pela interface.

Migration:
- `20260827015657_material_planejamento_aproveitamento_estoque_v1.sql`.

---

## 2026-08-27 — Produção e Instalação com gates — PR #280

Produção passa a trabalhar com ordens vinculadas a Cliente/Obra/Venda.

Gate de esquadria:
- Medição Final aprovada;
- Perfis `Liberado`;
- Acessórios `Liberado`;
- Outros `Liberado`.

O card de Produção é sincronizado com as ordens e não aceita movimento manual incompatível.

Gate de Instalação:
- todas as ordens não canceladas concluídas;
- Vidros `Liberado`.

A automação `Produção concluída → Instalação` está ativa. Instalação nasce com fluxo `Agendada → Em instalação → Concluída` e o fechamento conclui a Obra.

Migrations:
- `20260827012106_producao_ordens_vinculadas_revisoes_v1.sql`;
- `20260827013630_fluxo_producao_instalacao_gates_v1.sql`.

---

## 2026-08-27 — Overrides, versionamento e restauração de Tipologias — PR #280

Criadas:
- `orcamento_item_componentes_overrides`;
- `engenharia_tipologia_formulas_historico`;
- rota `/engenharia/historico-tipologias`.

Regras:
- alteração só no orçamento não mexe na tipologia mestre;
- alteração definitiva de perfil/acessório exige master + justificativa;
- alteração técnica relevante incrementa versão;
- restauração cria nova versão baseada na histórica, sem apagar versões anteriores;
- tipologia pode ser duplicada para desenvolvimento sem alterar original.

Migration:
- `20260827021551_orcamento_override_historico_tipologia_v1.sql`.

---

## 2026-08-27 — Normalização de comprimento de barra

Foi identificado que vários perfis possuíam `tamanho_barra_mm_origem` válido, mas `tamanho_barra_mm` operacional nulo.

Migration `20260827023133_produtos_backfill_tamanho_barra_origem_v1.sql` copia o valor de origem somente quando o operacional está vazio, sem sobrescrever cadastro já definido.

---

## 2026-08-26 — Cliente 360 + Motor de Automações — PR #280

Implementado:
- Central 360 e Andamento;
- múltiplas Obras por cliente;
- Financeiro único com recebimentos/alocações por obra;
- fluxo Venda confirmada → Financeiro + Conferir Projeto;
- Projeto conferido → Medição + Perfis + Acessórios + Outros;
- Medição aprovada → Vidros + MEE;
- motor configurável `workflow_automacoes` + auditoria `workflow_execucoes`;
- tarefas/notificações reaproveitam o sistema existente;
- cards carregam cliente/obra/responsável/contexto;
- venda fechada preservada em `vendas_obras` e base de revisões em `venda_obra_revisoes`;
- Balcão rápido permanece fora do workflow de obra.

Validação transacional anterior com ROLLBACK confirmou idempotência do fluxo até Medição aprovada e ausência de registros temporários.

---

## Validação técnica da rodada

HEAD anterior de código `22fa0bf81e5ab8132e2b46808a67412dbee81585`:
- Build Validation #605: success;
- Supabase Database Control #328: success;
- Vercel Preview: READY;
- `/orcamento/precificacao`: HTTP 200.

HEAD atual `bd9597fb3462b83bfe54c80381067b4c96ed3bae`:
- Build Validation #620: success;
- Supabase Database Control #343: success;
- Vercel Preview: READY;
- `/orcamento/novo`: HTTP 200.

PR #280 continua draft e sem merge.
