# Auditoria de permissões do Atlas One — 24/10/2026

## Escopo e segurança
Ambiente de análise: worktree isolado feat/permissoes-producao-auditoria-20261024, baseado no commit 133d96a. Nenhuma gravação em dados reais, nenhuma migração de banco e nenhum deploy de produção nesta etapa. Análise estática + testes locais; status em produção ainda não homologado.

## Levantamento
- 9 blocos de permissão: Comercial, Financeiro, Clientes e relacionamento, Engenharia e técnico, Produção e instalação, Compras e estoque, Administração, Conhecimento, Outros acessos.
- 48 módulos previstos no catálogo e 240 identificadores únicos de ações.
- 164 arquivos de API encontrados, dos quais 126 possuem operação de escrita.
- 12 arquivos mencionam diretamente o helper usuarioPodeAcaoServer/nivelAcaoUsuarioServer.
- 67 arquivos incluem referência a master em expressões de papel.
- Esses números NÃO provam ausência de segurança nas outras rotas: há validadores especializados, RLS, RPC e helpers alternativos. Cada rota requer auditoria funcional. Inventário completo: PERMISSOES_INVENTARIO_APIS_20261024.csv.

## Falhas observadas (com evidência de código)
1. Menu lateral desktop exibia GUIAS de setores sem conferir nível de acesso do usuário (components/Sidebar.tsx, antes da revisão).
2. A tela principal da Produção consultava ordens e cards e expunha edição/movimentação sem aplicar a matriz granular a cada ação.
3. A API app/api/producao/kanban/movimentar/route.ts usava autorização legada separada das ações configuradas pelo Master.
4. O editor de usuários permite definir ações específicas, mas o backend herda o nível geral do setor quando uma ação não tem registro explícito (lib/acessoUsuarioServer.ts); essa compatibilidade requer migração cuidadosa e teste de usuários legados.
5. Contas a receber: catálogo mapeia a ação para caixa-balcao, mas app/api/financeiro/contas-receber/route.ts consulta setor financeiro. Configuração e execução podem divergir.
6. CMV: app/api/vendas/cmv/route.ts confere autor do lançamento ou master em PATCH/DELETE/PUT, não necessariamente a permissão individual de edição configurada. Caso Daiane requer reprodução com perfil não-master.
7. Conferência do valor de venda: app/api/vendas/cmv/revisao-venda/route.ts restringe a master e função de banco fn_venda_conferir_valor_wvetro_v1 reforça a mesma regra. Liberar na UI não supera esse bloqueio.
8. RLS de ordens_producao no arquivo 20261001005153_p0_ordens_producao_gates_inviolaveis_v1.sql isola empresa e protege gates técnicos, porém não verifica permissões individuais por operação. Escritas diretas em lib/ordensProducao.ts e lib/setorKanban.ts exigem proteção no banco/RPC, além dos botões. Não considerar proteção de interface como autorização de banco.
9. Teste legado scripts/test-cmv-editar-lancamento.cjs falha na asserção Campo obrigatório fornecedor. Falha anterior à revisão das permissões da Produção; investigação separada.

## Implementado no ramo isolado
- Guard de navegação para rotas /producao com níveis de consulta e ações; preservada a Medição Final como submódulo com setor próprio.
- Ocultação de Produção no menu desktop e móvel, respeitando setor e ação.
- Visibilidade dos comandos do Kanban condicionada a permissões específicas; bloqueio adicional nas funções de clique.
- Catálogo detalhado de ações para criar ordens, gerenciar etapas e liberar produção.
- Controle por ação edicao na movimentação via API /api/producao/kanban/movimentar; gates técnicos existentes mantidos.
- Teste novo scripts/test-producao-permissoes-20261024.cjs: consulta, edição, ocultação, Master, rotas e API. Testes existentes de contextos, Cliente 360, elegibilidade de medição e vínculos passaram. TypeScript aprovado.

