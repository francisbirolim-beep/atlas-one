## 2026-10-24/25 — Prévia do Kanban Geral e planejamento de instalação (somente branch isolada)

- Rotas React com oito colunas, modo TV, painel lateral e pedidos separados sem duplicar projeto; leitura de vendas, compras, produto/imagem, ordens e instalação por API autenticada Master.
- Relatório de capacidade: calendário, metas financeiras, gráfico, simulação e RPCs de agendamento/alteração de metas auditadas e Master-only.
- Migrações aditivas 20261025030000 e 20261025031500 geradas mas NÃO aplicadas em qualquer banco. HTML local sem credenciais em http://localhost:4017/atlas-visao-geral-preview.html.
- Testes scripts/test-visao-geral-etapas.cjs e scripts/test-instalacao-capacidade.cjs passam, TypeScript passa; ainda há validação com banco isolado e usuário antes de qualquer publicação.

## 2026-10-24 — Visão Geral de Projetos: regras e Kanban configurável (isolado)

- Definidas etapas semânticas de venda a encerramento, agrupadas em seis colunas editáveis e sem modificar os sistemas operacionais.
- Implementado lib/visaoGeralProjetos.ts com projeção de fase, validação de configuração, transferência de critérios ao excluir, prazo em dias corridos por coluna e alertas com falta de prazo explícita.
- Validação local com testes, TypeScript e release:check concluída usando somente configuração fictícia de build, sem banco real.
- Adicionados documento docs/visao-geral-projetos-v1.md e regressões scripts/test-visao-geral-etapas.cjs. Somente protótipo de domínio: sem UI, migration, escrita em banco, PR ou deploy.

## 2026-10-22 — CMV compra/correção com fornecedor oficial

- Integração incremental de `FornecedorCmvCampo` em `components/clientes/VendaCmvPainel.tsx`: duas entradas, `Adicionar compra` e `Corrigir lançamento existente`. Não muda APIs, payload de CMV, valores, documentos, anexos ou histórico.
- Melhoria da edição de fornecedor: identifica nomes antigos, IDs distintos de campos e modal de cadastro sem submit acidental da compra.
- Adicionado `scripts/test-cmv-fornecedor-cadastro.cjs` com testes estruturais para garantir integração nas telas corretas, preservação do legado, permissões e proteção contra duplo envio.

## 2026-10-22 — CMV: campo de fornecedor com cadastro completo (prévia isolada)

- Adicionado `components/clientes/FornecedorCmvCampo.tsx`: autocomplete reutilizando Fornecedores, seleção por nome, pesquisa por documento e cidade, modal com cadastro completo, validação dos obrigatórios, permissão e prevenção de CPF/CNPJ duplicado.
- Integrado somente a `VendaCmvRecebimentos.tsx`, preservando todo o formulário, anexos, cálculo de custo e bloqueios de confirmação. Gravação do fornecedor novo usa a função existente `criarFornecedor`; não há gravação automática de recebimento ou custo.
- Não houve alteração em produção, banco, rotas de API ou compra. TypeScript e testes locais CMV aprovados. Build completo requer configuração de ambiente isolado.

## 2026-10-19 — Recebimento parcial e permissões (PRÉVIA, não publicado)

- Branch isolada `feat/financeiro-recebimento-parcial-preview-20261019` baseada na prévia do PR #902. Correção do erro mostrado ao registrar recebimento no Cliente 360 (`permission denied for table financeiro_contas_receber`), sem abrir permissão direta no banco.
- GET/POST autenticados em `/api/financeiro/cliente-recebimento` com usuário, setor/permissão de consulta ou baixa, `empresa_id`, `cliente_id`, validação das parcelas/valores e guarda contra pagamento acima do saldo; POST usa o RPC existente via backend em produção.
- GET `/api/financeiro/contas-receber` para a visão geral sem SELECT direto do browser, com escopo do tenant e relatório preservado.
- Interface: `Receber tudo` ou `Receber parcial`, saldo projetado por parcela e total antes de confirmar; parcial permanece em aberto após a baixa. Em preview, confirmação é simulação, NÃO cria recebimento real nem altera saldo.
- Recibos A4: simulação destacada como não comprovante, com valor recebido e saldo projetado por obra; após recebimento real, links separados por obra, com filtro autorizado em `/api/financeiro/recibo?obraId=...`.
- Contas a Pagar e demais fluxos intocados. Nenhuma migração, nenhuma modificação no Supabase de produção. Publicação apenas após teste na prévia e aprovação explícita.

