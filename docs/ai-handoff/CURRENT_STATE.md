## 2026-10-15 — Compras: conferência de NF + estoque visível — em branch, NÃO publicada

Branch: `feature/compras-recebimento-estoque-20261015` criada a partir de `main` (#842). Desenvolvimento local **sem deploy nem migração no banco real**. Pedidos com destino cliente/obra ou estoque, importação XML/PDF e entrada manual existentes foram preservados. A entrada da NF passou a consultar saldos do produto vinculado (físico, reservado, disponível), mostrar imagens cadastradas e filtrar produtos/fornecedores pelo `empresa_id` do usuário. A conferência de recebimento apresenta saldo, entrada projetada, saldo após a entrada e pendências; reforçado isolamento da empresa e preenchimento de `empresa_id` nas gravações. A movimentação física continua exclusivamente pela RPC existente `aplicar_estoque_recebimento`, depois da confirmação; avarias não entram no estoque.

Nova conciliação **pedido de compra ↔ item da nota** na tela de detalhe da NF: vínculo manual a necessidade/pedido aprovado, destino estoque ou cliente/obra, quantidades e saldos pendentes, múltiplas NFs para um mesmo pedido e múltiplos pedidos por NF. Nova migração ADITIVA `20261015173000_compras_nf_vinculo_pedidos_v1.sql` cria tabela e gatilhos de validação por empresa, fornecedor/cotação selecionada, produto e unidade compatíveis, além de limites quantitativos e impedimento de exclusão após recebimento. A migração ainda **NÃO foi aplicada**; função de vínculo precisa da migração no ambiente de teste e teste autenticado. Associar pedido à NF não reserva, movimenta ou consome o estoque; esses eventos seguem independentes. Faltam teste funcional com notas/estoque de homologação e aprovação de release.

## 2026-10-12 — Separação de Materiais por peça aprovada — em desenvolvimento (não publicada)

Branch: `feat/producao-separacao-parcial-20261012`.

- Menu Produção ganha `Kanban Geral` (rota antiga preservada) e `Separação de Materiais` em `/producao/separacao`.
- Painel de separação lista somente unidades `medicao_itens` com `medido=true`, `status_medicao='aprovada'` e quantidade 1, inclusive em medição parcial; as demais não aparecem.
- Card do Kanban abre resumo dessas peças aprovadas e link para separação; o sincronizador passa a reconhecer medições parciais com ao menos uma posição aprovada, sem duplicar os cards existentes.
- Separação registra aguardando, pendente com motivo ou materiais conferidos, histórico imutável e responsável.
- Para marcar materiais conferidos, exige pacote técnico `medicao_final`, vínculo explícito da unidade `medicao_item_id` quando houver `item_ref` comercial compartilhado e todos os materiais conferidos. Fórmulas pendentes, perfil sem produto e material manual sem unidade bloqueiam conclusão. Alteração posterior do pacote/quantidade invalida a conclusão anterior na leitura.
- Novo botão **Gerar pacote técnico das peças aprovadas** em Produção → Separação: endpoint autenticado com permissão de edição, vínculo tenant/obra e sessão Supabase do próprio usuário (RLS). Usa Medição Final individual aprovada, gera lista/cálculo de pacote sem liberar ordem, reservar estoque ou substituir pacotes antigos; mantém o caminho legado de aprovação total inalterado.
- Testes de pacote parcial cobrem tipologias repetidas, medições incompletas, quantidade agrupada, medidas inválidas e item não identificado. Migration de vínculo individual segue pendente de implantação.
- Primeiro incremento NÃO reserva nem baixa estoque, NÃO altera status de ordens ou gates, NÃO libera Instalação. O estado de materiais é um checklist físico independente.
- Migration `20261012151500_producao_separacao_por_peca_v1.sql` ainda NÃO aplicada. Inclui vínculo `pacote_tecnico_materiais.medicao_item_id`, que preserva o `item_ref` comercial, bloqueia materiais manuais sem unidade associada e valida tenant/orçamento no banco. Antes de usar o fluxo: aplicar migration de forma controlada, validar usuário Master/produção, medição parcial e lote duplicado, depois PR e release manual.
- Validações: TypeScript, build Next.js e testes de regressão locais aprovados (não são teste funcional autenticado).

## 2026-10-04 — WhatsApp IA supervisionada — candidata a teste

Branch: `feat/whatsapp-ia-aprendizado-v1`

### Implementado

- Controle Master do Assistente IA do WhatsApp em três estágios: **Observando**, **Sugerindo** e **Atendendo**.
- Estado inicial seguro em **Observando**; nenhuma resposta automática é liberada por padrão.
- Reaproveitado o multicanal existente do WhatsApp: Empresa, Francis particular e futuros números continuam separados na tela, enquanto o aprendizado empresarial pode ser compartilhado.
- Cada canal pode ser habilitado/desabilitado como fonte de aprendizado, ter classificação automática/forçada e setor padrão.
- Em canal pessoal, a IA classifica contexto como **empresa**, **pessoal** ou **dúvida**. Conteúdo classificado como pessoal não vira conhecimento, sugestão nem memória empresarial.
- Conteúdo empresarial reutilizável entra primeiro como **candidato** na Central de Aprendizado; só vira memória oficial após validação.
- Em modo Sugerindo, o WhatsApp mostra **Sugestão da IA**, confiança e setor, com ações **Usar e editar** ou **Descartar**. O feedback fica auditável.
- Em modo Automático, a resposta só pode sair quando: o Master liberou aquele canal, a confiança atingiu o mínimo, a IA marcou o caso como seguro e o assunto não envolve preço/desconto, reclamação, cobrança sensível, promessa de prazo ou decisão técnica de risco.
- O atendente continua podendo assumir a conversa.
- Nova tela Master: `/administracao/ia/whatsapp`.
- Nova API autenticada: `/api/integracoes/whatsapp/ia`.

### Banco e runtime

- Migration `20261004224708_whatsapp_ia_aprendizado_v1.sql` aplicada no Supabase.
- Tabelas novas são backend-only, com RLS habilitado e acesso direto de `anon`/`authenticated` revogado.
- `whatsapp-gateway` publicado no Supabase Edge Functions como versão **18**, status **ACTIVE**.
- Configuração inicial confirmada: **1 canal aprendendo**, **0 canais automáticos**, modo **Observando**.

### Validação técnica

- `npm run typecheck`: aprovado.
- `npm run validate`: aprovado; Next.js compilou e gerou **131 rotas/páginas**.
- Bundle do Edge Function aceito pelo Supabase.
- Próximo passo é validação funcional controlada com Francis antes de qualquer liberação automática.

[Reading 585 lines from start (total: 585 lines, 0 remaining)]

## 2026-09-30 — INFRA LOCAL-FIRST / BAIXO CONSUMO VERCEL

- Workspace persistente criado no Mac: `~/Atlas-One-Dev`.
- Desenvolvimento pode ser testado em `http://localhost:3000` e, na mesma rede, pelo IP do Mac na porta 3000.
- `npm run typecheck`, `npm run validate` e `npm run release:check` configurados.
- Gates de release impedem producao fora da `main`, com working tree suja ou diferente de `origin/main`.
- Integracao GitHub -> Vercel desconectada deliberadamente: commits, branches e PRs nao devem gerar deployments.
- `vercel.json` tambem mantem `git.deploymentEnabled=false` como defesa adicional.
- Preview e producao agora sao manuais: `npm run vercel:preview` / `npm run vercel:prod`.
- Producao existente permaneceu ativa e respondeu HTTP 200 depois da desconexao do Git.
- Variaveis Production/Preview permaneceram cadastradas na Vercel.
- Preflight de producao da `main` validado com TypeScript + build completo e 111 paginas geradas.
- Objetivo operacional: acumular mudancas, testar localmente e gastar Vercel apenas em candidatos reais de release.

## 2026-09-30 — Maiúsculas globais sem perder o onChange (PR #490)

- `components/system/UppercaseInputProvider.tsx` passou a gravar o texto em maiúsculas pelo setter nativo do protótipo (`HTMLInputElement.prototype` / `HTMLTextAreaElement.prototype`), em vez de `alvo.value = ...`.
- Causa: a atribuição direta atualizava o `_valueTracker` do React; o React concluía que o campo não mudou e não disparava o `onChange`. O campo mostrava o texto, mas o estado da tela ficava vazio sempre que a última tecla era uma letra minúscula.
- Sintomas corrigidos: busca em `/clientes/identificar` sem resultado até dar espaço ou apagar; campos de cadastro (ex.: nome em `/clientes/novo`) com estado vazio apesar do texto visível.
- Validado com teste isolado (React 18.3 + jsdom + user-event), preview Vercel aprovado pelo usuário e merge em `main` (`3ccf6ec`).
- Dados conferidos: nenhum cliente salvo sem nome. Os 26 clientes criados desde 12/08 sem cidade também não têm bairro, WhatsApp nem telefone, padrão de cadastro rápido só com nome, e não de perda por este defeito.

## 2026-09-28 — Medição Final: descrição e acesso ao checklist

- Cartões do controle mostram a descrição completa e abrem o checklist da peça pelo ID, com rolagem e foco; numeração e quantidade são secundárias.
- Descrição do PDF preservada. Orçamentos estruturados sem descrição usam nome, folhas e ambiente, sem o fallback Item N.
- Linhas legadas genéricas recuperam a identificação na leitura apenas quando ordem, tipo, quantidade e total de linhas conferem com o orçamento. Nenhuma medida, foto, resposta ou status é regravado.
- Checklist existente mantido: larguras/alturas, fotos, padrões fixos e campos configurados por tipologia. Não foi criado um checklist técnico novo.
- Regressão: node scripts/test-medicao-descricao.cjs. Validação de interface autenticada e publicação em produção ainda pendentes.
# CURRENT_STATE.md — Atlas One

> Checkpoints anteriores permanecem no histórico Git e em `docs/ai-handoff/archive/`.

## EM VALIDAÇÃO — PROSPECÇÃO EM CAMPO V1 — 2026-09-16

Branch: `feat/prospeccao-campo-v1`

### Implementado

- pré-cadastro rápido pelo celular com nome/identificação obrigatória e demais dados opcionais;
- captura da localização atual com latitude, longitude, precisão e link para mapa;
- cadastro de pessoas da obra: cliente, pedreiro, mestre de obras, arquiteto, engenheiro, construtora e outros;
- fase da obra, interesses, temperatura, observações e próxima ação;
- Kanban próprio com nove etapas e movimentação por arrastar;
- filtros por vendedor (Master), cidade, bairro e busca textual;
- agenda de retornos com identificação de atrasados;
- integração da próxima ação com a agenda pessoal do vendedor;
- ficha da prospecção com edição posterior, contatos e diário cronológico;
- conversão segura para Cliente 360, com busca de possíveis duplicidades e criação opcional da obra;
- Master vê o geral; funcionário acessa somente as prospecções sob sua responsabilidade;
- tabelas protegidas por empresa, RLS e grants explícitos somente para usuários autenticados.

### Banco aplicado

- migration `20260916151751_prospeccao_campo_v1.sql` aplicada no projeto Supabase de produção;
- tabelas `prospeccoes`, `prospeccao_contatos` e `prospeccao_interacoes`;
- RPC transacional `fn_converter_prospeccao_v1`.

### Validação pendente

- build e Preview da Vercel;
- teste com Francis/Master e um vendedor;
- captura real do GPS no iPhone;
- criação de prospecção, retorno na agenda, movimentação no Kanban e conversão controlada.

## EM VALIDAÇÃO — CONFERÊNCIA DO ORÇAMENTO NO CELULAR — 2026-09-16

Branch: `fix/orcamento-rapido-modal-mobile`

- o modal final de `/orcamento-rapido` respeita a altura visível do celular;
- cabeçalho e ações permanecem fixos, enquanto somente a lista de itens rola;
- `Voltar e corrigir` e `Confirmar e enviar` ficam acima da navegação mobile;
- a área segura inferior do iPhone é respeitada;
- nenhuma regra de orçamento, envio ou persistência foi alterada.

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

Auditoria original em `docs/ai-handoff/WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01.md`.
A PR #306 (não mexer) corrigiu a carga histórica travar em dia com erro; ela foi
retomada e está `em_andamento`, avançando com dias problemáticos virando
pendência auditável em vez de travar tudo. Números direto do Supabase em
2026-09-01 (tarde), depois da retomada:
- 664 dias processados (subiu de 626), 13 dias em pendência (`wvetro_base_tecnica_pendencias`);
- composição por tipologia (`wvetro_tipologia_componentes`): 504 linhas (subiu de 97), 264 vinculadas a produto Atlas, 17 tipologias já com alguma composição (de 111 referências, 109 vinculadas à tipologia Atlas);
- 34 tipologias já com imagem (subiu de 12);
- 2 receitas técnicas oficiais já ativas em `engenharia_tipologia_formulas_corte`.

Nova tela de auditoria por tipologia (Master):
`/configuracoes/integracoes/wvetro/base-tecnica/tipologias` (lista com filtros) e
`/configuracoes/integracoes/wvetro/base-tecnica/tipologias/[id]` (detalhe: imagem,
linha/modelo, vínculo Atlas, composição perfil/acessório/vidro com
quantidade/medida/custo/venda/posição/corte/vínculo de produto, variáveis
observadas, status de receita oficial). Só leitura — implementada na PR
`feat/wvetro-explorador-tipologias-v1`, aguardando Preview/merge.

Ainda falta para reproduzir o Orçamento Sob Medida como o W.Vetro: a maioria
das 111 tipologias ainda não tem nenhuma composição (só 17 têm), e a carga
segue em andamento — reauditar quando ela concluir.

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


## 2026-10-01 — Segurança W.Vetro reaplicada sobre a main atual

Branch: `fix/wvetro-seguranca-main-atual`

- importação W.Vetro da Medição Final passou a respeitar o nível real do setor `/producao/medicao-final`;
- usuário `oculto` não acessa nem preview; usuário `consulta` pode visualizar preview, mas não confirmar importação; somente `edicao` e Master podem criar Medição Final;
- rotas administrativas globais de W.Vetro passaram a usar um gate centralizado em `lib/wvetroAcessoServer.ts`;
- o gate exige sessão válida, usuário Master, empresa ativa e slug compatível com `WVETRO_EMPRESA_SLUG` (fallback `esquadrifacio`);
- rotas protegidas: preview, comparador técnico, migração operacional (captura e preview), auditoria, base técnica, linhas, tipologias, detalhe de tipologia, custos, imagens pendentes e reprocessamento;
- nenhuma regra de parser, fórmula, custo, migração ou composição foi alterada;
- validação local aprovada com TypeScript, build completo de 112 páginas e `release:check`.

## 2026-10-04 — Cliente 360: orçamentos W.Vetro sincronizados por cliente

Branch: `feat/cliente360-wvetro-orcamentos-20261004`

- Cliente 360 passou a carregar nos orçamentos os metadados de origem W.Vetro (`modo_entrada`, `wvetro_fluxo`) e os itens necessários para descrição curta.
- A aba **Orçamentos** mostra os orçamentos correntes do Atlas e os sincronizados do W.Vetro na mesma lista, preservando selo de origem.
- Para orçamento W.Vetro, o número principal exibido é o número W.Vetro; quando houver, é mostrada uma descrição curta derivada do orçamento/item.
- Cada orçamento abre a composição técnica existente do Atlas; a futura apresentação comercial Atlas será uma etapa separada.
- Master ganhou **Sincronizar W.Vetro agora**, que força a conferência dos últimos 7 dias e recarrega o Cliente 360. A automação periódica existente continua sendo a fonte normal de atualização.
- O histórico W.Vetro antigo continua separado para consulta e não é confundido com os novos orçamentos operacionais sincronizados.

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]
## 2026-10-04 — Orçamento Atlas V2 sobre sincronização W.Vetro

