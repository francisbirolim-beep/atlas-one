# IMPLEMENTATIONS.md — Atlas One

## 2026-08-22 — Editor Técnico de tipologias + fórmulas Suprema 2F–9F — EM VALIDAÇÃO

Implementado:
- nova rota `Engenharia > Editor Técnico` (`/engenharia/editor-tecnico`) para editar a configuração técnica sem alterar código-fonte;
- cada fórmula passa a ter `configuracao_chave`, nome de configuração, status (`em_desenvolvimento`, `em_validacao`, `validada`), versão, observações e fórmula própria de vidro;
- a antiga restrição de uma fórmula por tipologia foi evoluída para uma fórmula por `tipologia + configuração`, permitindo manter, por exemplo, mão-amiga comum e larga como receitas separadas;
- histórico automático em `engenharia_tipologia_formulas_corte_historico`: antes de uma alteração relevante o Atlas guarda snapshot da versão anterior e incrementa `versao`;
- editor permite substituir código de perfil usando o catálogo, alterar descrição, fórmula, quantidade, eixo e composição/origem do desconto, além de adicionar/remover peças;
- acessórios, reforços e variantes permanecem em `Engenharia > Receitas Técnicas`, com atalho direto a partir do novo editor;
- vidro ganhou fórmula declarativa própria de largura/altura, quantidade e descrição da composição do desconto no Editor Técnico;
- motor seguro de fórmulas ganhou `CEIL(expr)` para a regra validada de arredondar qualquer decimal sempre para cima;
- motor ganhou aliases `LF = Largura - 4` e `HF = Altura - 4`, preservando separadamente a folga total de encaixe da esquadria;
- resultados do motor agora podem carregar quantidade, eixo e composição do desconto; o Plano de Corte usa esses dados declarativos nas receitas novas, mantendo compatibilidade com o PC3 legado;
- cadastrada família Suprema com mão-amiga comum sem reforço: 2F=162, 3F=180, 4F=198, 5F=216, 6F=234, progressão de +18 mm por folha; vidro = desconto estrutural + 6 mm por folha;
- cadastrada família Suprema com mão-amiga larga sem reforço: 2F=181, 3F=222, 4F=263, 5F=304, 6F=345, 7F=386, 8F=427, 9F=468, progressão de +41 mm por folha; vidro = desconto estrutural + 6 mm por folha;
- PC2 comum entrou como `Validada` e ativa, pois a fórmula já havia sido confirmada em duas medidas; demais sementes entram `Em validação` e inativas;
- PC2 larga registra SU243 interno, SU242 externo e SU280 lateral, com teste 2000×2100 resultando em travessas/baguete horizontal 908 mm e vidro 902×1933 mm;
- 7F/8F/9F recebem somente a matemática das folhas/vidros validada pelo usuário; marcos/trilhos compostos não são gerados automaticamente até validação estrutural específica;
- criadas tipologias técnicas de 8 e 9 folhas, sem associação automática a uma linha comercial por existir inconsistência histórica em `linha_tipologias` que deve ser tratada separadamente;
- o registro PC3 legado W.Vetro #994 foi preservado ativo por compatibilidade, mas rotulado `Em validação`;
- migrations `engenharia_editor_formulas_suprema` e `formula_legacy_status` aplicadas no Supabase de produção;
- preview da PR #232 compilou com sucesso na Vercel antes da liberação para teste.

## 2026-08-22 — Lista de vidros e folgas no Plano de Corte — EM VALIDAÇÃO

Implementado:
- campo `Vidro / composição` na Engenharia com sugestões vindas de produtos ativos organizados como categoria/grupo `Vidro`, mantendo digitação livre como fallback;
- campos independentes `Folga na largura do vidro (mm)` e `Folga na altura do vidro (mm)`, com suporte a valores decimais;
- botão principal ajustado para `Gerar plano de corte + vidros`;
- nova seção `Lista de Vidros` no relatório e na impressão/PDF, mostrando composição, medida-base, folga de cada eixo, medida de corte e quantidade;
- helper `lib/planoCorteVidros.ts` para centralizar catálogo e cálculo do vidro;
- na PC3 Suprema, a regra em validação usa os baguetes SU102 horizontal/vertical presentes no plano como medida-base e desconta as folgas informadas;
- quantidade da PC3 inferida pelos pares de baguetes e multiplicada pela quantidade de esquadrias do plano;
- tipologias sem referência técnica de vidro exibem aviso e não recebem medida inventada pela dimensão total da esquadria;
- nenhuma migration e nenhuma alteração de schema.