## Pendências obrigatórias ANTES de afirmar conclusão ou publicar
1. Endurecer RLS/RPC de setor_kanban_itens, setor_kanban_colunas e ordens_producao por ação, sem interromper sincronizações automáticas. Testar com JWT não-master e tentativas de acesso direto ao banco.
2. Revisar integrações internas e serviços: liberação de medição, criação da OP, separação, pacotes técnicos e mudança de status. Garantir que permissões delegadas funcionem sem master.
3. Reconciliar mapeamentos financeiro / contas a receber, operações de CMV, edição de custos e o caso Daiane em contas de teste.
4. Conferir ações e dados de todos os 48 módulos; rotas sem correspondência no catálogo devem ser classificadas explicitamente.
5. Homologar ocultação desktop/mobile, troca de usuário, revogação imediata e sessão aberta; provar 403 no servidor para acesso negado.
6. Implantar primeiro em prévia/ambiente isolado e só publicar gradualmente após regressão. Fazer backup e rollback; não alterar permissões de usuários reais automaticamente.

## Catálogo levantado
- CRM e carteira comercial — módulo crm (setor: crm)
- Representantes comerciais — módulo representantes (setor: representantes)
- Pedido de orçamento — módulo pedido-orcamento (setor: orcamentos)
- Contratos e documentos — módulo contratos (setor: contratos)
- Comissões e RT — módulo comissoes (setor: comissoes)
- Fazer orçamento — módulo fazer-orcamento (setor: fazer-orcamento-msanfyvj)
- Venda balcão — módulo venda-balcao (setor: venda-balcao)
- Recebimentos de vendas — módulo recebimento-vendas (setor: recebimento-vendas)
- Financeiro geral — módulo financeiro-geral (setor: financeiro)
- Custos e CMV por obra — módulo custos-cmv (setor: financeiro)
- Contas a pagar — módulo contas-pagar (setor: financeiro)
- Contas a receber — módulo contas-receber (setor: caixa-balcao)
- Caixa — módulo caixa (setor: caixa-balcao)
- Faturamento e fiscal — módulo fiscal (setor: fiscal)
- Relatórios financeiros do balcão — módulo relatorios-financeiros (setor: relatorios-balcao)
- Portal do cliente — módulo portal-cliente (setor: portal-cliente)
- Portal de parceiros — módulo portal-parceiros (setor: portal-parceiros)
- Pós-venda e garantia — módulo pos-venda (setor: pos-venda)
- Abrir assistência — módulo assistencia-abrir (setor: assistencia-abrir)
- Painel de assistências — módulo assistencia-painel (setor: assistencia-painel)
- Marketing — módulo marketing (setor: marketing)
- Conferir projeto — módulo conferir-projeto (setor: engenharia-projeto)
- Motor de Engenharia (MEE) — módulo mee (setor: mee)
- Visitas técnicas e medições — módulo medicoes (setor: medicao)
- Engenharia e projetos — módulo engenharia-geral (setor: engenharia)
- Modelagem 3D — módulo modelagem-3d (setor: modelagem-3d)
- Biblioteca técnica — módulo biblioteca-tecnica (setor: biblioteca-tecnica)
- Pesquisa e desenvolvimento — módulo ped (setor: ped)
- Produção — módulo producao (setor: producao)
- Medida final — módulo medida-final (setor: medida-final-msdwtt9y)
- Qualidade — módulo qualidade (setor: qualidade)
- Instalação — módulo instalacao (setor: instalacao)
- Logística e entregas — módulo logistica (setor: logistica)
- Compras — módulo compras (setor: compras)
- Perfis — módulo compras-perfis (setor: compras-perfis)
- Acessórios — módulo compras-acessorios (setor: compras-acessorios)
- Vidros — módulo compras-vidros (setor: compras-vidros)
- Outros materiais — módulo compras-outros (setor: compras-outros)
- Estoque — módulo estoque (setor: estoque)
- Recebimento de mercadorias — módulo recebimento (setor: recebimento)
- Cadastros técnicos — módulo cadastros (setor: cadastro)
- Configurações do Atlas — módulo configuracoes (setor: configuracoes)
- Automações do fluxo — módulo automacoes (setor: workflow-automacoes)
- Recursos Humanos — módulo rh (setor: rh)
- Direção e administração — módulo direcao (setor: direcao)
- Consultoria e inteligência de gestão — módulo consultoria (setor: consultoria)
- Relatórios e BI — módulo bi (setor: relatorios)
- Universidade Atlas — módulo universidade (setor: universidade)


## Segunda etapa — Delegação do CMV e Contas a Receber (24/10/2026)