## 2026-10-19 — Financeiro manual + relatórios + recibos (PRÉVIA NÃO publicada)

- Branch isolada `feat/financeiro-manual-preview-20261019`, base da `main` em 19/10 (`d790db6`, sincronizar antes de publicar). Não houve alteração de dados, migrações ou implantação em produção.
- Mantém os fluxos existentes de compra, recebimento, contas a pagar/receber e DRE; adiciona formulário manual parcelado nas duas telas, com fornecedor/cliente obrigatório, cadastro rápido, vínculo opcional à compra e à obra, categoria gerencial DRE para títulos a pagar.
- GET /api/financeiro/lancamentos-manuais com escopo de empresa e permissões; POST cadastra novos e títulos, verifica cliente/fornecedor/obra/compra no tenant, distribui centavos por parcela e usa IDs determinísticos por lote; verifica boletos duplicados e compras já tituladas. Registra categorias em `financeiro_plano_contas` e classificações em `financeiro_conta_classificacoes`; títulos automáticos existentes podem ser classificados manualmente.
- **Segurança de prévia:** `process.env.VERCEL_ENV === 'preview'` bloqueia TODOS os POSTs. Formulário em URL *.vercel.app simula criação, informa que nenhum cadastro ou título foi salvo. Ambiente de produção NÃO alterado e não será publicado sem aprovação explícita.
- Os filtros usam vencimento inclusivo como padrão, com hoje/semana/mês/próximo mês/período custom, cliente/fornecedor, obra, situação e opção data efetiva; relatórios imprimíveis A4 horizontal (salvar PDF) e CSV para Excel; agrupamento e subtotais.
- Recibos por pagamento e recebimento consultados com JWT e autorização, apenas pagamento confirmado e recebimento não cancelado. Exibem o valor recebido, saldo atual e aviso quando quitação parcial; recibo de cliente usa obra vinculada, ou dados consolidados apenas do escopo alocado sem misturar obras independentes. Formato imprimível com assinatura.
- Não foi criada geração/upload de boleto bancário, PIX automático, sincronização bancária ou cálculo de saldo histórico na data da baixa; relatório/recibo apresenta posição **atual** do título. Anexos e fluxo DRE por competência podem ser etapas posteriores.
- Testar envio e filtro simulados, permissões, múltiplas obras, prévia de recibo e regressões antes de eventual publicação; realizar backup e rollback da versão atual. **Não publicar sem aprovação.**

## 2026-10-17 — Kanban Comercial: endereço por obra e GPS (prévia isolada, NÃO publicada)

- Branch separada `feat/kanban-localizacao-obra-20261017`, base `5e62cf3` da produção de 17/10/2026. Sem mudanças no banco nem nos módulos de movimentação do Kanban.
- Os pedidos do dia de **TIAGO GARCIA** e **REGINALDO ROSSINI** têm obra vinculada, endereço e coordenadas gravados. Ambos possuem GPS sem marcador de confirmação formal; Tiago tem bairro gravado e Reginaldo não. Consulta de diagnóstico somente leitura.
- O Kanban Comercial lê as obras vinculadas por `obra_id` em lote. Mostra nome da obra e endereço no card e no cabeçalho do orçamento; link de rota usa coordenadas da obra ou endereço. Não usa endereço pessoal do cliente e não mistura obras distintas.
- Quando o bairro está ausente e há GPS, botão de consulta Nominatim; somente salva sugestão após confirmação explícita, e apenas se `bairro IS NULL`, vinculada ao mesmo cliente. Falha da API não impede abrir orçamento.
- Geocodificação reversa prioriza bairro e amplia campos de localização (subdivisões mapeadas); número somente quando presente na base cartográfica, sem inventar faixas. Captura GPS informa precisão aproximada em metros e alerta sinal maior que 30 m; mantém rascunho/offline.
- Escopo é complemento visual/consulta e edição opcional de bairro em obra; regressões obrigatórias para Kanban/W.Vetro e orçamento. Antes de publicar, homologar a prévia e receber autorização explícita.

## 2026-10-17 — Pedido de Orçamento: obra/endereço OU GPS obrigatório (isolada, sem deploy)