## 2026-08-22 — Cadastro do cliente como central operacional — EM VALIDAÇÃO

Implementado:
- nova `Central do cliente` dentro de `/clientes/[id]`;
- histórico de vendas confirmadas obtido por `medicoes_finais.cliente_id`, com referência ao orçamento e valor quando disponíveis;
- histórico de assistências/manutenções obtido por `assistencias.cliente_id`, exibindo data, status, técnico, duração e links para OS/PDF e Kanban;
- cards espelho de Assistência (`orcamentos.eh_assistencia`) removidos da lista de propostas do cadastro para não contar/mostrar o mesmo chamado como orçamento;
- atalhos para `Novo orçamento` e `Nova assistência / manutenção` diretamente no cadastro do cliente;
- Orçamento Rápido aceita `?cliente=<id>`, preenche os dados do cliente e envia o `cliente_id` explícito para garantir o vínculo correto;
- Assistência aceita `?cliente=<id>`, preenche os dados do cliente e envia o `cliente_id` explícito para garantir o vínculo correto;
- `DadosOrcamentoForm` e `DadosAssistenciaForm` receberam `clienteId` opcional, preservando compatibilidade com os fluxos antigos;
- quando não há ID explícito, continua valendo a busca/criação existente de cliente;
- sem migration e sem alteração de schema.

## 2026-08-21 — Assistência em campo com rota, GPS e tempo — EM VALIDAÇÃO

Implementado:
- ações `WhatsApp`, `SMS` e `Copiar` logo após gerar o link do técnico;
- mensagem de envio já inclui o link da assistência e o nome do técnico;
- na tela externa, telefone do cliente com ação de ligação e WhatsApp;
- endereço completo com `Abrir no Google Maps` e `Copiar endereço`;
- botão explícito `Iniciar assistência` para check-in quando o técnico chega ao local;
- solicitação de geolocalização pelo navegador no início, sempre dependente de permissão do técnico;
- GPS opcional: negar a localização não bloqueia o atendimento;
- início grava horário no servidor, técnico/data, status `em_atendimento` e move automaticamente o chamado para a coluna operacional de atendimento/andamento;
- cronômetro ao vivo no celular do técnico, calculado a partir do horário persistido no servidor;
- conclusão tenta capturar novamente o GPS, grava horário final, duração total, status `resolvido` e move automaticamente para a coluna final;
- Kanban interno sincroniza as assistências a cada 12 segundos para refletir movimentações feitas pelo técnico sem refresh manual;
- cards mostram `Em campo HH:MM:SS` durante execução e `Duração HH:MM:SS` após conclusão;
- modal interno exibe técnico, início, fim, duração e links para o ponto de GPS de início/conclusão no Google Maps quando disponíveis;
- não há rastreamento contínuo nem em segundo plano; localização é solicitada somente no início e no fim;
- migration `assistencia_gps_tempo_execucao` aplicada em produção no Supabase, versão `20260821220855`, com campos nullable para horários, duração e coordenadas de início/fim.

## 2026-08-21 — Link do técnico + assinaturas digitais + PDF direto da OS — EM VALIDAÇÃO

Implementado:
- painel `Acesso do técnico` no modal da assistência para gerar links individuais com nome do técnico, telefone opcional e validade configurável;
- token de acesso externo gerado aleatoriamente e persistido somente como hash SHA-256;
- links podem ser revogados e possuem expiração;
- nova rota pública `/assistencia/acesso/[token]`, sem exigir login do Atlas, limitada ao chamado associado ao token válido;
- tela externa mobile-first já mostra dados do cliente, endereço, problema e fotos;
- técnico pode registrar data do atendimento, serviço realizado, materiais/peças e observações;
- assinatura digital do técnico e do cliente em canvas, compatível com toque e mouse;
- conclusão exige ambas as assinaturas e salva o atendimento de volta em `assistencias`;
- Ordem de Serviço passa a exibir os dados preenchidos e as assinaturas reais;
- ação `Salvar PDF` adicionada à OS usando jsPDF para gerar download direto de arquivo, separada da ação `Imprimir`;
- impressão da OS oculta controles fixos do Atlas, inclusive `Voltar`, `Início` e `Favoritos`;
- `MobileNavigationControls` também recebeu `print:hidden`;
- migration de produção `assistencia_link_tecnico` aplicada no Supabase, com novos campos de atendimento/assinaturas e tabela `assistencia_acessos_externos`;
- histórico local da migration `engenharia_formulas_corte_v1` reconciliado com a versão remota `20260820160019`, sem alteração funcional de schema.

