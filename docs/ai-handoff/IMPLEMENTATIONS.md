# IMPLEMENTATIONS.md — Atlas One

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