- Captura GPS existente preservada e ampliada com coordenadas manuais, confirmação explícita Sim/Não e navegação no mapa.
- Seleção de obra existente por cliente e preenchimento automático; ID salvo nos rascunhos/offline; não altera cadastro pessoal do cliente.
- Validação de obra obrigatória + rua/número OU coordenadas confirmadas no formulário e serviço de gravação.
- Feedback salvo nas observações sem apagar texto histórico; GPS rejeitado não é usado para navegação. Segurança: obra existente só se pertencer ao cliente selecionado.
- Página da obra passou a exibir link para traçar rota com GPS ou endereço.
- Não houve mudança de schema, migração, publicação ou execução sobre base de produção.

## 2026-10-12 — Separação de Materiais (candidata local)

- Implementado quadro de conferência por unidade da Medição Final aprovada (inclusive parcial), sem misturar itens não medidos.
- Criados menu, painel, API autenticada com permissão do setor e migration multitenant com RLS, guard de aprovação e auditoria imutável.
- Estados independentes: aguardando, pendente (comentário obrigatório), separado com todos os materiais conferidos.
- Ligação a pacotes técnicos individuais, falha fechada para itens sem pacote ou com `item_ref` duplicado; assinatura técnica invalida conferência obsoleta.
- Sincronização do Kanban expandida para medições parciais; card da obra expõe apenas unidades aprovadas.
- Build/TypeScript e testes de integração local aprovados. Migration e deploy não realizados.

## 2026-10-04 — Assistente IA supervisionado no WhatsApp

- Criado controle de autonomia do WhatsApp com três modos: Observando, Sugerindo e Automático.
- Configuração é feita pelo Master e pode variar por número conectado.
- Multicanal existente foi preservado: visualização continua separada por número; somente conhecimento empresarial validável é compartilhado.
- Canal pessoal usa classificação Empresa/Pessoal/Dúvida; conteúdo pessoal é excluído do aprendizado empresarial.
- Aprendizados detectados em conversas entram em `ai_aprendizado_entradas` / `ai_aprendizado_candidatos` e exigem validação antes de virar memória oficial.
- Sugestões aparecem na própria conversa e podem ser usadas/editadas ou rejeitadas; decisões alimentam métricas de qualidade.
- Atendimento automático exige autorização explícita por canal, confiança alta e classificação de resposta segura.
- Criadas tabelas internas `atendimento_whatsapp_ia_config`, `atendimento_whatsapp_ia_canais`, `atendimento_whatsapp_ia_observacoes` e `atendimento_whatsapp_ia_sugestoes`, protegidas por RLS e sem acesso direto do cliente.
- Nova tela `/administracao/ia/whatsapp` e API `/api/integracoes/whatsapp/ia`.
- Gateway QR atualizado e publicado como Edge Function versão 18.
- Estado inicial mantido em Observando; nenhum canal liberado para resposta automática.
- TypeScript e build completo aprovados (131 rotas/páginas).

[Reading 397 lines from start (total: 397 lines, 0 remaining)]

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
# 2026-09-16 — Conferência final do orçamento responsiva

- corrigido o modal de conferência de `/orcamento-rapido` no celular;
- modal agora usa altura dinâmica do viewport e estrutura flexível;
- somente a relação de esquadrias possui rolagem;
- cabeçalho e rodapé de ações permanecem visíveis;
- camada do modal foi posicionada acima da navegação inferior do Atlas;
- adicionada proteção para a área segura inferior do iPhone.
# 2026-09-16 — Prospecção em Campo V1

- criado módulo `/prospeccao` com Kanban, filtros e agenda;
- criado pré-cadastro mobile em `/prospeccao/nova`, incluindo captura GPS;
- criada ficha `/prospeccao/[id]` com contatos, edição posterior, diário e próximas ações;
- próximos retornos podem ser sincronizados com a agenda pessoal do vendedor;
- conversão pesquisa possíveis clientes duplicados, vincula um existente ou cria Cliente 360 e obra;
- conversão usa RPC transacional e preserva o diário da prospecção;
- Master possui visão geral; vendedor fica limitado às próprias oportunidades por RLS;
- navegação, busca global e Home receberam acesso à Prospecção;
- migration `20260916151751_prospeccao_campo_v1.sql` aplicada no Supabase.


# 2026-10-01 — Gate empresarial W.Vetro + IAM da Medição Final

