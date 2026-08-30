# IMPLEMENTATIONS.md — Atlas One

## 2026-08-30 — Entrada unificada pelo Cliente 360

- criada a porta `Novo orçamento` para buscar o cliente antes de escolher a operação;
- cliente localizado abre diretamente a ficha Cliente 360; cliente inexistente recebe cadastro mínimo de nome e sobrenome;
- a ficha Cliente 360 concentra atalhos para orçamento sob medida, venda balcão e assistência/manutenção;
- atalhos globais de orçamento agora passam pela identificação do cliente;
- orçamento sob medida só persiste após vínculo válido ao Cliente 360;
- venda balcão passou a exigir cliente identificado e telefone ou WhatsApp, inclusive na API;
- venda sob medida preserva os campos completos configuráveis na confirmação da venda;
- sem nova migration: reutiliza `clientes`, `orcamentos`, vínculo `cliente_id` e configuração `campos_formularios_v1` existentes.

### Obras e locais no Cliente 360

- adicionada a central de obras/locais dentro da ficha do cliente, permitindo várias obras para o mesmo cadastro;
- cada obra tem tom visual por etapa e atalhos próprios para orçamento sob medida e assistência;
- orçamento sob medida ganhou seletor de obra e cadastro rápido de obra, com persistência em `orcamentos.obra_id`;
- assistência ganhou seletor de obra, com persistência em `assistencias.obra_id` e no card espelho em `orcamentos.obra_id`;
- os serviços validam no servidor que a obra selecionada pertence ao mesmo Cliente 360;
- Home e Kanban de Assistências passam a chamar primeiro a identificação do cliente; as decisões operacionais ficam na ficha Cliente 360;
- reutilizada a estrutura existente `obras` e os vínculos `obra_id`, sem migration adicional.

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

## 2026-08-26 — Balcão fora do Kanban + data fixa de entrada

### Isolamento operacional do balcão
- confirmada a causa do card indevido: `lib/orcamentoBalcao.ts` gravava o orçamento rápido na tabela geral `orcamentos`, que alimenta o Kanban;
- apenas remover `coluna_id` não resolveria, porque o Kanban legado trata orçamento sem coluna como pertencente à primeira coluna;
- criada a tabela transacional `balcao_orcamentos` no mesmo Supabase do Atlas, mantendo `clientes`, produtos, preços, estoque, compras e financeiro compartilhados;
- `lib/orcamentoBalcao.ts` passou a salvar orçamento rápido de balcão em `balcao_orcamentos`;
- `/api/balcao/orcamentos` passou a consultar a tabela própria;
- registros históricos com `modo_entrada='balcao'` foram migrados para a tabela própria e removidos de `orcamentos`;
- regra consolidada: Venda/Orçamento Balcão rápido não alimenta Kanban; orçamento sob medida/obra continua usando o fluxo comercial normal.

### Data de entrada no Kanban
- adicionada `orcamentos.kanban_entrada_em timestamptz`;
- feito backfill dos cards existentes usando a melhor data histórica disponível (`coluna_atualizada_em`/`created_at`);
- criado trigger para preencher automaticamente a data de entrada em novos cards não-balcão;
- a data é imutável durante movimentações: `kanban_entrada_em` representa entrada no painel e `coluna_atualizada_em` continua representando movimentação/SLA;
- `/kanban` exibe `📅 Entrada: DD/MM/AAAA` dentro do card, abaixo da descrição da esquadria e antes de criador/valor, conforme validação visual solicitada;
- o campo de calendário foi identificado como filtro da data de entrada;
- wrapper do Kanban mantém compatibilidade com as melhorias existentes de W.Vetro/PDF e atualiza a data após mudanças visuais dos cards.

### Banco e segurança
- migrations aplicadas e versionadas:
  - `20260826135831_kanban_data_entrada_v1.sql`;
  - `20260826140437_balcao_orcamentos_separado_v1.sql`;
  - `20260826140909_kanban_data_entrada_search_path_v1.sql`;
- `balcao_orcamentos` recebeu RLS/policies e grants compatíveis com o padrão atual do cliente Atlas;
- `definir_kanban_entrada_em()` recebeu `search_path=public` após advisor apontar o warning;
- validação final do banco: **49 cards do Kanban, 49 com data de entrada e 0 registros de balcão em `orcamentos`**.

