# CURRENT_STATE.md — Atlas One

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