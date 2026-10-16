# Permissões por usuário e etapa — revisão iniciada em 15/10/2026

Branch: `feat/permissoes-etapas-20261015`. Base inicial: `302b0b2f`; reconciliado com a main atual `f891d3a5`. Sincronização W.Vetro autorizada, cards novos de compras e edições/exclusões da main foram preservados. Leitores de permissão de Compras e remoção de item da Medição agora usam também a configuração protegida.
Status: **publicação do primeiro incremento autorizada explicitamente em 16/10/2026. Revisão geral ainda incompleta.**

## Escopo implementado

- Matriz aditiva para 12 abas e 6 ações do Cliente 360, com herança das regras atuais, oculto, consulta e edição. Atalhos de liberar tudo, leitura e bloquear tudo; Master sempre completo.
- A matriz limita os setores/ações existentes; não concede automaticamente um setor oculto. Configurar o setor continua necessário.
- Leitura principal do painel passa pela API autenticada, consultando apenas grupos autorizados com JWT do próprio usuário e RLS. Bloqueio total retorna 403 antes de ler o cliente; falha de autorização não vira sucesso.
- Indicadores, ações e observações respeitam a matriz; edição do cadastro preserva observações quando o usuário não pode editá-las.
- Navegação direta da central antiga redireciona perfis com matriz explícita ao painel protegido. Financeiro, revisões e vendas possuem barreira complementar de navegação.
- Valores recebidos/saldo na lista de vendas são consultados e mostrados apenas quando Financeiro está autorizado. Custos não usados deixaram de ser carregados nessa lista.
- Gravação das configurações passa por API exclusiva de Master, validando alvo na mesma empresa. Tabela nova permite apenas leitura própria ou Master da mesma empresa; escrita somente pelo backend.
- Migration candidata copia configurações legadas sem zerar permissões e impede autoelevação por alteração das chaves antigas. **Não foi aplicada no Supabase de produção.**
- Leitores cliente/servidor consultam o armazenamento protegido e mantêm compatibilidade de leitura com configurações antigas. Falhas reais de consulta bloqueiam a leitura em vez de recuperar permissões amplas.
- Seleção de usuários ignora respostas atrasadas de seleção anterior. Falha ao salvar configuração segura não altera o teto dos setores.

## Limitações: este incremento não é a revisão completa

| Área | Próximo trabalho obrigatório |
| --- | --- |
| Ações e dados diretos | As escritas antigas ainda usam Supabase/RPC em diversos componentes. Guards de UI não substituem revisão de RLS/RPC; completar proteção por ação e testes de acesso direto. |
| Área da venda | Revisar as abas internas de cada venda, leituras financeiras/custos/margens, anexos, aprovações e exportações. A barreira da página não equivale a controle de todas as abas. |
| IA geral e especialistas | Há checagem por setor e ação financeira em `lib/agente.ts`; demais ferramentas ainda precisam de regras por ação e escopo próprio/geral. Não foi criado controle fictício de IA. |
| Compras e NF | Conferir ação por ação em solicitações, cotação, aprovação, compra, edição/exclusão e lançamento/conferência de NF. Preservar regras aprovadas de destino e imagens dos produtos. |
| Financeiro e balcão | Revisar leitura, criação, edição, recebimento, desconto, cancelamento, reabertura e relatórios no servidor e banco. |
| Produção e instalação | Separar consulta, liberação parcial/total, execução, pendência, conclusão, exclusão, documentos e links externos. Não alterar Kanbans aprovados. |
| Relatórios | Separar áreas, custos/margens, leitura e exportação/impressão; validar links diretos e chamadas de API. |
| Demais setores | Confrontar catálogo existente com cada rota/ação real; não concluir cobertura apenas pela existência de opções no painel. |
| Homologação | Validar visualmente e com contas limitadas em ambiente isolado, inclusive revogação em sessão aberta; ainda não executado no ambiente real. |

## Validação executada

- Testes de regras e API com Master, vendedor limitado, leitura, teto de setor, bloqueio total, ausência de sessão e falha fechada.
- Migration exercitada em PostgreSQL local isolado (PGlite 0.5.10): preservação do legado, isolamento de empresas, leitura própria, bloqueio de autoelevação e anônimo, escrita pelo backend.
- Regressão de Cadastro Cliente 360, entrada antiga no cadastro aprovado e recebimento de venda autorizado.
- TypeScript e build completo (`npm run release:check`) aprovados antes da reconciliação com a main; repetidos após a integração. Regressões das permissões de NF, cadastros e solicitações/carrinhos/destinos/edição/exclusão de compras da main também aprovadas.
- Isso não equivale a teste funcional autenticado no Atlas real nem a validação de todas as políticas existentes.

## Preservação e rollback

- Nenhuma alteração nas permissões de usuários reais, nenhuma migration remota, nenhum merge e nenhum deploy de produção.
- Base de rollback registrada em Git (`302b0b2f`); mudanças em worktree/branch separados.
- Antes de eventual implantação, testar migration no ambiente isolado do Supabase e comparar funções aprovadas. Aplicar migration antes de usar a gravação nova; sem ela, a API de gravação falha sem mudar setores.
- Rollback de aplicação deve manter a tabela nova para não perder autorizações gravadas. Antes de voltar ao leitor legado, transportar as configurações atualizadas sob controle Master; simplesmente voltar o código antigo faria ler regras antigas. Não executar rollback automático nem apagar tabela.

## Inventário estático de APIs

O repositório contém 137 arquivos `app/api/**/route.ts`. Esta contagem orienta a revisão; não comprova que uma rota está protegida.

| Grupo de API | Arquivos |
| --- | ---: |
| agente | 6 |
| assistencia | 1 |
| assistencias | 1 |
| atualizar-usuario | 1 |
| backup | 1 |
| balcao | 8 |
| cadastros | 1 |
| clientes | 1 |
| compras | 10 |
| configuracoes | 1 |
| consultoria | 1 |
| criar-usuario | 1 |
| engenharia | 1 |
| estoque | 5 |
| financeiro | 1 |
| fornecedores | 2 |
| geocodificacao | 1 |
| ia | 12 |
| importar-itens-orcamento | 1 |
| integracoes | 37 |
| kanban-central | 1 |
| medicao-final | 15 |
| notificacoes | 1 |
| orcamento | 2 |
| producao | 4 |
| produtos | 1 |
| relatorios | 3 |
| resolver-login | 1 |
| restaurar-backup | 1 |
| tarefas | 1 |
| usuarios | 1 |
| vendas | 13 |


## Publicação incremental autorizada — 16/10/2026

- Usuário autorizou expressamente publicar em `atlasonesystem.com`.
- Reconciliado com produção `a1aa8e88` (#859), preservando recebimento integrado de compras/NF/obra/estoque.
- Snapshot das configurações e permissões atuais preservado antes da migration; deployment anterior `dpl_J1AtojtRyD6Ur15J8o7HhTFBo16g`.
- Gravação nova usa RPC exclusiva do backend, transacional, e mantém a configuração legada igual à nova para compatibilidade e rollback.
- Restante da varredura de IA, relatórios e ações internas continua pendente; a publicação não equivale à conclusão da revisão geral.