---

## 2026-08-25 — Filtros do catálogo do Orçamento Balcão

- conferida a rota `/balcao/orcamentos/novo`, que reutiliza `app/orcamento/balcao/novo/page.tsx`;
- preservada a faixa de categorias do catálogo: Todas, Produto, Acessório, Perfil, Produto pronto, PU e Outro;
- adicionada a categoria comercial **Vidro** em `CATEGORIAS_PRODUTO_PRINCIPAIS`, posicionada entre Perfil e Produto pronto;
- o segundo nível por Linha continua baseado em `linhas_tecnicas` + `linha_produtos` e é compatível com Acessórios e Perfis;
- base atual verificada: 1.174 acessórios vinculados a 36 linhas e 1.307 perfis vinculados a 53 linhas;
- atualmente não há produtos comerciais com `categoria='vidro'`;
- as 14 referências de vidro do W.Vetro permanecem apenas como referência técnica: não foram convertidas automaticamente em produto, custo, preço, margem, unidade ou estoque;
- preview Vercel da branch compilou como `READY`.

---

## 2026-08-25 — Busca Padrão Atlas V1 — PR #277

### Núcleo compartilhado
- criado `lib/buscaAtlas.ts` como regra comum de pesquisa operacional;
- criado `components/system/BuscaAtlasInput.tsx` como campo reutilizável;
- pesquisa ignora maiúsculas/minúsculas e acentos;
- aceita várias palavras em qualquer ordem e permite que cada termo seja encontrado em um campo diferente;
- CPF/CNPJ e telefones podem ser localizados mesmo quando a consulta não contém a pontuação do cadastro;
- filtros específicos continuam combináveis com a pesquisa geral.

### Clientes e atendimento
- `/clientes` passou a pesquisar nome, apelido, CPF/CNPJ, WhatsApp, telefone, e-mail, cidade, bairro, endereço, CEP, observações, responsável e origem;
- adicionados filtros específicos por cidade, bairro, CPF/CNPJ, telefone/WhatsApp e apelido;
- `/assistencia` usa o mesmo padrão ao selecionar cliente existente e preserva o vínculo ao `clientes.id`;
- seleção de cliente na assistência preenche os dados já cadastrados sem criar cadastro paralelo.

### Venda e Orçamento Balcão
- `/orcamento/balcao/novo` ganhou fluxo em cascata `Categoria → Linha → Pesquisa`;
- produto pode ser localizado por código, código de origem, nome, descrição, categoria, grupo, marca, NCM e dados da linha associada;
- busca de cliente considera nome, apelido, CPF/CNPJ, WhatsApp, telefone, e-mail, cidade, bairro, endereço e CEP;
- ao escolher cliente existente, o orçamento mantém o mesmo `clientes.id`, evitando duplicidade;
- `lib/orcamentoBalcao.ts` aceita `clienteId` existente e só cria/resolve cliente quando nenhum cadastro foi selecionado;
- API compartilhada `/api/balcao/catalogo` ampliou a busca de clientes para os mesmos campos, preservando o estoque multiunidade e as regras de preço da Venda Balcão.

### Cadastros, estoque e compras
- pesquisa padronizada em Produtos, Linhas, Produtos por Linha, Precificação, Unidades Pendentes, Materiais e Fornecedores;
- Estoque da Rede pesquisa produto, código, unidade, local e endereço;
- Endereçamento pesquisa produto/código, loja/unidade, local e endereço;
- Transferências pesquisam produtos disponíveis na origem e o histórico por número, status, origem, destino, motivo e produtos;
- Histórico de NFs usa a regra compartilhada para NF, fornecedor, CNPJ e arquivo;
- Vínculos de Compra receberam pesquisa dos itens pendentes e uma pesquisa real do catálogo Atlas antes de confirmar o vínculo;
- Pesquisa e Histórico de Orçamentos usam o mesmo comportamento sem remover filtros existentes de número, data ou status;
- Central de Cadastros usa a mesma normalização.