Branch: `feat/orcamento-atlas-v2-20261004`

- A rota `/orcamento/[id]/composicao` foi transformada na visão geral comercial/técnica do Orçamento Atlas, preservando a origem W.Vetro sem usar o visual do W.Vetro como tela principal.
- O orçamento agora abre em lista compacta por tipologia, com custo, sobra, custo com sobra, venda, margem e flag individual de cobrança de sobra.
- É possível selecionar uma, várias ou todas as tipologias para gerar relatórios parciais; listas de Perfis, Acessórios, Vidros, Lista de corte e Plano de corte respeitam o conjunto selecionado.
- Nova rota `/orcamento/[id]/tipologia/[itemRef]` concentra resumo, componentes, variáveis, lista/plano de corte e atalhos para editar perfis, acessórios, vidros e serviços/despesas da tipologia.
- Nova rota `/orcamento/[id]/plano-corte` apresenta barras, cortes, aproveitamento e sobra, podendo receber `refs` para impressão parcial.
- `/orcamento/[id]/materiais` passou a aceitar `refs` e `filtro` para impressão parcial por tipologia e grupo de material.
- A conferência de custos aceita `itemRef` e filtra os componentes para editar somente a tipologia escolhida.
- Regra automática de sobra introduzida via `configuracoes_gerais`: preto e branco não cobram sobra por padrão; demais cores cobram. A decisão manual por item prevalece.
- O botão de PDF original W.Vetro só é habilitado quando a sincronização tiver recebido uma URL real de PDF no payload; o sistema não inventa um PDF W.Vetro.

