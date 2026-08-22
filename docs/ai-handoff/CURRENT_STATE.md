# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — LISTA DE VIDROS + FOLGAS NO PLANO DE CORTE — 2026-08-22

O módulo `Engenharia > Fórmulas de Corte` passou a preparar, junto ao plano de perfis, uma lista de vidros com composição, folgas independentes de largura/altura e medida de corte quando existe uma referência técnica disponível.

Estado atual desta implementação:
- o campo de vidro passou a aceitar escolha por sugestões do cadastro e também digitação livre;
- produtos ativos cuja categoria ou grupo contenha `Vidro` aparecem como sugestões sem exigir migration;
- foram adicionados campos separados `Folga na largura do vidro (mm)` e `Folga na altura do vidro (mm)`, aceitando valores decimais;
- o botão principal passou a indicar `Gerar plano de corte + vidros`;
- o relatório gerado ganhou a seção `Lista de Vidros`, com tipo/composição, medida-base, folga de cada eixo, medida de corte e quantidade;
- a impressão/PDF inclui a lista de vidros;
- a medida do vidro não usa a largura/altura total da esquadria como fallback, evitando criar uma medida técnica sem validação;
- na PC3 Suprema, a implementação em validação usa como referência os baguetes SU102 horizontal e vertical já presentes no plano e desconta as folgas informadas; essa relação deve ser conferida em uso real antes de liberar produção;
- a quantidade de panos da PC3 é inferida pelos pares de baguetes horizontal/vertical e multiplicada pela quantidade de esquadrias informada;
- tipologias sem referência de vidro reconhecida exibem aviso e não geram medida automática;
- novo helper `lib/planoCorteVidros.ts` concentra a busca de vidros do cadastro e a regra de geração da lista;
- nenhuma migration e nenhuma alteração de schema nesta etapa.

## EM VALIDAÇÃO — CADASTRO DO CLIENTE COMO CENTRAL OPERACIONAL — 2026-08-22

O cadastro do cliente passa a ser o ponto central para consultar e iniciar operações relacionadas àquele cliente, sem duplicar registros quando o cliente já existe.

Estado atual desta implementação:
- `/clientes/[id]` mantém dados cadastrais, tarefas, interações de CRM e propostas e ganhou a `Central do cliente`;
- a Central mostra vendas confirmadas a partir de `medicoes_finais.cliente_id`, vinculando a venda ao orçamento de origem quando disponível;
- a Central mostra assistências/manutenções a partir de `assistencias.cliente_id`, com data, status, técnico, duração, acesso à OS/PDF e ao Kanban;
- cards espelho de Assistência criados em `orcamentos` são excluídos da lista de propostas do cliente para evitar duplicidade visual;
- existem atalhos `Novo orçamento` e `Nova assistência / manutenção` dentro do cadastro do cliente;
- ao abrir Orçamento Rápido pelo cadastro, o formulário recebe `?cliente=<id>`, carrega nome, telefone/WhatsApp, cidade e origem e preserva o `cliente_id` exato no envio;
- ao abrir Assistência pelo cadastro, o formulário recebe `?cliente=<id>`, carrega os dados existentes e preserva o `cliente_id` exato no chamado e no card espelho;
- `DadosOrcamentoForm` e `DadosAssistenciaForm` aceitam `clienteId` opcional; quando não há ID explícito, os fluxos antigos continuam usando `obterOuCriarCliente`;
- manutenção ainda usa o fluxo/tabela de Assistências; quando houver módulo próprio, deve seguir a mesma regra de vínculo por `cliente_id`;
- nenhuma migration e nenhuma alteração de schema nesta etapa.

## EM VALIDAÇÃO — ASSISTÊNCIA EM CAMPO COM ROTA, GPS E TEMPO — 2026-08-21

O link externo da Assistência evoluiu para um fluxo de execução em campo, com navegação até o cliente, check-in explícito do técnico, contagem de tempo e registro opcional de GPS no início e na conclusão.

