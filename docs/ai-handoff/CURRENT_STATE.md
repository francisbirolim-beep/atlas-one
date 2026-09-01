# CURRENT_STATE.md — Atlas One

> Checkpoints anteriores permanecem no histórico Git e em `docs/ai-handoff/archive/`.

## EM VALIDAÇÃO — CADASTROS 360 POR USUÁRIO — 2026-08-28

Branch: `feat/cadastros-360-permissoes`

### Implementado no código

- a antiga Central de Cadastros passou a se apresentar como **Cadastros 360**;
- Clientes foi incluído na mesma central, reutilizando o cadastro único existente em `/clientes`;
- a lista de cards visíveis pode ser configurada individualmente em `Usuários e Acesso`;
- usuário Master continua com acesso completo e não pode ter os cadastros ocultados;
- funcionário vê apenas os cards marcados pelo Master;
- usuários antigos preservam a visibilidade atual até receberem uma configuração explícita;
- a configuração usa `configuracoes_gerais` por usuário, sem migration e sem duplicar clientes, produtos, fornecedores ou materiais.

### Validação concluída

- build local completo passou, incluindo TypeScript e geração das 90 rotas;
- nenhum cadastro mestre ou regra comercial/técnica foi alterado.

### Limite desta primeira etapa

- esta entrega controla a composição visual do Cadastros 360;
- autorização profunda por rota e ações separadas (`ver`, `criar`, `editar`, `excluir`, `aprovar`) permanece para a próxima evolução, integrada ao modelo geral de permissões.

## EM VALIDAÇÃO — COMPRAS 360 INTEGRADO À MAIN — 2026-08-30

Branch: `fix/compras-360-main`

### Implementado no código

- `/compras` passou a ser a Central Compras 360, com lista de faltas, cotação, aprovação, pedido, entrega e recebimento;
- comparação de fornecedores mostra preço unitário, frete, total, prazo e forma de pagamento;
- o comprador escolhe explicitamente a cotação vencedora antes de aprovar a compra;
- produtos, fornecedores e último preço real das NFs do Atlas são reutilizados na mesma tela;
- atalhos preservam Entrada por NF, recebimentos, vínculos pendentes, estoque e contas a pagar;
- marcar a necessidade como recebida não altera estoque; o saldo continua entrando somente pela conferência da NF;
- a página recebeu contenção de largura e quebra de textos para não estourar no celular;
- a API valida a sequência do processo e impede aprovação sem cotação selecionada.

### Ajuste pendente de validação — filtro de categoria ao adicionar falta

- o seletor de produto cadastrado passou a ter filtros rápidos: **Todos, Perfis, Acessórios, Vidros, Produto pronto e Outros**;
- os filtros usam a categoria já existente em `produtos`, sem criar cadastro, preço ou regra paralela;
- ao trocar para uma categoria que não contém o produto selecionado, o vínculo é removido para impedir o envio de um item fora do filtro;
- a opção de digitar material manualmente permanece disponível em todas as categorias.

### Banco e histórico

- tabelas `compras_necessidades` e `compras_cotacoes` já existentes e vazias no Supabase de produção foram conferidas;
- migration local reconciliada com a versão remota `20260828180539`;
- 26 migrations já aplicadas no banco, mas ausentes na `main`, foram restauradas a partir do próprio histórico Git para que o controle do Supabase volte a comparar local e remoto corretamente;
- RLS permanece habilitado nas duas tabelas do Compras 360 e o acesso ocorre pela API autenticada do servidor.

### Validação pendente

- build, TypeScript, preview Vercel e controle de migrations do novo PR;
- teste no celular e no computador do fluxo completo até `Recebido`;
- confirmação do deploy de produção após o merge.

## EM VALIDAÇÃO — MENU MOBILE CLARO — 2026-08-30

Branch: `feat/mobile-menu-claro`

### Implementado no código