## 2026-10-06 — Kanban: vínculo W.Vetro sem perder dados

Branch: `fix/kanban-wvetro-sync-preservacao-v1`

- restaurada a área visível de anexos/versões no modal do orçamento do Kanban;
- adicionado botão **Sincronizar W.Vetro** no próprio card;
- busca os orçamentos dos últimos 7 dias e identifica automaticamente quando existe um único orçamento com o mesmo nome do cliente;
- quando houver mais de um candidato, o usuário escolhe o orçamento correto;
- o vínculo reaproveita o card existente para evitar duplicidade e preserva anexos, fotos, observações, histórico e demais dados manuais;
- se o orçamento W.Vetro já tiver sido importado como outro card, ele é mesclado no card escolhido e o duplicado técnico fica oculto das visões principais;
- a sincronização W.Vetro ganhou comentário/invariante explícita de patch seletivo;
- regra global de preservação funcional registrada em `CLAUDE.md` e `DECISIONS.md`.

Validação técnica pendente nesta branch.

## 2026-10-13 — WVetro: corte de Produção x barras comerciais de Compras

Branch `fix/wvetro-corte-barras-setores-20261013` — preview não publicado em produção sem validação.

- Orçamento #872 (Samuel): PDF real do W.Vetro recuperado de sessão autorizada do usuário, identificado por número, e analisado com texto/colunas por posição. 18 linhas = 31 barras de 6.000 mm; o pacote técnico tem 40 linhas de peças cortadas.
- Banco: `venda_wvetro_barras` (barras comerciais separadas do pacote técnico), `venda_wvetro_barras_aprendizado` (registro de validações/correções), migração aditiva aplicada. Samuel importado com todas as 18 linhas pendentes de validação; nenhuma compra ou corte existente alterado.
- Aba Produção: lista de corte por material, medida, tipologia, PDF por categoria e botão para edição técnica.
- Aba Compras: Kanban independente de barras comerciais por código/tratamento/tipo/comprimento; importação futura de PDF com prévia editável, validação/correção supervisionada, status operacionais e PDF geral ou por card validado.
- Cotação de perfis a partir de cortes bloqueada somente para vendas ligadas ao W.Vetro; fluxo Atlas nativo e cotações já existentes são preservados.
- Correções podem gerar sugestões reutilizáveis no próximo relatório, sem replicar quantidades automaticamente.
- Próximo passo: validar visualmente o preview autenticado; conferir 31 barras, cores, lista de 40 cortes, cards legados, correção/validação e PDF antes do merge.

