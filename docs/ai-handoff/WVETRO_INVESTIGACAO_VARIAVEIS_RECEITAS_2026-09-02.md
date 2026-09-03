# Investigação — onde estão as variáveis/fórmulas/receitas técnicas das tipologias no W.Vetro (2026-09-02)

Investigação feita em branch separada (`investigacao/wvetro-receitas-variaveis-v1`),
sem tocar em checkpoint/cursor/retry/pendências/execução da carga histórica nem na
lógica da PR #311 (ChatGPT está trabalhando nela). Só leitura de código e do banco
de produção (Supabase `urtqbvjpwnrfaayolymt`), mais um endpoint de diagnóstico novo,
também só leitura e restrito a Master, que ainda não foi executado contra a API
real (este ambiente não tem as credenciais W.Vetro configuradas — ver seção E).

## Resumo executivo

Não encontramos, nem no código já escrito nem na documentação pública da API, um
endpoint de "cálculo"/"composição paramétrica"/"engenharia" que devolva a receita
de uma tipologia a partir de `Linha + Modelo + Largura + Altura + Opções`. O que
existe são dois tipos de fonte:

1. **Catálogo de produto** (`/Produtos/produtoByKey`) — identidade e preço de
   perfil/acessório/esquadria, sem composição nem fórmula.
2. **Histórico de vendas** (`/vendas/pedidos`, `/vendas/orcamentos`) — a
   composição *já calculada* pelo W.Vetro para uma venda específica (perfis,
   acessórios, vidros, com posição/corte/quantidade), mais campos de contexto do
   item (`Largura`, `Altura`, `Ambiente`, `Nome`, `Codigo`) que a extração atual do
   Atlas ignora.

Ou seja: a API expõe o **resultado** do cálculo (quanto de cada perfil, em qual
posição, com qual corte, para uma esquadria vendida com tal largura/altura), não a
**fórmula** em si. A fórmula/regra provavelmente vive dentro do sistema W.Vetro
(motor de cálculo do produto, provavelmente configurado no cadastro de produto tipo
"E" pelo backoffice deles) e não tem, até onde a documentação pública mostra, um
endpoint que a exponha estruturada. A forma mais direta de capturá-la é observar o
próprio frontend do W.Vetro calculando (seção E) e/ou comparar sistematicamente
várias vendas históricas da mesma tipologia com dimensões diferentes (seção D2).

## A. O que a API já entrega

Baseado no código (`lib/wvetroApi.ts`, `lib/wvetroBaseTecnicaServer.ts`,
`lib/wvetroCatalogoCompletoServer.ts`) e na documentação pública já mapeada em
`WVETRO_API_MAPPING.md` (Postman: `documenter.getpostman.com/view/26205597/2sB34kFfGz`,
dados de exemplo fake, nomes/tipos de campo reais):

| Endpoint | Uso hoje no Atlas | O que devolve |
|---|---|---|
| `GET /Integracao/ValidarUsuario` | Autenticação (JWT 24h) | token |
| `GET /Produtos/produtoByKey?Produtotipo=A\|P\|E&Produtocodigo=...` | Catálogo perfil/acessório (`wvetroCatalogoCompletoServer.ts`); esquadria (`E`) tentado em `sincronizarCatalogoEsquadriasWVetro` | Identidade do produto: código, descrição, linha, espécie, tipo, unidade, NCM, ativo, URL de foto |
| `GET /Produtos/linhas` | Não usado na carga (só declarado) | `LinhaId`, `LinhaNome` |
| `GET /Produtos/cores` | Não usado na carga (só declarado) | Cores/núcleos: nome, espessura, peso, NCM |
| `GET /vendas/orcamentos?Dtcadastroinicial=&Dtcadastrofinal=` | **Principal fonte da carga histórica** | Pedidos/orçamentos do período, cada um com `Itens[]` |
| `GET /vendas/pedidos?Dtvendainicial=&Dtvendafinal=` | Idem, mesma estrutura | Idem |
| `GET /compras/nf`, `GET /compras/itemNf` | Não usado na carga de base técnica | Notas de entrada / itens de NF |
| `POST /pessoa/*`, `POST /estoque/movimentoEstoque` | Não usado | Fora do escopo de tipologia |

Dentro de cada item de `vendas/orcamentos` e `vendas/pedidos` (`Itens[]`), a API
devolve, por item vendido:

- `Linha`, `Modelo` — usados hoje para formar a chave de tipologia.
- `Nome`, `Codigo`, `Largura`, `Altura`, `Ambiente`, `ValorTotal`, `Qtde` — **não
  usados** (achado da rodada anterior, 2026-09-01, já documentado em
  `WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01-v2.md`).
- `Perfil[]`: `SeuCodigo`, `Codigo`, `Nome`, `Cor`, `Medida`, `Qtde`, `CustoVlr`,
  `VendaVlr`, `Ncm`, `Posicao`, `Corte` — usados hoje (é a base de
  `wvetro_tipologia_componentes`).
- `Acessorios[]`: `SeuCodigo`, `Codigo`, `Nome`, `Cor`, `Qtde`, `CustoVlr`,
  `VendaVlr`, `Ncm` — usados.
- `Vidros[]`: `Codigo`, `Especificacao`, `Largura`, `Altura`, `Qtde`, `M2`,
  `TipoFixacao`, `Lado`, `Posicao`, `CustoVlr`, `VendaVlr`, `Ncm` — usados.

A documentação pública também menciona `pedidoPorChave` (detalhe de um pedido
específico) — **não implementado em `lib/wvetroApi.ts`**, é um endpoint conhecido
mas nunca chamado pelo Atlas. Pode valer a pena testá-lo: um pedido específico
"aberto" no detalhe pode expor mais estrutura por item do que a listagem por
período.

A tentativa de listar a WebFetch da documentação Postman completa (para varrer
por endpoints de "cálculo"/"engenharia"/"fórmula" fora do que já está mapeado)
não retornou conteúdo — a página é renderizada via JavaScript e o fetch
automatizado só trouxe metadados. **Recomendação prática**: abrir esse link
manualmente no navegador (é a documentação pública, não exige a sessão do
sistema W.Vetro) e revisar as pastas da coleção Postman à procura de qualquer
rota fora das já mapeadas aqui — nenhum agente de IA teve acesso ao conteúdo
completo dela até agora, só ao que já havia sido transcrito em
`WVETRO_API_MAPPING.md` em 16/08/2026.

## B. O que estamos recebendo mas não utilizando

Confirmado por leitura de código (`itensHistoricos()` em
`lib/wvetroBaseTecnicaServer.ts` só lê `item.Linha`/`item.Modelo` e descarta o
resto do objeto) e por consulta ao banco (nenhuma tabela guarda o `Itens[]` bruto
de `vendas/pedidos`/`vendas/orcamentos` — só os componentes já extraídos):

- `Largura`, `Altura` do item (não do vidro) — presentes em 100% da amostra
  testada na rodada anterior (28/28 itens de um dia).