Estado atual desta implementação:
- após gerar o link do técnico, o Atlas oferece ações `WhatsApp`, `SMS` e `Copiar`; WhatsApp/SMS abrem o aplicativo do aparelho com a mensagem e o link já preparados;
- na tela externa o telefone do cliente pode ser tocado para ligar e também possui atalho para WhatsApp;
- o endereço completo possui `Abrir no Google Maps` e `Copiar endereço`;
- ao chegar ao local o técnico clica em `Iniciar assistência`;
- no início, o navegador solicita permissão para localização; se autorizada, o Atlas grava latitude, longitude, precisão aproximada e horário do check-in;
- negar ou não conseguir obter GPS não bloqueia o atendimento: a assistência inicia normalmente sem coordenadas;
- `Iniciar assistência` grava horário no servidor, muda o status para `em_atendimento` e move o card automaticamente para a coluna operacional de atendimento/andamento;
- a tela do técnico passa a mostrar cronômetro ao vivo baseado no horário de início persistido no servidor;
- o Kanban interno atualiza as assistências silenciosamente a cada 12 segundos e mostra `Em campo HH:MM:SS` ou a duração final no card;
- o modal interno da assistência exibe técnico, início, fim, duração e, quando disponíveis, links do GPS de início e conclusão para o Google Maps, incluindo a precisão aproximada;
- na conclusão, o técnico mantém o preenchimento de serviço, materiais, observações e as duas assinaturas;
- ao concluir, o Atlas tenta capturar novamente o GPS com autorização do aparelho, grava o horário final e a duração total, muda status para `resolvido` e move o card para a etapa final;
- não existe rastreamento contínuo nem GPS em segundo plano: a localização é solicitada somente nos momentos explícitos de início e conclusão;
- migration `assistencia_gps_tempo_execucao`, versão remota `20260821220855`, já foi aplicada no Supabase de produção e adiciona apenas campos nullable, mantendo compatibilidade com a versão anterior.

## EM VALIDAÇÃO — LINK DO TÉCNICO + ASSINATURAS + PDF DIRETO — 2026-08-21

A Assistência Técnica passou a ter um fluxo externo para execução em campo e uma saída de PDF mais prática para envio ao cliente.

Estado atual desta implementação:
- o modal de cada chamado em `/assistencias` ganhou o bloco `Acesso do técnico`, onde um usuário autenticado pode informar o nome do técnico, telefone opcional e validade do acesso;
- o Atlas gera um link individual por assistência; o token completo aparece somente no momento da geração e no banco fica armazenado apenas o hash SHA-256;
- links podem expirar automaticamente e também podem ser revogados pelo Atlas;
- a rota pública `/assistencia/acesso/[token]` abre sem login e dá acesso somente ao chamado vinculado ao token válido;
- a tela externa já mostra empresa/logo, cliente, telefone, endereço, data de abertura, problema relatado e fotos do chamado;
- o técnico pode preencher nome, data do atendimento, serviço realizado, materiais/peças e observações;
- a tela externa possui assinatura digital em canvas para o técnico e para o cliente, utilizável com dedo ou mouse;
- a conclusão exige as duas assinaturas e grava atendimento + assinaturas de volta na própria assistência;
- a Ordem de Serviço passa a exibir automaticamente técnico, data, serviço, materiais, observações e as duas assinaturas salvas;
- `/assistencias/[id]/os` ganhou ações separadas `Salvar PDF` e `Imprimir`;
- `Salvar PDF` gera arquivo `.pdf` diretamente no navegador via jsPDF, facilitando salvar no computador e compartilhar pelo WhatsApp;
- `Imprimir` continua usando o diálogo nativo do navegador;
- a impressão da OS esconde controles fixos do Atlas, incluindo `Voltar`, `Início` e `Favoritos`, deixando a folha limpa;
- `MobileNavigationControls` também recebeu `print:hidden` como proteção adicional;
- a migration `assistencia_link_tecnico` foi aplicada no projeto Supabase de produção e cria os campos de atendimento/assinaturas em `assistencias` e a tabela `assistencia_acessos_externos`;
- a versão local da migration de fórmulas de corte foi reconciliada com a versão já registrada no banco (`20260820160019`), corrigindo uma divergência anterior do histórico de migrations sem alterar o schema existente.

## EM VALIDAÇÃO — OS DE ASSISTÊNCIA A4 + DATA AJUSTÁVEL — 2026-08-21

A Assistência Técnica recebeu dois ajustes pedidos após uso real: a Ordem de Serviço foi compactada para impressão em uma única folha A4 e a data da assistência passou a ser ajustável.

Estado atual desta implementação:
- `/assistencias/[id]/os` usa layout de impressão A4 retrato com margem de 6 mm;
- quadros, campos internos, linhas de assinatura e separadores usam bordas mais escuras para leitura melhor no papel;
- cabeçalho, resumo, cliente, problema, técnico/data, serviço, materiais, observações e assinaturas foram compactados na impressão;
- até 6 fotos continuam disponíveis e, no papel, ficam organizadas em uma faixa horizontal compacta para economizar altura;
- o atraso da impressão automática passou para 650 ms, dando mais tempo para logo e fotos carregarem antes do diálogo de impressão;
- ao abrir uma nova assistência existe o campo `Data da assistência`, iniciado no dia atual e alterável antes de salvar;
- no modal do chamado dentro do Kanban de Assistências existe `Data da assistência` + `Salvar data`, permitindo corrigir depois a data do chamado;
- a data escolhida é a mesma exibida no card e na OS;
- a implementação reaproveita `assistencias.created_at`, sem migration e sem alteração de schema.