- a gaveta lateral do celular passou do azul-marinho para uma superfície branca, alinhada à identidade clara da Home;
- textos, ícones, campo de pesquisa, divisórias, botão de fechar e rodapé receberam contraste adequado no tema claro;
- o item selecionado continua azul para preservar a orientação visual;
- fundo externo permanece suavemente escurecido para destacar a gaveta aberta;
- rotas, grupos, busca, favoritos, permissões por setor e acesso administrativo não foram alterados.

### Conferência funcional pendente

- validar o menu aberto no iPhone;
- pesquisar e acessar Compras, Estoque, Cadastros e Configurações;
- conferir o item selecionado e a leitura dos itens não selecionados;
- conferir um usuário com acesso limitado por setor.

## EM VALIDAÇÃO — CORREÇÃO GLOBAL DE LARGURA NO CELULAR — 2026-08-29

Branch: `feat/mobile-navigation-v2`

### Implementado no código

- `html`, `body`, shell e superfície principal agora respeitam a largura real do viewport e bloqueiam extravasamento horizontal do documento;
- containers flex/grid internos podem encolher corretamente com `min-width: 0` e `max-width: 100%`;
- títulos e textos longos quebram linha no celular sem ampliar a página;
- inputs, selects, textareas e imagens ficam limitados à largura disponível;
- a Central de Compras recebeu contenção responsiva própria nos cabeçalhos, cards de resumo e atalhos;
- tabelas e quadros que precisam de largura continuam usando a rolagem horizontal interna já existente;
- nenhuma rota, permissão, regra operacional, migration ou dado foi alterado.

### Validação concluída

- cache local corrompido do Next.js isolado e regenerado;
- compilação e TypeScript aprovados;
- build completo aprovado com geração das 90 rotas;
- `git diff --check` aprovado.

### Conferência funcional pendente

- validar no preview a Home, Compras, Estoque, Cadastros e Configurações em um iPhone;
- confirmar que não é mais possível deslocar a página inteira lateralmente;
- confirmar que tabelas largas continuam rolando apenas dentro do próprio quadro.

## EM VALIDAÇÃO — NAVEGAÇÃO COMPLETA NO CELULAR — 2026-08-28

Branch: `feat/mobile-navigation-v2`

### Implementado no código

- criada barra inferior mobile permanente com **Início, Kanban, Compras, Favoritos e Menu**;
- atalhos de Kanban e Compras deixam de aparecer quando a permissão correspondente estiver oculta;
- botão **Menu** abre uma gaveta lateral em tela cheia com a mesma navegação operacional do desktop;
- gaveta organizada por grupos, com pesquisa por nome do módulo/setor;
- setores adicionais ativos aparecem somente quando liberados para o usuário;
- Administração, Cadastros, Usuários, Permissões e Configurações continuam exclusivos do usuário master;
- Favoritos passou para a barra inferior e o antigo botão flutuante, que cobria indicadores da Home, foi removido;
- ao abrir a gaveta, a rolagem da página de fundo é bloqueada e pode ser fechada pelo fundo, botão ou tecla Escape;
- lista administrativa foi extraída para `lib/navegacaoAdmin.ts` e é compartilhada entre desktop e mobile;
- nenhuma rota, migration, regra operacional ou dado foi alterado.

### Validação concluída

- build local completo aprovado;
- TypeScript aprovado;
- 90 rotas geradas;
- `git diff --check` aprovado.

### Conferência funcional pendente

- validar no preview em celular real;
- abrir e fechar Menu e Favoritos;
- acessar Compras, Estoque, Cadastros e Configurações;
- pesquisar uma opção dentro da gaveta;
- conferir Francis/master com acesso total e um funcionário com opções limitadas por setor.

## EM VALIDAÇÃO — ATLAS VISUAL V2 — 2026-08-28

Branch: `feat/atlas-visual-v2`

### Implementado no código