**Incremento isolado, ainda sem publicação em produção e sem modificar usuários reais.**

- Corrigida a divergência entre a permissão setorial caixa-balcao do catálogo e a checagem financeira da API /api/financeiro/contas-receber: o acesso legado por financeiro continua válido, enquanto o novo controle também reconhece a permissão específica de caixa-balcao. O ID de ação nominal continua obrigatório.
- Criado o submódulo **Custos e CMV por obra** com seis delegações distintas: editar, cancelar e restaurar lançamentos de terceiros; editar, cancelar e conferir recebimentos de terceiros.
- As seis delegações são negadas **por padrão**, mesmo quando o setor Financeiro possui nível edição; somente o Master pode gravar as configurações autorizadas. O backend exige que a ação seja **explicitamente** marcada edição e que o teto do setor seja edição. A regra de edição do próprio autor foi preservada.
- Implementada a autorização nas APIs de CMV e recebimentos para operações pertinentes; tenant, versão, histórico, justificativas, comprovantes e integridade das compras foram preservados.
- Os botões e formulários de CMV e recebimentos respeitam autoria ou delegação: quem não pode editar não recebe o controle de alteração. A seleção em lote inclui apenas recebimentos autorizados para conferência.
- Corrigidos os valores padrão dos controles **Configurações > Usuários** e **Permissões desta tela** para não criarem concessões sensíveis acidentalmente ao salvar outro ajuste.
- Corrigido um teste estático antigo desatualizado: o campo obrigatório Fornecedor passou a ser componente compartilhado; validação conferiu o componente real sem alterar seu funcionamento.
- Teste isolado com banco simulado verificou Master, ausência de delegação, consulta, oculto, edição e falha de leitura fechada. Não equivale a teste de token real.

**Validação:** typecheck OK; build Next.js completo OK com URL e chaves fictícias, sem tocar no Supabase real; testes de CMV, delegação, exclusão, Cliente 360, Produção, separação, relatórios, NF e recebimentos passaram. Um nome de teste consultado (test-cmv-revisao.cjs) não existe e não representa falha do sistema. Testes autenticados com usuário limitado continuam necessários antes de qualquer deploy.

**Pendências críticas:** revisão dos GET/POST genéricos de CMV, revisão/validação do valor de custos previstos e do valor de venda; autorização de gravação direta via Supabase e RLS para ordens e cards de Produção; homologação das matrizes dos demais setores. Nenhuma alteração foi enviada ao banco ou ambiente de produção.

## Terceira etapa — APIs da Produção, separação e proteção do banco (24/10/2026)

**Feito em worktree/branch isolado, sem deploy nem migração.**
- Protegido GET de acompanhamento do Kanban inicial com ação producao.geral.consultar, e POST com producao.geral.mover.
- O Kanban inicial aceita a autorização legada do Master ou uma autorização de movimento explicitamente delegada pelo novo painel. As verificações técnicas de movimentação continuam obrigatórias; editar setor sem escolha individual não ignora o modo inicial.
- GET da liberação por venda exige consulta da Produção e informa liberacaoPermitida conforme ação individual producao.geral.liberar; POST aceita essa ação sem exigir cargo Master, mas preserva validação de Medição Final, materiais, pacote técnico, estados, empresa e confirmação explícita.
- Geração de pacote técnico parcial exige producao.plano_corte.gerar na API. A antiga permissão genérica de edição segue válida para usuários sem escolha individual explícita, preservando compatibilidade de comportamento até a homologação da matriz.
- Página Separação de Materiais distingue consulta de edição da separação e geração de pacote; esconde ou desabilita botões/formulários sem acesso. O link de Medição Final exige permissão daquele submódulo.
- UI de liberação explica que Master pode delegar, em vez de dizer que a operação exige cargo Master.
- Proposta de hardening PostgreSQL escrita em docs/security-review/PRODUCAO_ACL_RLS_PROPOSTA_NAO_APLICAR_20261024.sql, fora de migrations de propósito; a proposta tem feature flag por empresa desligada por padrão, helpers de RLS e guarda de escrita de ordens. Não foi executada e não protege o banco real.
- A proposta SQL não inclui ainda triggers de gravação para cards e colunas; precisa primeiro identificar todas as políticas existentes no banco real e migrar as gravações do navegador para rotas/RPCs compatíveis. Auditoria encontrou caminhos diretos em lib/setorKanban.ts e lib/ordensProducao.ts e RPCs com service role. Aplicação prematura poderia bloquear automações.
- 11 scripts relacionados às permissões, produção, CMV, medições e liberação passaram. TypeScript e build Next.js completo aprovados em ambiente isolado com variáveis fictícias, sem acesso ao banco real.