## EM VALIDAÇÃO — NAVEGAÇÃO ORGANIZADA + CENTRAL DE CADASTROS — 2026-08-21

O Atlas ganhou uma camada de organização para reduzir a dificuldade de localizar funções sem remover nenhuma tela existente nem alterar regras de negócio.

Estado atual desta implementação:
- a sidebar passou a separar a navegação operacional pelos grupos `Geral`, `Comercial` e `Operações`;
- foi adicionado o campo `Buscar no menu...`, que pesquisa módulos operacionais e também funções administrativas por palavras-chave;
- a área `Administração` fica recolhida para reduzir poluição visual e é expandida automaticamente quando o Master entra em uma rota administrativa;
- foi criada a rota `/administracao` como `Central de Administração`, funcionando como mapa para Empresa e Identidade, Usuários e Acesso, Setores e Permissões, Padrão do Orçamento, Central de Cadastros, Fórmulas de Corte, Campos adicionais e Configurações Avançadas;
- foi criada a rota `/cadastros` como `Central de Cadastros`, com busca própria e atalhos separados para Produtos, Linhas, Materiais, Fornecedores, Produtos por Linha, Precificação, Unidades Pendentes, Receitas Técnicas, Fórmulas de Corte e Campos adicionais;
- a tela antiga `/cadastro` foi preservada e aparece somente como `Cadastros Avançados`, para manter funções que ainda não foram separadas em páginas próprias;
- nenhuma rota anterior foi removida;
- nenhuma migration e nenhuma alteração de schema nesta etapa.

## EM VALIDAÇÃO — HOME CONFIGURÁVEL POR USUÁRIO + ASSISTÊNCIA COM OS — 2026-08-21

A Home agora pode ser montada individualmente pelo usuário Master, permitindo escolher quais blocos cada pessoa verá ao entrar no Atlas One. A mesma implementação evolui o fluxo existente de Assistência Técnica para separar chamados por responsável e gerar Ordem de Serviço.

Estado atual desta implementação:
- o botão verde `+ Novo` da barra superior foi ocultado para eliminar a duplicidade com o atalho `Novo orçamento` da Home;
- `Configurações > Usuários e Acesso` permite criar um usuário e, no mesmo formulário, escolher os módulos da sua Home;
- usuários existentes também podem ter a Home reconfigurada posteriormente nessa mesma tela;
- módulos disponíveis: `Orçamentos`, `Clientes`, `Kanban comercial`, `Minhas tarefas`, `Calendário`, `Notificações`, `Assistências` e `Indicadores`;
- a configuração é persistida em `configuracoes_gerais` com chave `home_usuario:<usuarioId>`, sem criar tabela ou migration nova;
- a Home passou a ser composta dinamicamente por `components/system/HomeDashboard.tsx`;
- os atalhos da faixa principal acompanham os módulos habilitados para o usuário;
- `Kanban comercial`, `Minhas tarefas`, `Calendário`, `Notificações` e `Assistências` possuem blocos próprios e independentes na Home;
- o menu operacional ganhou acesso direto a `Assistências`;
- ao habilitar Assistências para um funcionário, o Master pode definir `Somente as assistências abertas por ele` ou `Todas as assistências da empresa`;
- usuários Master sempre visualizam todas as assistências;
- a página `/assistencias` aplica o mesmo escopo, portanto um vendedor configurado como `próprias` não vê os chamados de outros usuários;
- o formulário `/assistencia` agora exige apenas o `Nome do cliente`; descrição, telefone, cidade, endereço, número, bairro e fotos são opcionais;
- ao digitar o nome na abertura da assistência, o Atlas pesquisa clientes já cadastrados e preenche automaticamente os dados encontrados;
- o Kanban de Assistências existente foi preservado; criação/edição/exclusão das colunas fica restrita ao Master;
- cada chamado possui sua Ordem de Serviço em `/assistencias/[id]/os`;
- quando uma assistência online é criada, `criarAssistenciaNoServidor` devolve o ID do chamado e o formulário abre automaticamente a OS com `?print=1`, acionando o diálogo de impressão/salvar PDF do navegador;
- a OS usa os dados da empresa e logo no cabeçalho, incluindo CNPJ quando disponível, além de nome do cliente, telefone/WhatsApp, endereço completo, problema, fotos, etapa e responsável pela abertura;
- a OS inclui áreas para técnico, data do atendimento, serviço executado, materiais/peças, observações e assinaturas;
- no Kanban, ao abrir qualquer chamado, a ação `Imprimir / PDF da OS` permite abrir e imprimir/salvar novamente a mesma OS a qualquer momento;
- se a assistência for criada offline, ela continua sendo guardada na fila local; após sincronizar, a OS pode ser aberta pelo Kanban para impressão;
- nenhuma migration e nenhuma alteração de schema nesta etapa.

