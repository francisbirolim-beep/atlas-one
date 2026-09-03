# IMPLEMENTATIONS.md — Atlas One

## 2026-08-30 — Filtro de produtos ao criar necessidade no Compras 360

- adicionados filtros rápidos de catálogo para Todos, Perfis, Acessórios, Vidros, Produto pronto e Outros;
- filtro classifica os produtos pela categoria já cadastrada e preserva a opção de necessidade digitada manualmente;
- o produto selecionado é desvinculado ao escolher uma categoria incompatível, evitando registrar uma necessidade com filtro visual incorreto;
- nenhuma migration, dado mestre, preço, estoque ou regra de compra foi alterado.

---

## 2026-08-30 — Compras 360 integrado à versão atual do Atlas

- substituída a antiga tela inicial de Compras pela Central Compras 360 sem remover as rotas de NF, recebimento, estoque e financeiro;
- criado fluxo visual de necessidade, cotação, aprovação, pedido, espera de entrega e recebimento;
- adicionada comparação de fornecedores por preço, frete, total, prazo e condição de pagamento;
- adicionada escolha persistida da cotação vencedora e bloqueio de aprovação enquanto nenhuma cotação estiver selecionada;
- reutilizados cadastros reais de produtos e fornecedores e histórico do último custo observado em NF;
- mantida a regra de que `Recebido` no planejamento não movimenta estoque; somente a conferência da NF gera entrada física;
- API autenticada valida dados, sequência de status e vínculo entre necessidade e cotação;
- página adaptada à contenção global de largura para funcionar no celular sem extravasamento horizontal;
- migration do Compras 360 alinhada à versão já registrada no Supabase (`20260828180539`);
- restaurados do histórico Git os 26 arquivos de migrations que já estavam aplicados em produção, mas haviam ficado ausentes da `main`.

---

## 2026-08-30 — Menu mobile claro

- gaveta lateral móvel alinhada ao visual claro já aprovado na Home do Atlas;
- fundo branco, bordas suaves e textos/ícones escuros com contraste maior;
- campo de pesquisa e botão de fechar convertidos para superfícies claras;
- seleção azul preservada para indicar a rota atual;
- permissões, grupos, busca, navegação e acessos administrativos preservados;
- nenhuma migration, tabela, dado ou regra operacional alterada.

---

## 2026-08-29 — Correção global de telas estourando no celular

- corrigida a largura do documento, shell e superfície principal para respeitar o viewport móvel;
- adicionados limites responsivos aos containers internos sem remover a rolagem vertical;
- textos longos, campos e imagens passaram a respeitar a largura disponível;
- Central de Compras ajustada especificamente após evidência enviada em iPhone;
- cards de resumo e atalhos ganharam `min-width: 0`, quebra de texto e ícones sem compressão;
- tabelas largas preservam a rolagem horizontal dentro do próprio componente;
- cache local corrompido do Next.js foi isolado e reconstruído;
- build completo aprovado com TypeScript e geração das 90 rotas;
- nenhuma migration, tabela, permissão ou regra operacional foi alterada.

---

## 2026-08-28 — Navegação completa no celular

- criada barra inferior mobile com Início, Kanban, Compras, Favoritos e Menu;
- substituído o botão flutuante de Favoritos que cobria parte dos indicadores;
- criada gaveta lateral azul-marinho com a navegação operacional agrupada por área;
- adicionada pesquisa de módulos, setores e configurações dentro do menu;
- Administração e Configurações permanecem visíveis somente para o usuário master;
- setores ativos adicionais respeitam o mapa de permissões do usuário;
- itens fixos relacionados a setores ocultos deixam de aparecer nos atalhos rápidos quando existe associação de rota;
- extraída a lista administrativa compartilhada para evitar divergência entre desktop e mobile;
- build local completo aprovado com TypeScript e geração das 90 rotas;
- nenhuma migration, tabela ou regra operacional alterada.

---

## 2026-08-28 — Atlas Visual V2