## 2026-10-13 — Correção de localização da lista (feedback visual do Samuel)

- A aba **Materiais** (não "Editar cortes") mostra a tabela de **Barras Utilizadas do WVetro** destinada à compra, com códigos, acabamentos, quantidades BR, tamanhos, peso/sobra e validação/correção.
- **Produção** mostra a lista de peças cortadas e, ao clicar Editar cortes, expande o editor técnico nessa própria aba; não usa Materiais para exibir 40 cortes.
- **Compras** exibe o Kanban das barras, preservando cotações históricas já movimentadas sem consolidá-las ou reescrevê-las.
- Mudança visual solicitada pelo usuário após testar PR #811; preview original não atendia à posição correta. Validar esta revisão antes de publicar em produção.

## 2026-10-13 — Regra transversal obrigatória de imagens
- Perfis e acessórios nas listas de Materiais, Compras, Produção e PDFs: resolver por cadastro ID/código exato com isolamento de empresa, alternativamente desenho técnico do próprio item WVetro.
- Ausência de foto não pode ser representada por imagem arbitrária; mostrar claramente `Imagem pendente` e exigir completar cadastro, sem apagar registros nem misturar cards.
- Implementação inicial na lista de barras comerciais WVetro, cards de Compras, lista de corte e PDFs de barras/cortes. Demais fluxos usam esta decisão como requisito de aceitação.