## EM VALIDAÇÃO — HOME WHITE-LABEL + LOGO DA EMPRESA + ÚLTIMOS ORÇAMENTOS — 2026-08-21

A Home foi redesenhada a partir das referências visuais avaliadas com o usuário (incluindo W.Vetro), preservando a identidade própria do Atlas One e criando a primeira fundação white-label real da interface.

Estado atual desta implementação:
- `components/system/HomeExecutiveHero.tsx` agora usa uma faixa principal colorida com identidade da empresa, mantendo o Atlas One como produto e exibindo o nome da empresa cliente dentro da Home;
- o logo da empresa, quando configurado, aparece dentro da faixa principal; sem logo, a Home exibe um placeholder orientando a configuração;
- a cor principal da empresa pode ser definida e passa a personalizar a faixa da Home;
- a faixa permanece colorida tanto no tema claro quanto no tema escuro;
- os atalhos principais agora acompanham a configuração da Home por usuário;
- painel `Últimos orçamentos` mostra os 3 pedidos mais recentes com número, cliente, valor, status e data quando o módulo `Orçamentos` está habilitado;
- foi criada a tela master `Configurações > Empresa e Identidade` (`/configuracoes/empresa`) para cadastrar razão social/nome, nome fantasia, logo e cor principal;
- o upload do logo usa o bucket `fotos` já existente, pasta `empresa`, sem criar bucket novo;
- a identidade visual é persistida dentro da configuração JSON `dados_empresa`, preservando CNPJ, endereço, telefones, e-mail e demais dados já existentes;
- salvar os dados tradicionais da empresa também preserva `nomeFantasia`, `logoUrl` e `corPrincipal`, evitando que o cadastro atual apague a personalização;
- nenhuma migration e nenhuma alteração de schema nesta etapa.

## EM VALIDAÇÃO — TEMA CLARO COMPLETO NA HOME — 2026-08-21

Após validação visual real na tela da usuária Keila, foi identificado que a primeira versão do tema claro clareava a sidebar e o hero, mas mantinha os cards operacionais da Home escuros.

Estado atual desta correção:
- `app/atlas-theme.css` converte, no tema claro, os painéis baseados em `bg-slate-950` para superfície branca;
- bordas `border-slate-800` / `border-white/10` e divisórias internas passam para tons claros;
- superfícies internas `bg-white/[0.025]`, `bg-white/5` e `bg-white/10` recebem equivalentes claros;
- textos brancos e cinzas usados dentro desses painéis passam para tipografia escura/legível;
- hover de controles neutros também foi ajustado para o tema claro;
- cores semânticas de status (verde, azul, vermelho e violeta) continuam preservadas;
- nenhuma migration e nenhuma alteração de banco nesta etapa.

## EM VALIDAÇÃO — HOME RESPONSIVA + TEMA CLARO POR USUÁRIO — 2026-08-21

Estado atual desta implementação:
- `components/system/HomeExecutiveHero.tsx` é responsivo e evita o texto comprimido em larguras intermediárias;
- `components/Sidebar.tsx` possui alternância `Tema claro` / `Tema escuro`;
- a preferência é salva por usuário no navegador usando a chave `atlas-theme:<usuario.id>`;
- o tema claro clareia a sidebar e os painéis operacionais, mantendo a faixa white-label colorida;
- o tema escuro mantém a sidebar e os painéis operacionais escuros;
- `app/atlas-theme.css` também corrige contraste do título `Atlas One` e do nome do usuário na sidebar escura;
- nenhuma migration e nenhuma alteração de banco nesta etapa.

## EM VALIDAÇÃO — ORÇAMENTO COM TIPO LIVRE — 2026-08-21

O formulário de Orçamento Rápido agora permite cadastrar uma esquadria mesmo quando Linha / Modelo / Tipologia ainda não existem no catálogo técnico.

Estado atual desta implementação:
- `components/orcamento/SeletorEsquadriaInteligente.tsx` ganhou o campo **Tipo de esquadria / descrição livre**;
- ao preencher esse campo, o item passa a usar `tipo = outro` e grava a descrição em `tipoOutroTexto`, estrutura que já existia no orçamento;
- Linha e Modelo / Tipologia aparecem explicitamente como opcionais;
- o vendedor pode deixar Linha e Modelo vazios e enviar o orçamento usando apenas a descrição livre + demais campos obrigatórios do pedido;
- se o vendedor quiser informar uma Linha conhecida junto com a descrição livre, a troca da Linha preserva o texto digitado;
- ao escolher uma Tipologia cadastrada, o fluxo volta para o catálogo e limpa a descrição livre para evitar conflito;
- nenhuma migration e nenhuma alteração de banco nesta etapa.

Também permanece válido o estado anterior do Plano de Corte PC3: SU289/SU290 vinculados às figuras exatas do W.Vetro nº 994; TMC ainda precisa de figura técnica exata validada.