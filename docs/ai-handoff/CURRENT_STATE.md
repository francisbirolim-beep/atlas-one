# CURRENT_STATE.md — Atlas One

> Checkpoints anteriores permanecem no histórico Git e em `docs/ai-handoff/archive/`.

## EM VALIDAÇÃO — CLIENTE 360 + FLUXO + PRECIFICAÇÃO + MATERIAIS — 2026-08-27

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge antes da validação visual/funcional do usuário.**

## Novo Orçamento / Tipologias — atualização 2026-08-27

`/orcamento/novo` agora é o hub principal com três opções:
- `Orçamento Obra`: fluxo completo com seleção inicial de tipologia e catálogo completo;
- `Novo Orçamento Sob Medida`: abre diretamente o formulário técnico;
- `Venda Balcão`: fluxo rápido fora do Kanban de obra.

O catálogo contém 122 tipologias ativas. Antes, a coluna `tipologias.categoria` aceitava somente `porta` e `janela`, apesar de existirem registros de fachada, ACM, ripados, vidro, guarda-corpo, portão etc. A migration `20260827171516_tipologias_categorias_completas_v1.sql` ampliou a classificação sem excluir registros.

Categorias atuais: `porta`, `janela`, `modulo_fixo`, `fachada`, `box`, `painel_ripado`, `acm`, `cobertura_claraboia`, `contramarco_arremate`, `espelho`, `portao_grade`, `guarda_corpo_corrimao`, `vidro`, `tela_mosquiteira`, `outros`.

Na tela de Orçamento Obra:
- busca filtra em tempo real;
- categoria e linha são filtros independentes;
- sem linha selecionada, todas as tipologias ficam disponíveis;
- não há mais limite visual de 40 cards;
- tipologia selecionada é repassada ao formulário técnico;
- imagens reais têm prioridade; ausência de foto usa miniatura esquemática.

Regra de Kanban criada anteriormente continua válida: orçamento de formulário concluído entra em `Orçamento feito`; Venda Balcão continua fora do Kanban de obra.

Validação funcional do HEAD de código `bd9597fb3462b83bfe54c80381067b4c96ed3bae`:
- Build Validation #620: success;
- Supabase Database Control #343: success;
- Vercel Preview: READY;
- `/orcamento/novo`: HTTP 200.

## Fluxo oficial da venda sob medida

### Venda confirmada
Cria somente:
1. snapshot em `vendas_obras`;
2. Financeiro conforme regra ativa;
3. `Engenharia — Conferir Projeto`;
4. só então `orcamentos.status='vendido'`.

Não criar Medição Final, materiais, Produção ou Instalação diretamente em `Vendido`.

### Projeto conferido
Cria/garante:
- Medição Final;
- Perfis;
- Acessórios;
- Outros;
- pacote técnico da obra a partir das fórmulas validadas;
- ordens de Produção vinculadas quando aplicável.

Vidros ainda não são liberados nesta etapa.

### Medição Final aprovada
Cria/garante:
- Vidros;
- MEE/Engenharia técnica pós-medição.

## Gates atuais de Produção e Instalação

Produção não é liberada por simples entrada em Vendido.

A ordem de esquadria só pode ser liberada quando:
- Medição Final estiver `aprovado`;
- Perfis estiverem `Liberado`;
- Acessórios estiverem `Liberado`;
- Outros estiverem `Liberado`.

O card de Produção acompanha o estado real das ordens e não deve ser arrastado manualmente para um estado incompatível.

Instalação só é criada/liberada quando:
- todas as ordens de produção não canceladas estiverem concluídas;
- Vidros estiverem `Liberado`.

A automação `Produção concluída → Instalação` está ativa. A regra genérica `Materiais liberados → Produção` continua inativa porque a liberação de Produção é feita pelo gate técnico das ordens, não por criação cega de card.

Instalação usa as colunas iniciais:
`Agendada → Em instalação → Concluída`.

Concluir Instalação conclui a Obra e dispara o evento de fechamento correspondente.

## Cliente 360 / Obras

Implementado:
- `/clientes/[id]/central`;
- `/clientes/[id]/central?aba=andamento`;
- múltiplas Obras por cliente;
- `/obras` e `/obras/[id]`;
- Financeiro único por cliente/obra;
- recebimentos gerais, por obra e multiobra;
- documentos, histórico, assistências, orçamentos/vendas, relatórios e IA;
- Andamento derivado dos cards reais dos setores, sem status paralelo.

A obra agora possui navegação para:
- Visão da Obra;
- Materiais / Estoque;
- Produção.

## Materiais / Estoque da Obra

Nova rota: `/obras/[id]/materiais`.

Fluxo operacional:
`Necessidade técnica → Plano de barras → Separação física do estoque → Compra final`.

Estruturas principais:
- `pacotes_tecnicos`;
- `pacote_tecnico_materiais`;
- `pacote_tecnico_barras`;
- `pacote_tecnico_cortes`;
- `pacote_tecnico_separacoes`;
- `pacote_tecnico_compras`;
- `estoque_sobras_perfis`.

A tela permite:
- gerar/regerar pacote técnico;
- editar quantidade de material com justificativa;
- incluir/remover material manualmente;
- visualizar plano de barras e cortes;
- separar barras inteiras do estoque;
- reservar retalhos/sobras;
- desfazer separação;
- recalcular aproveitamento;
- ajustar a quantidade final que realmente será comprada;
- incluir compra manual;
- marcar pacote conferido.