- `Ambiente` — 96% da amostra (27/28).
- `Nome` do item — mais descritivo que `Modelo` (ex.: carrega "04 PLANOS", "COM
  VENEZIANA" que `Modelo` sozinho não tem).
- `Codigo` do item, `ValorTotal`, `Qtde` do item.
- `/Produtos/linhas` e `/Produtos/cores` — funções já existem
  (`listarLinhasWVetro`, `listarCoresWVetro`) mas nunca são chamadas por nenhum
  fluxo da carga ou da tela.
- `pedidoPorChave` — endpoint conhecido pela documentação pública, nunca
  implementado nem chamado.

Nenhum desses é "variável de tipologia" pronta — são contexto por ocorrência de
venda (dimensão, ambiente, texto mais rico). Úteis para tentar reconstruir
correlação estatística entre dimensão e componente (hipótese, não fórmula
oficial — ver regra fundamental do pedido do usuário), e para dar mais matéria-
prima à regex/heurística de variáveis do que só `Modelo`.

## C. Onde provavelmente estão as variáveis — evidências

A função `fn_wvetro_reconstruir_variaveis_explicitas()` (Postgres, ver definição
completa no histórico do banco) tenta reconhecer 10 variáveis — folhas, montagem,
trilho, contramarco, arremate, fechadura, puxador, mão-amiga, reforço, roldana —
**inteiramente por regex sobre o texto livre `modelo_raw`** (ex.:
`'([0-9]{1,2})\s*folhas?'`, `'%sem fechadura%'`, `'%com contramarco%'`). Isso
confirma, por evidência direta de código, que:

- As variáveis que o Atlas reconstrói hoje **não vêm de um campo estruturado da
  API** — vêm de tentar decompor a string livre `Modelo` que o vendedor W.Vetro
  digitou ou escolheu de uma lista pré-formatada.
- Das 10 variáveis, só "folhas" bate consistentemente nos dados reais (59
  referências têm essa variável; nenhuma das outras 9 aparece hoje na base) —
  ou porque o texto de `Modelo` realmente não menciona as outras 9 na maioria
  dos casos, ou porque os padrões de regex não cobrem a forma real como
  aparecem.
- `Nome` (não usado) tende a ser mais descritivo que `Modelo` — é candidato a
  melhorar a taxa de match das outras 9 variáveis sem precisar de nenhum
  endpoint novo, só ajustando a extração para também rodar a regex sobre
  `item.Nome`.

Nenhuma tabela (`wvetro_produtos_snapshot`, `wvetro_referencias_componentes`,
`wvetro_tipologia_componentes`, `wvetro_referencias_tipologias`) tem coluna ou
campo dentro de `payload`/`dados_origem` que pareça "fórmula", "expressão" ou
"regra condicional" — inspecionei o payload realmente gravado em
`wvetro_produtos_snapshot.payload` (produto tipo perfil, ex. `03.26.592`): só
tem identidade (`ProdutoCodigo`, `ProdutoDescricao`, `LinhaNome`, `TipoNome`,
`Unidade`, `ProdutoNCM`, `URL`), nada de composição.

Confirmação adicional: `sincronizarCatalogoEsquadriasWVetro()` tenta usar
`produtoByKey?Produtotipo=E` (esquadria) sem código para listar o catálogo
completo de esquadrias/tipologias, mas **a instalação não suporta essa consulta
sem código** (`unicos.size <= 1` → `suportado: false`) — por isso
`wvetro_produtos_snapshot` não tem nenhuma linha `tipo='E'` hoje (confirmado por
`select count(*) ... group by tipo` no banco de produção). Isso é evidência de
que o catálogo de produto por tipo "E" não é uma rota viável para descobrir a
receita de todas as tipologias de uma vez — teria que ser por código individual
(`Produtocodigo=`), um por um, e ainda assim não há garantia de que devolva mais
do que identidade.

## D. Existe endpoint de cálculo/composição?

**Não encontrado.** Nem no código já escrito, nem na documentação pública já
mapeada (`WVETRO_API_MAPPING.md`), há um endpoint que receba
`{Linha, Modelo, Largura, Altura, Opções}` e devolva a composição calculada. Os
candidatos mais próximos são:

- `/vendas/pedidos` e `/vendas/orcamentos` — devolvem a composição **já
  calculada de uma venda específica**, não uma simulação a pedido. É "receita
  aplicada", não "motor de receita". Cada resposta é o resultado, não a fórmula.
- `pedidoPorChave` — vale testar (D2), mas é detalhe de um pedido específico já
  existente, mesma limitação.
- Nenhuma rota tipo `/engenharia/*`, `/calculo/*`, `/composicao/*`,
  `/formula/*` aparece na documentação pública nem no código.

### D2. Prova de conceito preparada, ainda não executada

Durante a investigação foi criado temporariamente um endpoint de diagnóstico ampliado —
`GET /api/integracoes/wvetro/base-tecnica/investigacao-variaveis` — que:

- Restrito a Master (mesmo padrão do endpoint de 2026-09-01, já removido).
- Só leitura, não grava nada, não participa da carga (PR #306/#311).
- Aceita `?data=AAAA-MM-DD` (chaves brutas + achatadas de `pedidos`/`orcamentos`
  do dia, incluindo um segundo nível dentro de `Perfil[]`/`Acessorios[]`/
  `Vidros[]` de um item de exemplo), `?produtoTipo=A|P|E&produtoCodigo=...`
  (ficha de um produto específico — inclui testar `E` com código, ao contrário
  do que `sincronizarCatalogoEsquadriasWVetro` já provou não funcionar sem
  código) e `?linhas=1` (catálogo de linhas).
- Filtra as chaves achatadas por palavras-chave (`variavel`, `formula`, `regra`,
  `condicao`, `calculo`, `opcao`, `configuracao` etc.) para destacar qualquer
  campo suspeito sem exigir leitura manual de centenas de chaves.

**Este ambiente de investigação não tem as credenciais W.Vetro configuradas**
(`.env.local` não existe aqui, só `.env.example`) — não consegui chamar a API
real a partir daqui. O endpoint passou no typecheck durante a investigação
(`npx tsc --noEmit`), mas só pode ser exercitado por quem tiver acesso ao
preview/produção autenticado como Master. Sugestão de teste, quando o usuário
tiver disponibilidade:

```
GET /api/integracoes/wvetro/base-tecnica/investigacao-variaveis?produtoTipo=E&produtoCodigo=<código de uma esquadria conhecida>
GET /api/integracoes/wvetro/base-tecnica/investigacao-variaveis?data=2025-09-23
```
(o segundo repete o dia já testado na rodada anterior, mas agora também abre o
segundo nível dentro de cada componente do item, e filtra por palavra-chave.)

Isso era apenas prova de conceito e foi removido da branch antes do merge, para não levar uma rota temporária de investigação à `main`.

## E. O que precisamos capturar manualmente — procedimento DevTools

Esta é a parte mais promissora, segundo o próprio usuário: capturar o Network do
navegador enquanto o W.Vetro monta um orçamento de verdade. Nenhum agente de IA
tem acesso à sessão do sistema W.Vetro (login da empresa) — só o usuário pode
executar isto.

### Preparação

1. Abra o Google Chrome, faça login normalmente no sistema W.Vetro com a conta da
   Esquadrifácio.
2. Abra o DevTools (`F12` ou `Ctrl+Shift+I` / `Cmd+Option+I` no Mac).
3. Vá na aba **Network**.
4. Marque **Preserve log** (o W.Vetro pode navegar entre telas/recarregar
   parcialmente; sem isso, o histórico de requests some).
5. No filtro de texto do Network, digite `wvetro.com.br` ou `api/` para reduzir
   ruído de assets estáticos (imagens, CSS, fontes). Se o filtro por método
   existir na sua versão do Chrome, deixe **Fetch/XHR** marcado (é onde chamadas
   de API aparecem — não em Doc/JS/CSS/Img).
6. Limpe o log atual (ícone de "proibido"/lixeira) para começar do zero.

### Roteiro de captura (repita para cada caso do experimento controlado, seção F)

1. Inicie um **novo orçamento** no W.Vetro.
2. Adicione uma **esquadria**.
3. Escolha a **tipologia** (Linha + Modelo) — anote exatamente qual.
4. Informe **Largura** e **Altura** — anote os valores exatos.
5. Escolha as **opções** disponíveis (fechadura, trilho, contramarco etc., o que
   estiver visível na tela) — anote quais foram marcadas.
6. Clique em **calcular/gerar composição** (ou o botão equivalente que faz o
   sistema montar a lista de perfis/acessórios/vidros).
7. Visualize a **composição** resultante na tela.
8. Se disponível, gere a **lista de corte**.

### O que olhar no Network depois de cada passo 6

- Procure a(s) requisição(ões) que aconteceram no momento exato do clique em
  "calcular". Normalmente é a mais demorada ou a que aparece logo depois do
  clique, com método `POST` ou `GET` e um nome de rota que sugira cálculo,
  composição, corte, ficha técnica.
- Clique na requisição e abra:
  - **Headers** → confirme a URL completa e o método.
  - **Payload / Request** (no Chrome moderno pode aparecer como "Payload" ou
    "Request"): aqui deve estar o que foi enviado — provavelmente algo como
    `{ Linha, Modelo, Largura, Altura, opções escolhidas }` ou IDs equivalentes.
    **Isto é o que mais nos interessa.**
  - **Response**: a composição calculada devolvida — perfis, acessórios,
    vidros, quantidades, cortes. Compare com o que a tela mostrou.
- Repita esse clique em **Copy → Copy as cURL** para essa requisição específica
  — isso gera um comando que inclui método, URL, headers e corpo, fácil de
  colar depois.

### Como exportar tudo

- Com **Preserve log** marcado e o fluxo completo (passos 1–8) já feito, clique
  com o botão direito em qualquer requisição da lista → **Save all as HAR with
  content** (ou o ícone de exportação/seta para baixo no topo do painel
  Network). Isso salva um arquivo `.har` com todas as requisições, headers,
  payloads e respostas da sessão de captura.

### Dados sensíveis a remover antes de compartilhar (HAR ou cURL)

Antes de enviar o HAR ou o cURL para análise (para mim ou para qualquer outra
pessoa), remova/mascare:

- O **token JWT** — aparece no header `token` (ou `Authorization`) de toda
  requisição. Substitua por algo como `TOKEN_REMOVIDO`.
- **Cookies de sessão**, se houver, no header `Cookie`.
- Qualquer **senha** que apareça em algum payload de login, se o HAR
  acidentalmente capturar o login em si.
- Dados de **clientes reais** no payload/response (nome, CPF/CNPJ, endereço,
  telefone) — se o orçamento de teste usar um cliente real, prefira recriar o
  teste com um cliente fictício/de teste, ou apagar manualmente esses campos do
  HAR antes de compartilhar (é um arquivo texto/JSON, dá para editar).
- **Valores comerciais sensíveis** (preço de custo, margem), se preferir não
  compartilhar isso amplamente — mantenha se for só para análise interna.

O HAR é um arquivo JSON grande; pode ser aberto em qualquer editor de texto para
revisar/editar antes de enviar.

## F. Estratégia para trazer isso para o Atlas (proposta, não implementada)

Estrutura que separa claramente **referência histórica** (o que já observamos
sendo vendido) de **receita técnica validada** (o que a engenharia confirmou
como regra oficial) — mantendo o padrão que a tela do explorador
(`/configuracoes/integracoes/wvetro/base-tecnica/tipologias`) já rotula
explicitamente hoje:

```
Tipologia (Atlas)
 ├─ Variáveis (o que pode variar nessa tipologia)
 │   ├─ REFERÊNCIA HISTÓRICA: valores distintos observados por variável
 │   │   (ex.: "folhas" ∈ {2,3,4}, extraído por regex de Modelo/Nome —
 │   │   já existe, tabela wvetro_referencias_variaveis)
 │   └─ RECEITA VALIDADA: lista oficial de opções da variável, aprovada
 │       manualmente (engenharia_variaveis / engenharia_variavel_opcoes —
 │       já existe a tabela, falta popular por tipologia)
 ├─ Regras (condições: "se fechadura=sim → usar montante X")
 │   └─ Novo — hoje não existe estrutura para isso. Só nasce depois que o
 │       Network do W.Vetro (seção E) ou uma comparação controlada (seção
 │       D2/experimento abaixo) revelar um caso condicional real.
 ├─ Fórmulas (corte/quantidade em função de Largura/Altura/variáveis)
 │   └─ engenharia_tipologia_formulas_corte já existe (2 tipologias ativas)
 │       — é o destino final, mas cada fórmula só entra aqui por validação
 │       manual da engenharia, nunca por inferência automática do histórico
 ├─ Perfis / Acessórios / Vidros (componentes)
 │   └─ REFERÊNCIA HISTÓRICA: wvetro_tipologia_componentes (composição
 │       agregada observada, com posições/cortes distintos) — já existe
 ├─ Cortes (regras de corte por componente)
 │   └─ hoje é só "valores distintos observados" (campo cortes[] em
 │       wvetro_tipologia_componentes); fórmula de corte oficial vai para
 │       engenharia_tipologia_formulas_corte quando validada
 └─ Custos
     └─ já existe: custo_min/max/ultimo, venda_min/max/ultimo, refletido em
        produtos.custo_wvetro_ultimo
```

Pontos-chave da proposta (a validar com o usuário antes de qualquer
implementação):

1. **Nunca promover automaticamente** referência histórica para receita
   validada — os rótulos e o fluxo manual que já existem na tela do explorador
   continuam sendo o único caminho.
2. Se a captura de Network (seção E) revelar um endpoint de cálculo real, o
   próximo passo natural é registrar a *requisição e resposta de exemplo* como
   documentação (não como código ainda), e só depois desenhar uma tabela de
   "regras condicionais" nova — hoje não faz sentido criar essa tabela sem
   nenhuma evidência de como as condições realmente se expressam.
3. Se a captura de Network **não** revelar nada aproveitável (ex.: o cálculo
   acontece só no backend do W.Vetro sem endpoint de request/response claro, ou
   os dados retornados não batem com o que a tela mostra), a alternativa é
   expandir a extração histórica para gravar `Largura`/`Altura`/`Ambiente`/
   `Nome` por ocorrência (já registrado como achado pendente de decisão em
   `WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01-v2.md`) e tentar correlação
   estatística — sempre tratada como hipótese, nunca como fórmula oficial, até
   validação manual da engenharia.

## Experimento controlado (D2/E) — roteiro pronto para o usuário preencher

Uma tipologia conhecida, variando um fator por vez, registrando request payload,
response e lista de corte de cada caso (usar o procedimento da seção E):

| Caso | Linha/Modelo | Largura | Altura | Opções | O que muda vs. caso anterior |
|---|---|---|---|---|---|
| A (base) | Suprema / porta correr 3 folhas | 2000 | 2500 | nenhuma opção extra | — |
| B | igual A | **3000** | 2500 | nenhuma | só largura |
| C | igual A | 2000 | **3200** | nenhuma | só altura |
| D | igual A | 2000 | 2500 | **+ fechadura** | só opção fechadura |
| E | igual A | 2000 | 2500 | **+ outra opção disponível** | só essa opção |

Depois de preenchido (idealmente com os HARs/cURLs de cada caso em anexo),
comparar componente a componente: quais perfis mudaram de quantidade/corte só
por causa da largura (candidatos a fórmula "corte = f(Largura)"), quais só por
causa da altura, e quais componentes só aparecem/desaparecem conforme a opção
marcada (candidatos a regra condicional).

## Atualização 2026-09-02 (mesmo dia) — implementado com autorização do usuário

Depois deste relatório, o usuário aprovou explicitamente (confirmando que a
frente do ChatGPT/PR #311 estava parada no momento) implementar a captura de
Largura/Altura/Ambiente/Nome. Feito nesta mesma branch:

- Migration `20260902193714_wvetro_referencias_tipologias_dimensoes_v1.sql`
  (aplicada em produção): adiciona `largura_min_mm`, `largura_max_mm`,
  `altura_min_mm`, `altura_max_mm`, `ambientes_observados` (text[], até 20),
  `nomes_observados` (text[], até 20) em `wvetro_referencias_tipologias`. Só
  colunas novas, aditivo, não mexe em checkpoint/cursor/retry/pendências.
- `lib/wvetroBaseTecnicaServer.ts`: `itensHistoricos()` agora também lê
  `Largura`/`Altura`/`Ambiente`/`Nome` de cada item (antes só `Linha`/
  `Modelo`); `processarBaseTecnicaWVetroDia()` agrega esses valores por
  referência (min/max de largura/altura, união de ambientes/nomes distintos,
  mesclando com o que já estava salvo — nunca sobrescreve) e grava ao final
  do processamento do dia, no mesmo padrão já usado para os componentes.
- `app/api/integracoes/wvetro/base-tecnica/tipologias/[id]/route.ts` e a tela
  de detalhe correspondente passam a expor esses campos como **referência
  histórica** (rotulado explicitamente na tela, mesmo padrão já usado para
  distinguir de receita validada).
- `npx tsc --noEmit` e `npm run build` (etapa de compilação/tipos) sem erro
  novo — a falha de `supabaseUrl is required` na etapa de coleta de página é
  a mesma limitação de ambiente já conhecida (sem `.env.local` aqui), não
  uma regressão desta mudança.
- Estes valores só passam a existir para dias que forem (re)processados pela
  carga histórica **depois** desta mudança — não é retroativo aos ~859 dias
  já processados sem passar de novo por eles. Não fiz nenhum reprocessamento
  em massa (isso seria mexer em execução histórica, fora do escopo
  autorizado).
- Ainda não mergeado — segue nesta branch para validação final antes do merge manual.

## O que fica pendente (não fiz e não devo fazer sem autorização)

- Não executei o experimento controlado (depende de acesso humano ao sistema
  W.Vetro).
- O endpoint temporário de diagnóstico não foi chamado contra a API real e foi removido antes do merge.
- Não abri manualmente a documentação Postman completa (renderizada por JS, o
  fetch automatizado não trouxe o conteúdo).
- Não alterei nada da carga histórica, checkpoint, cursor, retry, pendências ou
  da lógica da PR #311.
- Não fiz merge para `main`.

## Próximo passo recomendado

1. Usuário (ou alguém com acesso ao sistema W.Vetro) executa o procedimento da
   seção E para pelo menos os casos A–D do experimento — é o passo com maior
   chance de encontrar a "ponte" (request com Linha+Largura+Altura+Opções →
   response com composição calculada).
2. Se for necessário repetir essa inspeção no futuro, recriar uma ferramenta temporária fora da `main` ou fazer a captura via DevTools descrita acima.
3. Com qualquer resultado das duas frentes, decidir junto com o usuário se vale
   desenhar a tabela de "regras condicionais" nova, ou se a estratégia vira
   "expandir extração histórica (Largura/Altura/Ambiente/Nome) + correlação
   estatística tratada como hipótese".
4. O endpoint temporário `investigacao-variaveis` já foi removido antes do merge, conforme decidido na revisão de pré-merge.