### Critérios antes de qualquer publicação
1. Exportar e conferir pg_policies, pg_trigger, permissões e grants de setor_kanban_* e ordens_producao em um clone de teste, sem mudar produção.
2. Garantir permissão 403 real em POST/UPDATE direto com JWT de funcionário oculto/consulta e passe com JWT delegado; testar todas as transições, inclusive liberação e retorno de etapa.
3. Testar Master, produção/medida-final, separação, colunas padrão, ordens manuais e pacotes técnicos com dados simulados e autenticação real de prévia.
4. Simular integrações de medição parcial, sincronização automática, pacote técnico, histórico de card, instalação e RLS com service_role e colaboradores.
5. Medir consultas e latência das políticas restritivas. Validar plano de rollback e ligar flag somente em empresa de testes, não na empresa operacional.
6. Continuar revisão dos 48 módulos levantados, especialmente rotas sem helper de autorização; inventário bruto não substitui análise funcional.


## Quarta etapa — Escritas do Kanban da Produção migradas para API autenticada (24/10/2026)

**Incremento isolado, não publicado.** A rota POST de Produção em
app/api/producao/operacoes/route.ts valida token, tenant e permissão por ação,
filtra todos os IDs por empresa_id e reutiliza os triggers existentes, com:
- criar etapa e editar etapa: producao.geral.etapas
- editar card: producao.geral.editar, sem aceitar alteração do marcador técnico de medição
- mover card: producao.geral.mover, sem permitir arraste de medição não liberada
- criar ordem manual: producao.geral.criar, conferindo vínculo cliente, obra, venda e orçamento
- avançar status da ordem: producao.geral.mover, em sequência e sem permitir ordem bloqueada
- marcar card liberado: producao.geral.liberar, somente após Medição Final vinculada aprovada e pacote técnico válido disponível

A UI principal em app/producao/page.tsx passa a utilizar
lib/producaoOperacoesCliente.ts, sem fallback de escrita direto no navegador
nessas sete operações. O controle de criação e edição de colunas dos outros
setores não foi alterado. A leitura de colunas da Produção não cria mais
automaticamente uma coluna no banco, removendo o efeito de escrita por mero
GET; o fluxo autenticado de sincronização e a edição explícita ainda criam
a coluna quando necessário.

A API administrativa de sincronização de Medição Final com o Kanban foi
protegida por ação de edição da Produção para sincronizações globais, ou
por ações de preenchimento, edição ou aprovação da Medição Final em
sincronizações com ID. Essas permissões continuam herdando o setor quando
não há ação explicitamente configurada, para preservar compatibilidade.

Validações: testes executando o handler real com banco simulado
(401/403/503, tentativa de outra empresa, IDs falsos, salto de etapa,
marcador de Medição Final, liberação, atualização concorrente),
testes estáticos e regressão: 14 scripts aprovados, zero falhas.
TypeScript aprovado e build Next.js completo aprovado com variáveis de
ambiente fictícias, sem banco operacional.

**IMPORTANTE — Limitações ainda não resolvidas:** as operações de
aprovação de medição e geração do pacote técnico chamadas pela tela de
Produção ainda utilizam fluxos próprios com gravações pelo cliente; essas
operações não foram migradas nesta etapa. Funções legadas exportadas em
lib/setorKanban.ts e lib/ordensProducao.ts continuam no repositório para
preservar outras telas e automações; a RLS real precisa ser inventariada e
testada. A criação manual de card e ordem ainda ocorre em duas operações,
com limpeza compensatória caso a segunda falhe; a solução final pede
RPC transacional. Teste com JWT real de funcionário em clone/prévia
continua obrigatório antes de aplicar regras de RLS ou publicar esta branch.

## Quinta etapa — Hierarquia oficial Setor > Módulo/etapa > Ação (24/10/2026)