### Preservação das regras existentes
- nenhuma migration nova foi necessária nesta implementação;
- `clientes.apelido` e `clientes.bairro` já existiam no banco e foram apenas integrados às buscas/fluxos;
- nenhuma regra de custo, margem, preço mínimo, estoque, reserva, caixa ou financeiro foi alterada;
- vínculo de NF continua sem alterar custo nessa tela;
- W.Vetro continua apenas como referência/origem e não ganhou precedência sobre dados Atlas validados;
- previews sucessivos da branch foram compilados como `READY` na Vercel durante a implementação.

---

## 2026-08-25 — Busca incremental de clientes da Venda Balcão — PR #276

- corrigida a busca de cliente na tela principal `/balcao`;
- busca considera nome, CPF/CNPJ, telefone, WhatsApp e cidade;
- comparação server-side normaliza acentos, então `JOAO` encontra registros cadastrados como `João`;
- documentos e telefones também são comparados sem pontuação;
- campo de cliente usa `onInput` e `onCompositionUpdate` para receber a digitação durante composição do teclado;
- debounce reduzido de 300 ms para 70 ms;
- requisição anterior é abortada e respostas fora de ordem são descartadas;
- indicador de carregamento aparece no próprio campo;
- campo de produto da tela principal também passa a usar captura nativa;
- clientes continuam vindo da tabela compartilhada `clientes`; nenhum cadastro paralelo foi criado.

---

## 2026-08-25 — Modo Venda Balcão integrado ao Atlas

- consolidada a decisão de manter **um único Atlas One**, com o PDV como modo operacional e não como sistema/banco separado;
- `BalcaoShell` passa a identificar explicitamente `Modo Venda Balcão`;
- adicionado botão `Voltar ao Atlas`, retornando ao ERP completo pela rota `/`;
- menu móvel também recebe acesso direto `Atlas`;
- adicionada seção `Gestão compartilhada` no menu do balcão, apontando para as telas existentes do Atlas:
  - Clientes (`/clientes`);
  - Produtos / Cadastros (`/cadastros`);
  - Estoque (`/estoque`);
  - Compras / NF (`/compras`);
- esses acessos usam os mesmos produtos, clientes, unidades, estoque, compras e financeiro já existentes; não foi criado dado duplicado;
- fiscal/NFC-e/NF-e continua evolução posterior, após definição do provedor e das regras fiscais.

---

## 2026-08-23 — PR #260 — Orçamento visual + variáveis W.Vetro

### Seleção visual de tipologias
- criado `SeletorEsquadriaInteligenteV2.tsx` e ativado por compatibilidade pelo componente existente;
- tipologias da Linha passam a aparecer em cards visuais;
- mantido select textual como fallback/lista rápida;
- adicionados busca, filtros de status/origem/imagem e ordenação por prioridade técnica;
- cards exibem status Atlas/W.Vetro, número de configurações validadas, ocorrência histórica e origem da imagem;
- precedência de imagem: Atlas tipologia → configuração/produto Atlas → W.Vetro → placeholder;
- lightbox para ampliar imagem sem depender de hover.

### Referência segura de variáveis
- criada tabela `wvetro_referencias_variaveis` com RLS fechado para cliente e operação server-side;
- migrations:
  - `20260824022150_wvetro_variaveis_orcamento_v1`;
  - `20260824022234_wvetro_variaveis_folhas_normalizacao_v1`;
- função `fn_wvetro_reconstruir_variaveis_explicitas()` extrai apenas fatos escritos explicitamente no Modelo W.Vetro;
- nenhum fuzzy/inferência livre é promovido automaticamente;
- base histórica atual gerou 57 referências explícitas de número de folhas, normalizadas de 1 a 8;
- catálogo global de opção `folhas` passou a representar 1..8 quando esses valores apareceram explicitamente na origem, sem validar receitas.

### Configurar variáveis
- criado endpoint autenticado `/api/orcamento/wvetro-referencias` para expor somente referências seguras;
- UI unifica variáveis Atlas e referências W.Vetro;
- valor Atlas existente nunca é sobrescrito pela referência;
- W.Vetro preenche somente valor ainda vazio ao abrir modo assistido;
- selo distingue `ATLAS`, `WVETRO REFERÊNCIA` e valor `AJUSTADA`;
- evidência de origem fica visível;
- ausência de dado permanece `A definir`.