## 2026-10-13 — Instalação por tipologia da venda, fase inicial

Branch `fix/instalacao-tipologias-venda-20261013` (preview apenas).
- Caso de validação: cliente `1ffc2956-7b0b-4df4-9557-af0abc0da8ed`, venda `e3ee802a-d65e-413c-9b80-0f3f93f890c0` (#18, orçamento #177). Snapshot vendido tem 1 tipologia, obra_id NULL, nenhuma OP ou checklist preexistente.
- Origem do problema: aba Instalação interrompia em `!obraId` e nem preparava os itens; agora POST autenticado e idempotente usa snapshot vendido e suporta `obra_id` nulo, sem reescrever registros antigos.
- UI Instalação: Kanban por tipologia, foto técnica/croqui quando disponível, dimensões, quantidade instalada, pendência de acabamento/cantoneira/arremate, checklist de 4 etapas e confirmação específica da finalização.
- Fechamento requer checklists, produção, ausência de pendências e obra formalmente vinculada. Progresso de Instalação no resumo reflete unidades efetivamente **finalizadas**, com quantidade instalada fisicamente informada à parte.
- Testes unitários `scripts/test-instalacao-tipologias-vendidas-20261013.cjs` e `scripts/test-venda-instalacao-producao.cjs`, typecheck e build aprovados.
- Pendente: preview autenticado e validação funcional da venda #18, em seguida testar venda com várias tipologias e instalação parcial antes do merge em produção.


## 2026-10-15 — Permissões por etapa — primeiro incremento, não publicar

Branch `feat/permissoes-etapas-20261015`, base inicial `302b0b2f`, atualizado sobre `f891d3a5`. Matriz aditiva do Cliente 360 e leitura filtrada por API; gravação segura Master/tenant com migration candidata ainda não aplicada em produção. Testes de regras/API, regressões e PostgreSQL isolado aprovados. **Revisão geral ainda incompleta:** RLS/RPC de escritas diretas, abas internas de venda, escopos da IA e controles de cada setor permanecem pendentes. Ver `PERMISSOES_ETAPAS_20261015.md`. Não apresentar como autorização completa nem publicar esse pacote sem completar a revisão e homologação.


## 2026-10-16 — Publicação incremental de permissões autorizada

Francis autorizou publicar somente o incremento do Cliente 360 em atlasonesystem.com. Base de produção a1aa8e88; alterações e recebimento integrado preservados. Migration aplicada 20261016042736, com seed igual ao legado, RLS e RPC exclusiva do backend; teste transacional real concluído e desfeito. Histórico prévio restaurado com conteúdo exato, sem reexecutá-lo. Demais etapas de IA/relatórios/ações internas continuam pendentes. Autorização atual substitui o bloqueio de publicação do rascunho inicial para este incremento, sem declarar revisão geral concluída.


## 2026-10-16 — IA e relatório de fornecedores: candidato de segurança

Branch `feat/permissoes-ia-relatorios-20261016`, base `ac03af33`. Sem publicação.
- Especialista e contexto federado bloqueiam consultas se a leitura das restrições de IA falha; escopos desconhecidos são negados, sem ampliar o teto do setor.
- Busca federada com escopo próprio e sem coluna/valor de titularidade retorna vazio antes de consultar a tabela.
- Relatório de fornecedores exige as ações existentes `admin.bi.consultar` no setor Relatórios e `compras.geral.consultar` no setor Compras; Master preservado. Falha de verificação retorna 503 antes de consultar custos.
- Nenhuma migration, permissão real, dado operacional ou tela aprovada alterada. Rollback: reverter este commit; banco permanece igual.
- Testes novos cobrem erro de leitura, escopo inválido, teto, tenant, ausência de titularidade e 401/403/503 antes das consultas do relatório. Regressões Cliente 360/cadastros e cálculo de fornecedores executadas.
- Revisão geral permanece aberta: agentes geral/comercial legados, sessões anteriores, titularidade UUID de clientes/histórico WVetro, totais agregados em escopo próprio, atalhos de estimativa, edição/exportação dos demais relatórios e controles na interface. Este pacote não declara resolvidos esses caminhos.
- Próximo passo: completar esses controles, validar com usuários de consulta/edição, apresentar prévia e somente então publicar o pacote aprovado.

## 2026-10-16 — Conclusão dos controles de IA e relatórios (PR #863)

Pacote ampliado sobre a main atual `57d8edc7`, preservando os incrementos de Kanban por usuário e identificação assistida de Compras. A lista anterior de pendências de IA/relatórios foi tratada: resolvedor único, titularidade por UUID, agregados e histórico limitados, sessões/histórico vinculados à autorização vigente, feedback/conhecimento/aprendizado protegidos, APIs de relatórios com consulta/edição/exportação e editor aditivo no usuário. Ver `PERMISSOES_IA_RELATORIOS_20261016.md` para critérios, limites e validações.

67 verificações comportamentais e regressões do Cliente 360, cadastros, NF, recebimentos, RLS isolado, Kanbans, relatórios/book e fornecedores aprovadas. Nenhuma permissão real ou migration alterada. Typecheck aprovado; preflight final obrigatório antes da integração. A revisão de IA/relatórios está tecnicamente concluída neste pacote; não extrapolar essa afirmação para todos os módulos do ERP. Próximo passo operacional: validar o commit final no CI e publicar no domínio autorizado com snapshot/rollback, sem mudar configurações de acesso reais.


## 2026-10-16 — Hotfix de abertura do Cliente 360

Causa confirmada no banco: compras_necessidades revoga SELECT de authenticated (42501), mas o painel tentava consultar com o token do navegador, bloqueando inclusive Master. A consulta legada passa pelo servidor após validar o cliente com RLS, reutiliza obterComprasAcessos.consultar e filtra empresa_id + cliente_id. Nenhuma concessão de banco, mudança de permissões ou alteração dos novos pedidos de Compras. Regressões cobrem tabela privada, isolamento, cliente inacessível, solicitante próprio e falha fechada. Validar release e publicar o commit exato; confirmar abertura autenticada do cliente informado.


## 2026-10-16 — Conferência W.Vetro por esquadria — candidata a prévia

Branch feat/wvetro-validacao-por-item-20261016. Cada esquadria importada no Kanban tem Está certo, Corrigir e ensinar, status próprio e consulta de correções anteriores por modelo + linha. Ambiente, tipo, medidas, quantidade e demais campos conferidos usam diferenças por campo; descrição livre é aceita quando não há tipologia cadastrada. Correções de um item preservam rascunhos dos demais, fotos, anexos, valores e payload bruto. Snapshot invalida conferência após mudança; comparação CAS impede sobrescrever edição concorrente. Autorização usa permissão de edição de orçamento + domínio IA e escopo próprio; feedback filtrado por empresa e usuário quando próprio. Importação forçada com payload idêntico preserva IDs e correções por item. Materialização técnica existente somente após todos conferidos; receitas antigas não são homologadas por troca de nome. Sem migration. Prévia separada para homologação; não publicar em produção sem aprovação desta alteração.