- criada uma camada visual transversal inspirada no protótipo do Compras 360;
- sidebar desktop reduzida para 236 px, com identidade Atlas, fundo azul-marinho e seleção azul;
- a área principal passou a usar fundo claro e suave, com superfícies brancas e bordas discretas;
- Home ganhou cabeçalho executivo claro, saudação, empresa, data e atalhos operacionais compactos;
- indicadores de gestão foram reposicionados logo após o cabeçalho;
- painéis escuros da Home passaram a superfícies claras sem alterar dados ou ações;
- topbar reconhece Compras 360, Cadastros 360, Estoque, Assistências e Engenharia;
- após validação por screenshot real no celular, o topbar mobile foi reduzido e deixou de comprimir grupo/título;
- no mobile, o bloco de saudação ganhou espaçamentos e tipografia menores e o placeholder de logo sem cadastro não ocupa mais a primeira tela;
- atalhos e indicadores passaram a uma grade compacta de duas colunas no celular;
- a área principal bloqueia extravasamento horizontal sem esconder rolagem vertical;
- preservadas rotas, permissões, busca e regras operacionais.

### Validação concluída

- build local completo aprovado, incluindo TypeScript e geração das 90 rotas;
- correção mobile recompilada com sucesso, incluindo TypeScript e geração das 90 rotas;
- nenhuma migration e nenhuma alteração de banco.

### Conferência funcional pendente

- validar visualmente no preview a Home corrigida no desktop e no celular;
- conferir contraste da sidebar e do tema por usuário;
- navegar por Compras, Cadastros, Estoque, Kanban e Produção;
- confirmar que atalhos, busca global e menu do perfil permanecem funcionando.

## EM VALIDAÇÃO — FILTRO DO KANBAN POR PERÍODO E TIPO DE DATA — 2026-08-28

Branch: `feat/kanban-filtro-periodo-datas`

### Implementado no código

- o filtro de data única foi substituído pelo intervalo inclusivo `De` / `Até`;
- o usuário pode escolher entre **data de entrada no Kanban** e **data da última movimentação**;
- entrada usa `kanban_entrada_em`, com fallback para `created_at` apenas em registros legados;
- movimentação usa exclusivamente `coluna_atualizada_em`, preservando a separação de significado entre as duas datas;
- datas ausentes ou inválidas não entram no resultado quando existe filtro de período ativo;
- os limites `De` / `Até` se ajustam para impedir intervalo invertido;
- a data `📅 Entrada: DD/MM/AAAA` passou a ser renderizada diretamente no componente React do card;
- removida a consulta duplicada e a injeção de data por `MutationObserver`/manipulação do DOM;
- a consulta principal do Kanban ganhou proteção explícita para excluir `modo_entrada='balcao'`, preservando registros legados com modo nulo.

### Validação concluída

- build local completo passou, incluindo TypeScript e geração das 90 rotas;
- consulta real na base: 49 orçamentos, 49 válidos para o Kanban, 49 com data de entrada, 49 com última movimentação e 0 balcão indevido;
- nenhuma migration nova foi necessária.

### Validação remota concluída

- PR #281 aberto com um único commit e os seis arquivos esperados;
- Build Validation #643 concluído com sucesso;
- Preview Vercel confirmado como `READY`.

### Conferência funcional pendente

- conferir visualmente o layout dos filtros no desktop e no celular;
- testar um período pela data de entrada e o mesmo período pela última movimentação;
- confirmar que `Limpar filtros` restaura o tipo padrão para data de entrada.

## INTEGRADO NA MAIN — BALCÃO FORA DO KANBAN + DATA DE ENTRADA — PR #279## EM VALIDAÇÃO — CLIENTE 360 + FLUXO + PRECIFICAÇÃO + MATERIAIS — 2026-08-27
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

### Validação técnica concluída

- PR #279 mesclado na `main` em 2026-08-26;
- deploy Vercel do merge confirmado com status `success`;
- base reconferida em 2026-08-28: 49/49 cards com `kanban_entrada_em` e 0 registro de balcão em `orcamentos`.

### Conferência funcional recomendada em produção

- abrir `/kanban` e confirmar visualmente a data na posição combinada;
- mover um card de coluna e confirmar que `Entrada` permanece a mesma;
- filtrar pelo calendário e confirmar o dia de entrada;
- criar um Orçamento Balcão e confirmar que aparece apenas em `/balcao/orcamentos`, nunca no `/kanban`.Validação funcional do HEAD de código `bd9597fb3462b83bfe54c80381067b4c96ed3bae`:
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
- interface completa para revisão financeira pós-venda ainda é evolução posterior.