- nova identidade visual global inspirada na Central de Compras aprovada por Francis;
- sidebar compacta azul-marinho com item ativo azul e marca Atlas One;
- fundo geral mais claro, superfícies brancas e hierarquia tipográfica mais suave;
- Home reorganizada com cabeçalho executivo, atalhos e indicadores no topo;
- painéis operacionais da Home clareados por uma camada CSS isolada;
- títulos contextuais adicionados para Compras 360, Cadastros 360, Estoque, Assistências e Engenharia;
- screenshot real do celular revelou compressão no cabeçalho e excesso de altura na primeira tela;
- topbar mobile reduzido para 60 px, com contexto legível e ações compactas;
- hero mobile compactado e placeholder de logo ocultado no celular enquanto não existir logo cadastrado;
- atalhos e indicadores reorganizados em duas colunas no mobile;
- extravasamento horizontal bloqueado na superfície principal;
- lógica, permissões, rotas e banco preservados;
- build local completo reaprovado com TypeScript e 90 rotas após a correção mobile.

---

## 2026-08-28 — PR #281 — Filtro do Kanban por período e tipo de data

- substituído o filtro de dia único por intervalo inclusivo `De` / `Até`;
- adicionada escolha entre `kanban_entrada_em` e `coluna_atualizada_em`;
- mantido fallback de entrada para `created_at` apenas para compatibilidade legada;
- data de entrada agora é renderizada diretamente no card React;
- removida a leitura duplicada do Supabase e a injeção da data por manipulação do DOM;
- consulta principal do Kanban exclui explicitamente balcão e preserva registros legados com `modo_entrada` nulo;
- tipo `OrcamentoRapido` atualizado com `kanban_entrada_em`;
- build local completo aprovado;
- Build Validation #643 aprovado e preview Vercel `READY`;
- base validada: 49 cards do Kanban, 49 com entrada, 49 com movimentação e 0 balcão indevido.

---

> Histórico anterior preservado integralmente em `docs/ai-handoff/archive/2026-08-23-pre-pr258-IMPLEMENTATIONS.md`.

## 2026-08-28 — Cadastros 360 por usuário

- renomeada a Central de Cadastros para Cadastros 360;
- adicionado Clientes à central, apontando para a base única existente;
- criada configuração individual dos cards visíveis por usuário;
- integrada a seleção à criação e edição de usuários;
- preservado acesso total do Master e compatibilidade dos funcionários existentes;
- build local completo aprovado com 90 rotas.


## 2026-08-26 — Balcão fora do Kanban + data fixa de entrada> Histórico anterior permanece no Git e em `docs/ai-handoff/archive/`.

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

## 2026-09-01 — Explorador de tipologias da base técnica W.Vetro

Implementado por agente de IA (Claude), branch `feat/wvetro-explorador-tipologias-v1`,
sobre `main` já com PR #306 (correção da carga histórica) mesclada.

Adicionado:
- `GET /api/integracoes/wvetro/base-tecnica/tipologias` — lista de referências de
  tipologia com resumo agregado (total, vinculadas ao Atlas, com imagem, com/sem
  composição, com receita oficial).
- `GET /api/integracoes/wvetro/base-tecnica/tipologias/[id]` — detalhe de uma
  referência: dados da tipologia, componentes (perfil/acessório/vidro) com
  código Atlas/W.Vetro, cor, NCM, unidade, quantidade min/max/média, medida
  min/max, custo min/max/último, venda min/max/último, posições, cortes e
  vínculo com produto Atlas; variáveis observadas; receitas técnicas oficiais
  ativas em `engenharia_tipologia_formulas_corte` para a tipologia.
- `/configuracoes/integracoes/wvetro/base-tecnica/tipologias` — tela Master de
  listagem com busca e filtros (sem composição, sem vínculo, sem imagem, com
  receita oficial).
- `/configuracoes/integracoes/wvetro/base-tecnica/tipologias/[id]` — tela de
  detalhe por tipologia (imagem, linha, modelos, perfis, acessórios, vidros,
  ocorrências, custos, componentes vinculados/sem vínculo, variáveis, status de
  validação técnica).