Regra permanente: **comprado não é igual a consumido**. Reserva, sobra, retorno ao estoque e consumo realizado devem permanecer conceitos distintos.

## Precificação do Orçamento

Rotas:
- `/orcamento/precificacao`;
- `/orcamento/[id]/precificacao`.

Base implementada:
- margem geral do orçamento;
- margem individual por item/tipologia;
- cobrança de sobra geral ou por item;
- sobra cobrada entra somente a custo, sem margem comercial;
- cálculo/otimização de barras antes da venda;
- componentes por Perfis, Acessórios, Vidros e custos extras;
- custos extras: mão de obra, instalação, deslocamento, frete, pintura, terceiros, consumíveis e outros;
- custo pendente explícito quando cadastro/regra não é suficiente;
- edição do custo no orçamento;
- opção de persistir custo corrigido em `catalogo_custos_tecnicos` para próximos orçamentos;
- `custo_otimizado`, `custo_sobra_cobrada` e snapshot de otimização em `orcamentos`.

Automação técnica só usa fórmula com status validado. Fórmula sem evidência suficiente gera pendência; não inventar material.

## Overrides e histórico de Tipologias

Alterações de componente podem ter dois escopos:
- `orcamento`: vale somente naquele orçamento via `orcamento_item_componentes_overrides`;
- `tipologia_definitiva`: altera a fórmula técnica e cria nova versão histórica.

Histórico:
- tabela `engenharia_tipologia_formulas_historico`;
- toda alteração técnica relevante cria versão;
- restauração não apaga a versão atual: cria uma nova versão baseada na escolhida;
- restauração e alteração definitiva são master-only;
- tipologia pode ser duplicada para desenvolvimento sem alterar a original;
- rota `/engenharia/historico-tipologias` está disponível no menu da Engenharia.

## Produção

`/producao` trabalha com ordens vinculadas a Cliente → Obra → Venda.

- Contramarco e esquadria podem ser ordens separadas;
- ordem de esquadria pode nascer bloqueada aguardando gates;
- status de ordem: `aguardando`, `liberada`, `em_producao`, `conferencia`, `concluida`, `cancelada`;
- card do setor é sincronizado a partir das ordens;
- Plano de Corte continua como snapshot operacional da receita técnica.

## Dados técnicos de perfis

Migration `20260827023133_produtos_backfill_tamanho_barra_origem_v1.sql` preenche `produtos.tamanho_barra_mm` a partir de `tamanho_barra_mm_origem` somente onde o campo operacional estava nulo e a origem possuía valor válido. Não sobrescreve valor operacional existente.

## Financeiro e Venda Balcão

- Financeiro continua sendo base única;
- Cliente e Obra são dimensões da mesma base;
- snapshot de venda fica em `vendas_obras`;
- alterações pós-venda devem usar revisão com justificativa;
- Venda/Orçamento Balcão rápido continua fora do workflow de obra;
- Balcão compartilha cadastros, estoque e financeiro, sem duplicar base.

## Migrations desta etapa

Além das migrations Cliente 360/workflow já registradas, entraram:
- `20260827012106_producao_ordens_vinculadas_revisoes_v1.sql`;
- `20260827013630_fluxo_producao_instalacao_gates_v1.sql`;
- `20260827015657_material_planejamento_aproveitamento_estoque_v1.sql`;
- `20260827020901_orcamento_margem_sobra_otimizacao_v1.sql`;
- `20260827021039_orcamento_precificacao_componentes_catalogo_v1.sql`;
- `20260827021551_orcamento_override_historico_tipologia_v1.sql`;
- `20260827023133_produtos_backfill_tamanho_barra_origem_v1.sql`;
- `20260827164537_orcamento_obra_entrar_orcamento_feito_v1.sql`;
- `20260827171516_tipologias_categorias_completas_v1.sql`.

Todas estão aplicadas no Supabase e versionadas no repositório.

## Ainda pendente / não considerar concluído

- teste visual e operacional do usuário no Preview;
- validar as 3 opções do Novo Orçamento e o catálogo completo de tipologias;
- validar Precificação com um orçamento real contendo tipologias/fórmulas validadas;
- validar Materiais/Estoque em uma obra real;
- validar separação de barra/retalho e desfazer;
- validar Produção completa e gate de Instalação com cenário real;
- definir responsáveis das etapas além do Financeiro;
- completar o módulo de custos `Previsto → Otimizado → Comprado → Realizado` com consumo real, devolução e custo realizado;
- interface completa para revisão financeira pós-venda ainda é evolução posterior;
- não fazer merge do PR #280 até aprovação do usuário.

## Regras técnicas a preservar

- GitHub é fonte da verdade.
- Nunca commit direto em `main`; branch → PR → checks → Preview → merge manual.
- Cliente é centro do relacionamento; Obra é centro da execução.
- Cliente 360 deriva status dos processos reais.
- Venda confirmada não libera downstream completo.
- Vidros nunca antes da Medição Final aprovada.
- Produção depende de Medição aprovada + Perfis/Acessórios/Outros liberados.
- Instalação depende de Produção concluída + Vidros liberados.
- Workflow deve ser idempotente e auditável.
- Fórmula técnica não validada não deve gerar compra automática inventada.
- Alteração definitiva de tipologia gera nova versão; restauração nunca apaga histórico.
- Sobra cobrada no orçamento entra somente a custo, sem margem.
- Compra, separação, consumo e sobra são estados distintos.
- Venda fechada preserva snapshot; revisão exige justificativa.
- Venda/Orçamento Balcão rápido não entra no workflow de obra.