## Merges recentes (2026-09-01)

- PR #280 (Cliente 360 completo, obras, financeiro, fluxo operacional): mesclada.
- PR #305 (base técnica completa W.Vetro: tabela `wvetro_tipologia_componentes`,
  colunas `custo_wvetro_*`/`venda_wvetro_*` em `produtos`, painel
  `/configuracoes/integracoes/wvetro/base-tecnica`, endpoint
  `/api/orcamento/wvetro-referencias`): mesclada.
- PR #304 (conferência de itens W.Vetro antes de salvar na confirmação de venda,
  vínculo obra na confirmação de venda): mesclada.
- Merges feitos em modo fix-forward (sem clique-a-clique manual do checklist do
  autor), com autorização explícita do usuário, resolvendo conflitos de merge
  manualmente e cobrindo com CI (Build Validation + Supabase Database Control)
  antes do merge final. Validação funcional em produção continua pendente do
  usuário.
- PR #306 (`fix/wvetro-pendencias-historico-v9`, corrige a carga histórica
  W.Vetro travar em dia com erro) estava em andamento por outro agente na data
  desta atualização — não mexer nos arquivos dela.

## Base técnica W.Vetro para Orçamento Sob Medida

Auditoria original em `docs/ai-handoff/WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01.md`,
segunda rodada completa em
`docs/ai-handoff/WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01-v2.md` (esta é a
referência mais recente). A carga histórica (PR #306, ChatGPT — não mexer)
está `em_andamento`, com dias problemáticos virando pendência auditável em
vez de travar tudo. Números direto do Supabase em 2026-09-01 (noite):
- 859 dias processados de ~987 (87%), 128 dias em pendência (`wvetro_base_tecnica_pendencias`);
- composição por tipologia (`wvetro_tipologia_componentes`): 668 linhas (subiu de 504), 338 vinculadas a produto Atlas, 21 tipologias já com alguma composição (de 113 referências);
- catálogo de referência: 1.529 perfis (91% vinculados), 1.294 acessórios (98% vinculados) — estável;
- 86 tipologias já com imagem (subiu de 34, agora 76% de cobertura);
- 177 produtos Atlas com `custo_wvetro_ultimo` (subiu de 47);
- 2 receitas técnicas oficiais ativas em `engenharia_tipologia_formulas_corte` (sem mudança);
- achado novo: `unidade_origem` nunca preenchida em `wvetro_tipologia_componentes` (gap de extração, não desta frente — documentado, não corrigido aqui).

Tela de auditoria por tipologia (Master), mergeada em `main` (PR #308):
`/configuracoes/integracoes/wvetro/base-tecnica/tipologias` (lista com
filtros + cards de catálogo global) e
`/configuracoes/integracoes/wvetro/base-tecnica/tipologias/[id]` (detalhe:
imagem, linha/modelo, vínculo Atlas, composição perfil/acessório/vidro com
quantidade/medida/custo/venda/posições e cortes observados/vínculo de
produto, variáveis observadas, status de receita oficial com rótulo
explícito **REFERÊNCIA HISTÓRICA** vs **RECEITA TÉCNICA VALIDADA**). Só
leitura. Extensão adicional (cards de catálogo global, rótulos explícitos,
lista real de posições/cortes) na PR `feat/wvetro-auditoria-completa-v2`,
aguardando Preview/validação.

Ainda falta para reproduzir o Orçamento Sob Medida como o W.Vetro: a maioria
das 113 tipologias ainda não tem nenhuma composição (só 21 têm, 19%), e a
carga segue em andamento — reauditar quando ela concluir. Não existe
granularidade de variáveis por pedido individual (só valor agregado por
tipologia), o que limita mostrar "configurações diferentes entre orçamentos"
além do que já é exposto (posições/cortes distintos por componente).

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
