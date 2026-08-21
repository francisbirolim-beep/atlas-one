# IMPLEMENTATIONS.md — Atlas One

## 2026-08-21 — Home white-label, logo da empresa e últimos orçamentos — EM VALIDAÇÃO

Implementado:
- faixa principal da Home em verde/cor da empresa, inspirada nas referências avaliadas sem copiar a identidade de terceiros;
- nome da empresa e logo dinâmicos na faixa principal;
- placeholder orientativo quando ainda não existe logo configurado;
- quatro atalhos abaixo da faixa: `Novo orçamento`, `Novo cliente`, `Nova tarefa` e `Novo compromisso`;
- novo painel `Últimos orçamentos` com os 3 pedidos mais recentes, cliente, valor, status e data;
- nova tela master `Configurações > Empresa e Identidade` para razão social/nome, nome fantasia, logo e cor principal;
- upload do logo no bucket `fotos`, pasta `empresa`;
- dados de identidade persistidos dentro de `dados_empresa` e preservados quando o cadastro tradicional da empresa é salvo;
- faixa colorida mantida no tema claro; demais painéis continuam seguindo a alternância claro/escuro;
- sem migration e sem alteração de schema.

## 2026-08-21 — Tema claro completo nos painéis da Home — EM VALIDAÇÃO

Implementado após validação visual da usuária Keila:
- tema claro agora também cobre os painéis `Notificações e alertas`, `Minhas tarefas` e `Agenda / Calendário`;
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