- Link de acesso adicionado ao painel existente de base técnica (edição
  aditiva de uma linha, sem tocar na lógica de carga/checkpoint).

Somente leitura. Não escreve em `wvetro_base_tecnica_execucoes`,
`wvetro_base_tecnica_pendencias` nem em nenhuma tabela de carga histórica.
Não promove dado observado a receita oficial — isso continua manual em
`engenharia_tipologia_formulas_corte`.

`npm run build`: compilou com sucesso localmente (typecheck completo do
projeto historicamente estoura o timeout local — validado via Build
Validation do CI após o push, padrão já usado nesta sessão).

## 2026-09-02 — Investigação: onde estão as variáveis/fórmulas/receitas das tipologias W.Vetro

Investigação feita por agente de IA (Claude), branch separada
`investigacao/wvetro-receitas-variaveis-v1` sobre `main` (com PR #309 já
mesclado), sem tocar em checkpoint/cursor/retry/pendências/execução da carga
histórica nem na lógica da PR #311 (ChatGPT trabalhando nela em paralelo).

Relatório completo em
`docs/ai-handoff/WVETRO_INVESTIGACAO_VARIAVEIS_RECEITAS_2026-09-02.md`. Resumo:

- Auditoria de código (`lib/wvetroApi.ts`, `wvetroBaseTecnicaServer.ts`,
  `wvetroCatalogoCompletoServer.ts`) e do banco de produção confirmou que a
  API W.Vetro não expõe (nem no que já usamos, nem na documentação pública já
  mapeada em `WVETRO_API_MAPPING.md`) um endpoint de "cálculo"/"composição
  paramétrica" que receba `Linha+Modelo+Largura+Altura+Opções` e devolva a
  receita. O que existe é o resultado já calculado de vendas históricas
  (`/vendas/pedidos`, `/vendas/orcamentos`) e catálogo de identidade de
  produto (`/Produtos/produtoByKey`), sem fórmula.
- Confirmado por leitura da função `fn_wvetro_reconstruir_variaveis_explicitas`
  no Postgres: as 10 variáveis que o Atlas tenta reconstruir hoje vêm
  inteiramente de regex sobre o texto livre `modelo_raw` — não há campo
  estruturado de variável na API. Só "folhas" bate consistentemente.
- Confirmado que `produtoByKey?Produtotipo=E` sem código não é suportado pela
  instalação (0 linhas `tipo='E'` em `wvetro_produtos_snapshot`); testar por
  código específico é uma via ainda não tentada (endpoint novo cobre isso).
- Endpoint temporário de diagnóstico, só leitura e restrito a Master, criado durante a investigação e **removido antes do merge**: `GET /api/integracoes/wvetro/base-tecnica/investigacao-variaveis`
  (aceita `?data=`, `?produtoTipo=&produtoCodigo=`, `?linhas=1`; achata chaves
  do payload e destaca as que batem com palavras-chave de variável/fórmula/
  regra). Não pôde ser exercitado neste ambiente por falta de credenciais
  W.Vetro locais — passou no typecheck (`npx tsc --noEmit`).
- Procedimento detalhado de captura via DevTools/Network do navegador
  (filtro, o que olhar em Payload/Response, HAR, `Copy as cURL`, dados
  sensíveis a remover) e roteiro de experimento controlado (5 casos, variando
  um fator por vez) documentados no relatório — depende de execução humana no
  sistema W.Vetro real, nenhum agente de IA tem acesso a essa sessão.
- Proposta de estrutura Tipologia → Variáveis → Regras → Fórmulas →
  Perfis/Acessórios/Vidros → Cortes → Custos, mantendo a separação já usada na
  tela do explorador entre referência histórica e receita técnica validada —
  só proposta, nada implementado.

Nenhuma implementação grande feita nesta rodada, por instrução do usuário.
Nenhum merge para `main`.