**Meta solicitada pelo responsável do Atlas One:** o Master escolhe quem vê o setor completo ou não vê absolutamente nada. Dentro do setor liberado, escolhe quais módulos, telas/etapas e ações o funcionário pode consultar ou editar. Não é aceitável elevar o funcionário a Master para permitir uma ação limitada.

### Inconsistências encontradas
1. A antiga página de Configurações > Usuários elevava automaticamente o setor ao nível máximo quando uma ação mudava, misturando setores com vários módulos (por exemplo: Financeiro geral, CMV e Contas a Pagar).
2. O editor de acesso à tela também elevava o teto do setor ao liberar uma ação, podendo liberar módulos irmãos por fallback.
3. Configuração segura e execução no servidor conheciam somente setor e ação; faltava teto intermediário de módulo.
4. O menu desktop mostrava links legados enquanto o acesso ainda era carregado.
5. A maioria das URLs catalogadas não possuía um guard comum; esconder o menu não impedia tentar abrir uma URL.
6. Cliente 360 permitia algumas abas em modo legado ainda que o setor Portal do Cliente tivesse sido explicitamente ocultado.

### Correções implementadas no worktree isolado
- Persistência JSON do usuário agora suporta a chave modulos ao lado de acoes, crmEscopo, cliente360. Permissões anteriores sem essa chave continuam herdando o setor, evitando bloqueio indiscriminado ao atualizar.
- Nível efetivo calculado pelo teto mais restritivo entre setor, módulo e ação, no navegador E no backend. Setor oculto sempre prevalece; módulo oculto sempre prevalece; Master mantém acesso total.
- Painel completo de usuários reorganizado em seletores de 1) setor, 2) módulo, 3) ação. Alterar uma ação não eleva setor ou outro módulo. Ao habilitar um setor que estava oculto, módulos ainda sem configuração explícita começam ocultos; somente a escolha do Master os abre.
- O atalho contextual de permissões em cada tela segue a mesma hierarquia.
- Persistência de módulo adicionada à API autorizada ao Master em /api/usuarios/acessos-etapas, mantendo filtros para níveis inválidos e proibição de alterar Master.
- Um guard de rotas catalogadas foi incluído no AuthGate e no balcão, com a mesma regra de acesso nos menus desktop e mobile. Página conhecida sem módulo cadastrado não autoriza entrada. Páginas com guard específico, Cliente 360 e Produção, mantêm esses controles.
- O Cliente 360 passa a respeitar a negação explícita do setor Portal do Cliente e dos módulos relacionados às abas; usuários antigos sem regra explícita conservam comportamento legado até a homologação.
- Botões de edição de CMV também levam em conta setor Financeiro e teto do módulo Custos e CMV, além da autoria/delegação individual.

### Validações e limites
- **48 módulos e 240 identificadores de ação conferidos, sem duplicatas** no catálogo.
- **19 scripts aprovados, sem falhas**, incluindo testes reais de helpers cliente/servidor com banco simulado: oculto, consulta, edição, Master, módulo oculto com ação autorizada, módulo consulta com ação de edição, hierarquia Cliente 360 e navegação.
- Teste de tipos e build Next.js aprovados com URL e chaves fictícias no worktree isolado.
- **NÃO FOI PUBLICADO NEM EXECUTADO NO BANCO REAL.**
- Ainda NÃO é correto afirmar que todas as telas, ações e APIs do Atlas estão completamente protegidas: o inventário inclui centenas de rotas com lógica própria, ações do cliente que ainda escrevem via Supabase e RLS a validar. Proteção visual e guard de rota não substituem as validações de API e do banco. O inventário de APIs e a proposta RLS permanecem como pendências para homologação.
- As gravações do painel do Master ainda ocorrem em operações separadas (configuração de módulo/ação e permissões setoriais), com mensagens de falha e ordem de escrita conservadora; transação atômica exigirá RPC própria testada em banco clone.
- A nova hierarquia precisa ser homologada, com tokens reais de funcionário em ambiente de testes, para todos os setores e caminhos de trabalho, ANTES de deploy. Verificar também a coexistência com grupos legados, permissões de cadastro, vendas, compras, CRM, WhatsApp e medição.