### Procedência do orçamento
- `lib/orcamentos.ts` passa a guardar no snapshot de cada item a referência W.Vetro realmente utilizada;
- snapshot inclui Linha/Modelo, IDs, variáveis usadas, valor bruto, origem e evidência;
- referência só é marcada `utilizada_como_base` se não houver configuração Atlas validada e algum valor W.Vetro tiver sido efetivamente usado;
- falha ao obter metadados de procedência não bloqueia criação do orçamento.

### Auditoria
- após cada lote histórico da auditoria W.Vetro e ao finalizar, referências explícitas são reconstruídas;
- futuras imagens/modelos encontrados pela auditoria passam a alimentar o mesmo fluxo visual, sem sobrescrever conhecimento Atlas validado.

### Validação
- banco aplicado com sucesso;
- PR #260 aberta aguardando Build Validation + preview Vercel antes de merge.

---

## 2026-08-23 — PR #258 — Auditoria completa W.Vetro → Atlas

Implementada a camada de referência completa W.Vetro sem substituir o conhecimento técnico validado no Atlas.

### Banco / proveniência
- formalizada a origem W.Vetro das 109 tipologias históricas extraídas de 1.038 vendas/orçamentos;
- criada referência auditável de linhas, tipologias, componentes, vidros e snapshots de produto da API;
- eliminada a lacuna de vínculo Linha↔Tipologia: 46/109 antes → 109/109 depois;
- após a migration: 60 linhas técnicas, 29 ativas, 55 exclusivamente W.Vetro e 4 mistas Atlas+W.Vetro;
- 64 valores brutos de Linha preservados no staging;
- catálogos conhecidos preservados: 1.307 perfis e 1.174 acessórios W.Vetro;
- migrations aplicadas e alinhadas ao histórico remoto:
  - `20260824012830_wvetro_referencia_completa_v1`;
  - `20260824012851_wvetro_staging_tipologias_componentes_v1`;
  - `20260824012908_wvetro_snapshots_api_v1`;
  - `20260824012923_wvetro_imagens_snapshot_v1`;
  - `20260824014055_wvetro_referencias_indices_v1`;
- cinco FKs novas da camada W.Vetro apontadas pelo advisor de desempenho foram indexadas pela última migration.

### Auditoria viva
- criada tela Master `/configuracoes/integracoes/wvetro/auditoria`;
- consulta linhas da API, pedidos/orçamentos em lotes de até 90 dias, produtos por código, componentes, vidros e imagens;
- tenta descobrir catálogo completo de Perfis/Acessórios; item novo entra apenas como referência importada, sem custo/margem/unidade operacional inventados;
- snapshots preservam payload, LinhaId/LinhaNome, NCM/unidade de origem e URL;
- imagens podem ser copiadas para o bucket `fotos`, sem sobrescrever foto Atlas existente;
- vínculo produto↔linha somente por campo explícito/igualdade exata; fuzzy continua proibido.

### Orçamento
- seletor de tipologia passou a mostrar procedência/estado técnico:
  - `REFERÊNCIA WVETRO`;
  - `WVETRO · EM VALIDAÇÃO ATLAS`;
  - `WVETRO · VALIDADA ATLAS`;
  - `VALIDADA ATLAS`;
  - `CADASTRADA ATLAS`.
- fórmulas/configurações Atlas validadas mantêm prioridade absoluta sobre a referência W.Vetro.

### Segurança / validação
- tabelas novas com RLS e acesso operacional server-side/service-role;
- advisor de segurança não apontou ERROR novo específico da camada W.Vetro;
- nenhuma atualização automática de custo/preço/unidade operacional foi adicionada;
- execução viva final da API permanece para ser disparada por usuário Master autenticado.

Relatório: `docs/tecnico/auditoria-wvetro-completa-2026-08-23.md`.

## Implementações imediatamente anteriores

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão.
- PR #257: estoque multiunidade, endereçamento, reservas e transferências.
- PR #256: Venda Balcão multiunidade, caixas, estoque da rede e atendimento de vendas reservadas.

Para o histórico cronológico completo anterior a este checkpoint, consultar o arquivo de archive indicado no topo.
