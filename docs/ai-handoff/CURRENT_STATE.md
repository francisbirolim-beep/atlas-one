# CURRENT_STATE.md — Atlas One

> Checkpoint anterior preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-CURRENT_STATE.md`.

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
- preservadas rotas, permissões, busca, regras operacionais e comportamento mobile.

### Validação concluída

- build local completo aprovado, incluindo TypeScript e geração das 90 rotas;
- nenhuma migration e nenhuma alteração de banco.

### Conferência funcional pendente

- validar visualmente a Home no desktop e no celular;
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

## INTEGRADO NA MAIN — BALCÃO FORA DO KANBAN + DATA DE ENTRADA — PR #279

Branch: `fix/balcao-fora-kanban`

### Regra operacional consolidada

- **Venda Balcão e Orçamento Balcão rápido não entram no Kanban de orçamentos/obras**;
- o Kanban fica reservado para orçamento sob medida/obra e demais fluxos operacionais que realmente precisam percorrer etapas;
- balcão continua compartilhando clientes, produtos, preços, estoque, compras e financeiro com o mesmo Atlas/Supabase, sem duplicar os cadastros mestres;
- os orçamentos rápidos de balcão agora são persistidos em `balcao_orcamentos`, tabela transacional própria, e não em `orcamentos`, que é a fonte do Kanban.

### Data fixa de entrada no Kanban

- criada `orcamentos.kanban_entrada_em`;
- trigger `trg_definir_kanban_entrada_em` preenche a data automaticamente para registros não-balcão;
- a data não muda ao arrastar o card entre colunas; `coluna_atualizada_em` continua registrando a movimentação/SLA separadamente;
- os cards exibem `📅 Entrada: DD/MM/AAAA` entre a descrição da esquadria e os demais dados do card;
- o campo de calendário do Kanban é identificado como filtro da **data de entrada no Kanban**;
- backfill validado no banco: 49 cards de Kanban e 49 com `kanban_entrada_em` preenchido;
- validação do isolamento: 0 registros `modo_entrada='balcao'` permanecem em `orcamentos`.

### Banco / migrations

- `20260826135831_kanban_data_entrada_v1.sql`;
- `20260826140437_balcao_orcamentos_separado_v1.sql`;
- `20260826140909_kanban_data_entrada_search_path_v1.sql`;
- `balcao_orcamentos` possui RLS e policies compatíveis com o padrão operacional atual do Atlas;
- advisor de segurança não apontou problema novo da tabela; o warning de `search_path` da função nova foi corrigido.

### Validação técnica concluída

- PR #279 mesclado na `main` em 2026-08-26;
- deploy Vercel do merge confirmado com status `success`;
- base reconferida em 2026-08-28: 49/49 cards com `kanban_entrada_em` e 0 registro de balcão em `orcamentos`.

### Conferência funcional recomendada em produção

- abrir `/kanban` e confirmar visualmente a data na posição combinada;
- mover um card de coluna e confirmar que `Entrada` permanece a mesma;
- filtrar pelo calendário e confirmar o dia de entrada;
- criar um Orçamento Balcão e confirmar que aparece apenas em `/balcao/orcamentos`, nunca no `/kanban`.

## EM VALIDAÇÃO — FILTROS DO CATÁLOGO DO ORÇAMENTO BALCÃO — 2026-08-25

Branch: `fix/balcao-filtros-catalogo-v2`

Objetivo: preservar o filtro visual do catálogo do Orçamento Balcão e adicionar **Vidro** como categoria comercial explícita, sem transformar referência técnica W.Vetro em preço/estoque automaticamente.

### Estado confirmado no código e na base

- `/balcao/orcamentos/novo` reutiliza `app/orcamento/balcao/novo/page.tsx`;
- a tela mantém a faixa visual `Todas | Produto | Acessório | Perfil | Vidro | Produto pronto | PU | Outro`;
- ao escolher uma categoria, a lista de produtos é filtrada por `produtos.categoria`;
- a tela já possui segundo nível de filtro por Linha através de `linha_produtos`/`linhas_tecnicas`;
- base atual confirmada: 1.174 acessórios vinculados a 36 linhas e 1.307 perfis vinculados a 53 linhas;
- `Vidro` foi adicionado a `CATEGORIAS_PRODUTO_PRINCIPAIS` e passa a ser categoria oficial do catálogo comercial;
- no momento não existem produtos comerciais com `categoria='vidro'`; as 14 referências de vidro do W.Vetro permanecem apenas como referência técnica até cadastro/validação comercial real;
- nenhum preço, custo, estoque, unidade ou margem de vidro foi criado automaticamente.

### Validação

- preview Vercel do commit inicial da branch compilou como `READY`;
- validar visualmente em `/balcao/orcamentos/novo` após produção:
  - faixa de categorias visível;
  - botão `Vidro` entre `Perfil` e `Produto pronto`;
  - selecionar `Acessório` e confirmar as linhas vinculadas;
  - selecionar `Perfil` e confirmar as linhas vinculadas;
  - selecionar uma Linha e confirmar o refinamento da lista;
  - busca textual deve continuar combinando com Categoria + Linha.

## BUSCA PADRÃO ATLAS V1 — INTEGRADA NA MAIN — PR #277

Objetivo: substituir buscas isoladas/inconsistentes por um comportamento operacional único, sem criar base paralela e sem alterar as regras técnicas/comerciais dos módulos.

### Regra oficial de busca

Criados `lib/buscaAtlas.ts` e `components/system/BuscaAtlasInput.tsx`.

O padrão V1:
- ignora diferença entre maiúsculas/minúsculas;
- ignora acentos (`JOAO` encontra `João`);
- aceita várias palavras em qualquer ordem;
- cada palavra pode existir em um campo diferente do cadastro;
- CPF/CNPJ/telefone podem ser pesquisados sem a pontuação usada no cadastro;
- filtros específicos podem ser combinados com a pesquisa geral.

### Fluxos padronizados

- Clientes: nome, apelido, CPF/CNPJ, WhatsApp, telefone, e-mail, cidade, bairro, endereço, CEP, observação, responsável e origem; filtros específicos de cidade, bairro, CPF/CNPJ, telefone e apelido.
- Orçamento Balcão: `Categoria → Linha → Pesquisa`; produto por código, código de origem, nome, descrição, categoria, grupo, marca, NCM e dados das linhas; seleção do cliente cadastrado sem duplicar `clientes.id`.
- Venda Balcão: a API compartilhada do catálogo reconhece também apelido, e-mail, bairro, endereço e CEP do cliente; pesquisa de produtos continua integrada ao estoque da rede.
- Assistência: seleção de cliente usa o mesmo critério amplo do Atlas e preenche cidade/endereço/bairro/telefone do cadastro escolhido.
- Produtos: pesquisa geral combinada aos filtros de categoria e linha.
- Linhas técnicas e catálogo por linha: busca por nome, fabricante, descrição, apelidos, produtos e tipologias associados.
- Precificação e unidades pendentes: busca de produto usando o padrão Atlas.
- Fornecedores e Materiais: pesquisa ampla pelos dados exibidos/cadastrados.
- Estoque: pesquisa por produto/código/unidade/local/endereço.
- Endereçamento: pesquisa por produto, unidade, local e endereço.
- Transferências: busca de produtos na origem e pesquisa do histórico por nº, status, origem, destino, motivo e produtos.
- Compras/NFs: histórico de notas por NF, fornecedor, CNPJ e arquivo.
- Vínculos de compra: pesquisa dos itens pendentes e pesquisa real do produto Atlas antes do vínculo.
- Pesquisa/Histórico de Orçamentos: busca ampliada preservando filtros de número/data/status.
- Central de Cadastros: usa o mesmo mecanismo de normalização.

### Segurança funcional

- nenhuma migration nova foi necessária;
- `clientes.apelido` e `clientes.bairro` já existiam e foram reutilizados;
- cliente selecionado em Venda/Orçamento/Assistência continua apontando para o mesmo cadastro compartilhado;
- regras de preço, margem, estoque, reserva, caixa, vínculo de NF e precedência técnica Atlas/W.Vetro não foram alteradas.

## MODO VENDA BALCÃO INTEGRADO AO ATLAS — 2026-08-25

Decisão consolidada: **Venda Balcão é um modo operacional do Atlas One, não um sistema separado**.

Estado integrado:
- `components/system/BalcaoShell.tsx` identifica explicitamente `Modo Venda Balcão`;
- botão `Voltar ao Atlas` retorna ao ERP completo (`/`);
- no mobile existe acesso direto `Atlas` no cabeçalho do balcão;
- menu do balcão continua focado em Venda, Orçamento, Consulta, Atendimentos, Histórico, Caixa, Contas a Receber e Relatórios;
- seção `Gestão compartilhada` aponta para Clientes, Cadastros, Estoque e Compras do próprio Atlas;
- nenhum cadastro mestre/banco/estoque foi duplicado; tabelas transacionais próprias do PDV podem existir dentro do mesmo banco quando o fluxo exige isolamento operacional;
- fiscal/NFC-e/NF-e permanece evolução posterior, dependente de provedor e regras fiscais.

## Base já integrada na `main`

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão;
- PR #257: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento reservado;
- PR #258: auditoria completa W.Vetro integrada na `main`;
- PR #271: cancelamento/devolução transacional da Venda Balcão;
- PR #272: busca combinada + layout compacto do balcão;
- PR #273: busca incremental;
- PR #274: captura nativa de digitação na Consulta de preço;
- PR #275: Modo Venda Balcão integrado ao mesmo Atlas;
- PR #276: busca incremental de clientes na Venda Balcão;
- PR #277: Busca Padrão Atlas V1 em clientes, balcão, cadastros, estoque, compras e orçamentos.

### Referência W.Vetro disponível

- 1.307 perfis W.Vetro preservados;
- 1.174 acessórios W.Vetro;
- 111 tipologias de referência, 109 mapeadas;
- 119 linhas de referência;
- 1.529 códigos de perfil observados no histórico;
- 1.294 códigos de acessório observados no histórico;
- 14 vidros referência;
- 2.481 produtos consultados na API;
- 1.287 imagens copiadas para o Atlas;
- configuração/fórmula/receita validada Atlas sempre tem prioridade sobre W.Vetro.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- Venda Balcão e Atlas completo compartilham a mesma base e os mesmos cadastros mestres; não duplicar clientes/produtos/estoque.
- Orçamento/Venda Balcão não alimenta o Kanban; somente orçamento sob medida/obra entra nesse fluxo.
- `kanban_entrada_em` é a data fixa de entrada do card; `coluna_atualizada_em` continua sendo data de movimentação/SLA.
- Busca operacional deve seguir o padrão Atlas V1 sempre que a tela pesquisar cadastros/listagens.
- W.Vetro é referência/origem; Atlas validado é a versão técnica oficial.
- Nunca sobrescrever automaticamente fórmula, receita, custo, preço, margem ou unidade operacional Atlas com valor histórico W.Vetro.
- Variável inferida sem regra Atlas validada deve permanecer `A definir`.
- Associação externa automática somente por identidade segura/exata; sem fuzzy.
- Imagem W.Vetro nunca substitui automaticamente imagem Atlas existente.
- `produtos.unidade` é unidade operacional; `unidade_origem`/`qtde_embalagem_origem` são proveniência.
- Tipologia = custo técnico. Venda Balcão = preço comercial próprio.
- Hardening legado da Engenharia continua tarefa separada; não habilitar RLS às cegas.