- Reaplicadas sobre a `main` atual as intenções de segurança dos antigos PRs #375/#401/#422, sem mesclar branches com mais de 330 commits de atraso.
- Criado `lib/wvetroAcessoServer.ts` para centralizar autenticação Master + empresa ativa + slug autorizado.
- Adicionado `WVETRO_EMPRESA_SLUG=esquadrifacio` ao `.env.example`.
- A importação `/api/medicao-final/importar-wvetro` agora usa o mesmo modelo de permissão do setor de Medição Final: oculto bloqueia, consulta permite preview, edição permite confirmar.
- Validação local aprovada com `npm run validate` e `npm run release:check`.

## 2026-10-04 — Cliente 360 + sincronização W.Vetro por cliente

- A lista de Orçamentos do Cliente 360 foi simplificada e passou a distinguir origem Atlas/W.Vetro.
- Orçamentos W.Vetro sincronizados exibem o número de origem e uma descrição curta quando disponível.
- Foi acrescentada conferência manual dos últimos 7 dias para Master, mantendo a automação periódica já existente.
- O clique abre a composição técnica atual; a nova apresentação comercial Atlas fica para a etapa seguinte.

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]
## 2026-10-04 — Orçamento Atlas V2 / W.Vetro

- visão geral do orçamento em lista, conforme protótipos aprovados;
- detalhe por tipologia com resumo, variáveis e componentes;
- impressão total ou parcial por seleção de tipologias;
- plano de corte filtrável por tipologia;
- lista de materiais filtrável por tipo e seleção;
- regra automática de cobrança de sobra por cor com override manual;
- edição técnica reutiliza o motor já existente de overrides e histórico, sem duplicar regras.

## 2026-10-06 — Sincronização W.Vetro pelo card do Kanban

- Modal do Kanban voltou a exibir anexos e versões mesmo no fluxo de edição direta.
- Botão de sincronização consulta W.Vetro pelo cliente e período recente, com autoidentificação por nome exato quando há somente um resultado.
- Vínculo usa o card atual como destino; dados técnicos do W.Vetro são atualizados sem apagar informações manuais.
- Duplicado W.Vetro já importado pode ser consolidado no card escolhido e ocultado das visões Kanban/Cliente 360.
- Regra de preservação funcional adicionada ao repositório para impedir regressões por alterações fora do escopo.

## 2026-10-13 — Separação WVetro: lista de corte e barras utilizadas (candidato)
Novos `VendaListaCorteWVetro`, `VendaBarrasWVetro`, parser posicional PDF WVetro, API de importação/validação e acompanhamento, página de impressão por card e tabela de feedback. Samuel #872: 18 linhas / 31 barras pendentes, preservando 40 cortes. Build, TypeScript e regressão do PDF real validados; falta teste funcional do preview.

## 2026-10-15 — Compras: saldo visível na conferência de NF (candidato local)

- Branch separada a partir da main #842, sem deploy e sem migrations.
- Conferência de NF exibe imagem cadastrada, estoque físico/reservado/disponível, quantidade projetada de entrada e saldo após recebimento por linha.
- Mensagem de confirmação agora distingue itens realmente movimentados de pendências de vínculo/conversão. Aviso antigo e incorreto de que a conferência nunca alterava estoque foi atualizado para refletir a RPC já existente.
- API de recebimento aplica isolamento por empresa ao buscar nota/itens/produtos/saldos e preenche empresa_id ao gravar conferência, itens e fotos, respeitando as migrações de tenant já em vigor.
- Pendentes: testes autenticados/estoque real em ambiente de homologação e vínculo formal entre pedido de compra e NF. Nenhuma rotina de pedido/cotação original foi alterada.

## 2026-10-15 — Compras: conciliação por item de NF e saldo na entrada (candidato local)

- API e interface para vincular item de NF a necessidade/pedido aprovado com destino Estoque ou Cliente/Obra, incluindo entregas parciais e saldo ainda não vinculado.
- Migration aditiva `20261015173000_compras_nf_vinculo_pedidos_v1.sql` cria vínculos auditáveis, valida empresa, fornecedor da cotação selecionada, produto, unidade, quantidade máxima e bloqueia desfazer vínculo depois do recebimento físico. **Não aplicada.**
- Exibição do saldo físico/reservado/disponível e imagem cadastrada do produto já na prévia da NF; produtos, fornecedores e respectivas referências fiscais passam a respeitar a empresa autenticada.
- Nenhum pedido original, cotação, Kanban, baixa, reserva, custos ou lançamentos existentes foram alterados. Próximo: homologação de integração, XML/PDF/manual e recebimento parcial com notas reais de teste.


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