## 2026-08-21 — OS de Assistência A4 + data ajustável — EM VALIDAÇÃO

Implementado:
- impressão da OS compactada para A4 retrato com margem de 6 mm;
- bordas dos quadros, campos internos, separadores e assinaturas escurecidas para melhorar a leitura no papel;
- alturas e espaçamentos reduzidos especificamente em `@media print` para concentrar o documento em uma única folha;
- até 6 fotos são reorganizadas em uma faixa horizontal compacta na impressão;
- cabeçalho, resumo, dados do cliente, problema, técnico/data, serviço, materiais, observações e assinaturas preservados;
- impressão automática atrasada para 650 ms, reduzindo o risco de abrir o diálogo antes do logo/fotos carregarem;
- campo `Data da assistência` incluído na abertura de um novo chamado, preenchido inicialmente com o dia atual;
- data pode ser alterada antes de salvar e também posteriormente no modal do chamado no Kanban, por `Salvar data`;
- card e Ordem de Serviço passam a refletir a data ajustada;
- sem migration e sem alteração de schema: a data reaproveita `assistencias.created_at`.

## 2026-08-21 — Navegação organizada + Central de Administração + Central de Cadastros — EM VALIDAÇÃO

Implementado:
- sidebar reorganizada em grupos operacionais (`Geral`, `Comercial` e `Operações`);
- busca `Buscar no menu...` para localizar módulos e funções administrativas por palavras-chave;
- bloco `Administração` recolhível para usuário Master;
- nova `/administracao` como mapa das principais configurações do sistema;
- nova `/cadastros` com pesquisa própria e atalhos separados para Produtos, Linhas, Materiais, Fornecedores, Produtos por Linha, Precificação, Unidades Pendentes, Receitas Técnicas, Fórmulas de Corte e Campos adicionais;
- `/cadastro` antigo preservado como `Cadastros Avançados`, sem remover funcionalidades ainda não separadas;
- nenhuma rota anterior removida;
- sem migration e sem alteração de schema.

## 2026-08-21 — Assistência gera OS para impressão/PDF automaticamente — EM VALIDAÇÃO

Implementado:
- `criarAssistenciaNoServidor` agora retorna também o ID da assistência recém-criada;
- ao concluir uma nova assistência online, o Atlas abre automaticamente `/assistencias/[id]/os?print=1`;
- a tela da OS detecta `print=1` e aciona o diálogo de impressão do navegador, permitindo imprimir em papel ou salvar em PDF;
- cabeçalho da OS usa logo/nome da empresa e passa a exibir CNPJ quando configurado;
- bloco de cliente destaca nome, telefone/WhatsApp e endereço completo;
- problema relatado, fotos, etapa, abertura e responsável continuam registrados na OS;
- no Kanban de Assistências, a ação do chamado foi renomeada para `Imprimir / PDF da OS`, deixando explícita a possibilidade de reimpressão a qualquer momento;
- assistências criadas offline continuam na fila local e podem ter a OS impressa pelo Kanban após a sincronização;
- sem migration e sem alteração de schema.

## 2026-08-21 — Home configurável por usuário + Assistência com OS — EM VALIDAÇÃO

Implementado:
- remoção visual do botão `+ Novo` da topbar, mantendo `Novo orçamento` na Home;
- nova configuração individual de Home em `Configurações > Usuários e Acesso`;
- criação de usuário com seleção dos módulos que aparecerão na sua tela inicial;
- edição posterior da Home para usuários existentes;
- módulos configuráveis: Orçamentos, Clientes, Kanban comercial, Minhas tarefas, Calendário, Notificações, Assistências e Indicadores;
- persistência sem migration em `configuracoes_gerais`, chave `home_usuario:<usuarioId>`;
- novo `HomeDashboard` para montar a Home dinamicamente;
- novos blocos de Home para Kanban, tarefas, calendário, notificações e assistências;
- Assistências adicionadas à navegação operacional;
- escopo de Assistências por usuário: `próprias` ou `todas`; Master sempre vê todas;
- `/assistencias` passou a respeitar o escopo do usuário;
- formulário de nova assistência exige apenas nome do cliente e pesquisa clientes existentes para autopreenchimento;
- Kanban de Assistências preservado, com administração das etapas restrita ao Master;
- geração de Ordem de Serviço por chamado em `/assistencias/[id]/os`;
- OS imprimível/salvável em PDF, com dados da empresa, cliente, problema, fotos, etapa, técnico, serviço, materiais, observações e assinaturas;
- sem migration e sem alteração de schema.

## 2026-08-21 — Home white-label, logo da empresa e últimos orçamentos — EM VALIDAÇÃO

Implementado:
- faixa principal da Home em verde/cor da empresa, inspirada nas referências avaliadas sem copiar a identidade de terceiros;
- nome da empresa e logo dinâmicos na faixa principal;
- placeholder orientativo quando ainda não existe logo configurado;
- atalhos da Home agora seguem a configuração individual do usuário;
- painel `Últimos orçamentos` com os 3 pedidos mais recentes, cliente, valor, status e data quando habilitado;
- nova tela master `Configurações > Empresa e Identidade` para razão social/nome, nome fantasia, logo e cor principal;
- upload do logo no bucket `fotos`, pasta `empresa`;
- dados de identidade persistidos dentro de `dados_empresa` e preservados quando o cadastro tradicional da empresa é salvo;
- faixa colorida mantida no tema claro; demais painéis continuam seguindo a alternância claro/escuro;
- sem migration e sem alteração de schema.

## 2026-08-21 — Tema claro completo nos painéis da Home — EM VALIDAÇÃO

Implementado após validação visual da usuária Keila:
- tema claro cobre os painéis operacionais da Home;
- painéis `bg-slate-950` passam para fundo branco no tema claro;
- bordas, divisórias e superfícies internas recebem tons claros;
- textos neutros internos passam para cores escuras com contraste adequado;
- hovers neutros foram adaptados ao fundo claro;
- cores semânticas de status permanecem preservadas;
- sem alteração de banco e sem migration.

## 2026-08-21 — Home responsiva e tema claro por usuário — EM VALIDAÇÃO

Implementado:
- correção do hero da Home em larguras intermediárias de desktop, evitando texto comprimido;
- opção `Tema claro` / `Tema escuro` na sidebar;
- preferência persistida por usuário no navegador (`atlas-theme:<usuario.id>`), sem migration;
- `app/atlas-theme.css` controla as variações visuais de sidebar e painéis;
- correção de contraste do título `Atlas One` e do nome do usuário na sidebar escura.

## 2026-08-21 — Tipo de esquadria livre no Orçamento Rápido — EM VALIDAÇÃO

Implementado:
- novo campo visível `Tipo de esquadria / descrição livre` no seletor do orçamento;
- o campo reaproveita `tipoOutroTexto` e define `tipo = outro`, sem criar schema paralelo;
- Linha e Modelo / Tipologia passam a ser apresentados como opcionais;
- descrição livre pode ser usada sem Linha e sem Modelo, permitindo enviar itens ainda não cadastrados tecnicamente;
- uma Linha opcional pode ser escolhida sem apagar a descrição livre;
- escolher uma Tipologia cadastrada limpa o texto livre e volta ao fluxo técnico normal;
- sem alteração de banco e sem migration.

## 2026-08-20 — Figuras exatas SU289 e SU290 no Plano PC3 — VALIDADO VISUALMENTE

Implementado:
- extração dos desenhos de SU289 e SU290 diretamente da coluna `Figura` do orientativo W.Vetro nº 994 da configuração `*SUCB-PC3-01EF`;
- inclusão de `public/perfis/plano-corte/SU289.png` e `SU290.png`;
- `lib/planoCortePerfis.ts` vincula os dois códigos aos respectivos recortes;
- sem alteração de fórmulas, cortes, quantidades, posições, pesos ou banco.

Pendente técnico: TMC ainda precisa de desenho exato validado por código.