# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

## Medicao Final V2 — PRs #54 a #56
- responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios;
- checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas;
- link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da Vercel.

## Redesign profissional — PRs #57 a #63
Home executiva, Sidebar, Kanban Comercial, Central/Pesquisa de Orcamentos, Medicao Final, Producao e base profissional para setores.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
Entrada automatica apos Medicao Final aprovada, rota `/engenharia`, conferencia tecnica e liberacao transacional/idempotente para Producao.

## Kanban — fotos, trena e W.Vetro — PRs #104 a #111 — 2026-08-13
Fotos de campo, leitura por IA da trena, correcao Baixo/Cima, anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual.

## Medicao Final — importacao W.Vetro — PRs #112 a #118 — 2026-08-14
Importacao direta em `Nova medicao`, suporte a PDFs sem dimensoes, preservacao do original e correcoes do parser.

## Medicao Final — medidas e fluxo — PRs #119 a #122 — 2026-08-14
- 3 larguras + 3 alturas fixas por peca;
- foto da trena da LARGURA e ALTURA;
- CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA SIM/NAO;
- observacao por peca e lembrete da vista interna;
- ordem por peca validada;
- medicao parcial, cronometro ativo, historico de pausa/retomada e status FEITA/EM ABERTO.

## Navegacao mobile — PRs #123 e #124 — 2026-08-14
- remove barra inferior extensa no celular;
- cria Favoritos;
- adiciona Voltar e Inicio nas telas internas.

## Medicao Final — remover duplicata generica — PR #125 — 2026-08-14
- confirma `/producao/medicao-final` como unica Medicao Final oficial;
- retira a entrada generica/legada da navegacao.

## Home — limpeza — PRs #126 e #127 — 2026-08-14
- hero fica com `Novo orçamento` como acao principal;
- remove atalhos redundantes;
- Home passa a mostrar Hero, Favoritos e Resumo da operacao;
- agenda/tarefas/calendario e acoes duplicadas deixam de poluir a Home, sem excluir rotas ou dados.

## PR #129 — navegacao, orcamento/PDF e Plano de Corte — 2026-08-15
Mergeada em `main` no commit `91d4bd97167342dfb76ca24de53947d12a7a63d0`; status Vercel do commit: success.

Navegacao:
- lista diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia;
- Sidebar/Favoritos simplificados;
- administracao separada para Master;
- topbar limpa e perfil/logout funcional.

Orcamento/PDF:
- `/configuracoes/orcamento` exclusiva para Master;
- titulo, validade, foto, preco unitario, assinatura, observacao e rodape configuraveis;
- PDF de Orcamento Balcao aplica o padrao salvo.

Plano de Corte V1:
- `/producao/plano-corte` e atalho em Producao junto da Medicao Final;
- pesquisa produtos `porta_janela_padrao`;
- usa receita tecnica da Engenharia;
- gera snapshot persistente/editavel sem alterar receita mestre;
- variaveis de medidas, folgas e configuracao tecnica;
- permite substituir perfil/acessorio, ajustar quantidade/unidade/corte;
- permissao: Master/edicao altera, consulta visualiza, oculto bloqueia;
- migration `20260815100000_plano_corte_producao_v1.sql` cria as tabelas do recurso.

Observacao operacional: a migration passou no dry-run da PR, mas o workflow de banco exige `workflow_dispatch` manual com `mode=apply` e confirmacao `APPLY_PRODUCTION`. Merge/deploy do frontend nao prova que a migration foi aplicada.

## PR #130 — revisao tecnica e arquitetura do Plano de Corte — 2026-08-15
Branch `fix/pos-merge-plano-corte`.

Base tecnica:
- recuperados relatorios reais W.Vetro da Porta de Correr 03 Folhas Moveis | Suprema (`*SUCB-PC3-01EF`);
- criado `docs/tecnico/receitas/porta-correr-3f-suprema.md` com quatro configuracoes observadas;
- registradas formulas candidatas fortes de marco, montantes, baguete vertical, vidro e arremate;
- demonstrado com dados reais que a largura da folha muda conforme mao-de-amigo/reforco, inclusive com o mesmo vao.

Receitas por produto:
- migration `20260815223000_receitas_por_produto_v1.sql` adiciona `produto_id` a `engenharia_receitas`;
- preserva uma receita generica ativa por tipologia como fallback;
- permite uma receita ativa especifica por produto;
- `engenhariaReceitas.ts` adiciona busca/criacao por produto sem quebrar o comportamento generico existente.

Motor de formulas:
- criado `lib/formulasCorte.ts` sem `eval`/`new Function`;
- parser aceita somente aritmetica controlada, variaveis permitidas e funcoes `abs/ceil/floor/round/min/max`;
- formulas ainda nao preenchem `corte_mm` automaticamente; falta marcacao explicita de validacao e regras declarativas de variante.

Banco/seguranca:
- migration original do Plano de Corte corrigida para `public.*` e RLS/policy permissiva temporaria conforme o padrao atual do projeto;
- Supabase Database Control passou no dry-run das migrations da PR #130.

Decisao consolidada: Plano de Corte = **produto cadastrado + receita mestre + variaveis + snapshot editavel**. Receita especifica por produto tem prioridade; receita generica de tipologia e apenas fallback.

## W.Vetro API — estado da integracao
A documentacao publica `Wvetro Integrations v2` foi localizada. Integracao live deve ser server-side e comecar somente leitura. Nao implementar payloads proprietarios por suposicao. Credenciais/ambiente de teste e schemas reais ainda sao prerequisitos.

## Pontos funcionais ainda pendentes
- Build Validation final verde e merge da PR #130;
- aplicar migrations do Plano de Corte/receitas por produto via workflow manual confirmado;
- ligar selecao de produto a receita especifica automaticamente na UI;
- adicionar metadados de validacao de formula e variantes condicionais;
- fechar receita Porta 3F Suprema com mais amostras por variante, acessorios e usinagens;
- validar Plano de Corte V1 no celular/desktop com banco ativo;
- validar Medicao Final em campo;
- validar PDF com configuracoes reais;
- iniciar W.Vetro somente leitura quando houver credenciais/schemas de teste;
- evoluir Plano de Corte para lista de barras, otimizacao, sobras e romaneio com desenho tecnico.


## W.Vetro -- extracao historica inicial (tipologias + catalogo) -- 2026-08-16
- autenticado via ValidarUsuario com credenciais fornecidas pelo usuario diretamente no chat (nao commitadas em nenhum arquivo);
- extraidas 1038 vendas/orcamentos reais (193 pedidos + 845 orcamentos) do periodo 2019-2026, licenca real "ESQUADRIFACIO SOLUCAO EM ALUMINIO LTDA";
- geradas 109 tipologias novas (chave/label/categoria/ordem) a partir dos pares Linha+Modelo unicos dos itens vendidos, inseridas em `tipologias` com ON CONFLICT (chave) DO NOTHING -- total agora 120;
- gerados 871 produtos (479 perfil + 392 acessorio) a partir dos itens unicos em Perfil[]/Acessorios[] das vendas, inseridos em `produtos` com `preco = 0` (placeholder -- API W.Vetro nao expoe lista de precos via GET);
- mapeamento completo da API documentado em `docs/ai-handoff/WVETRO_API_MAPPING.md`.

Limitacoes e cuidados desta extracao:
- foi uma extracao pontual via script no browser (fetch direto para api.wvetro.com.br e para o REST do Supabase), nao uma integracao live/recorrente -- nao ha rota server-side nem sincronizacao automatica;
- preco dos produtos importados esta zerado, precisa ser preenchido manualmente antes de usar em orcamento real;
- categoria de tipologia (porta/janela) foi inferida por palavra-chave no nome/modelo, nao validada manualmente;
- nome de produto usa "codigo - nome" do W.Vetro; pode haver duplicatas semanticas (mesma peca, cores diferentes) nao deduplicadas por cor;
- o token/credenciais do W.Vetro foram usados temporariamente em uma aba do browser (via extensao Chrome) porque o sandbox de execucao nao tem acesso de rede a api.wvetro.com.br (bloqueado por allowlist); a aba foi fechada ao final. Para integracao permanente, seguir a recomendacao ja existente de fazer isso server-side, sem credenciais no browser.


## Materiais -- cadastro de Linha, Cor e preco do Kg do aluminio -- 2026-08-16
- migration `20260816130000_linhas_cores_precificacao_v1.sql`: tabelas `linhas`, `cores` (com `peso_kg_metro`), `configuracoes_precificacao` (chave/valor, seed `preco_kg_aluminio=0`); colunas `linha_id`/`cor_id` (FK) adicionadas em `produtos`; RLS `acesso_total_temporario` igual ao padrao do projeto;
- libs: `lib/linhas.ts`, `lib/cores.ts`, `lib/configuracoesPrecificacao.ts` (CRUD simples, mesmo padrao de `lib/fornecedores.ts`);
- UI nova em `app/cadastro/materiais/page.tsx` (link adicionado em `app/cadastro/page.tsx`): cadastro de linhas (chips ativar/desativar/excluir), cores (nome + peso opcional kg/metro) e preco do Kg do aluminio (RS, salvar);
- `linhas` populada com as 38 linhas reais extraidas do Wvetro anteriormente (ver secao de extracao historica acima);
- PR #134 mergeado em main; migration aplicada em producao via workflow `Supabase Database Control` (mode=apply, run #51, sucesso);
- pendente: (a) selects de Linha/Cor no formulario de produto (`app/cadastro/produtos/page.tsx`) ainda nao existem -- os campos `linha_id`/`cor_id` ja estao no schema e em `lib/tipos.ts` mas nada na tela os usa ainda; (b) precificacao de acessorios (392 produtos importados do Wvetro com preco=0) ainda depende de edicao manual produto a produto -- nao ha tela de precificacao em lote.


## Identidade tecnica de Produto (perfis/acessorios W.Vetro) -- 2026-08-16
Branch `feat/produtos-identidade-tecnica-wvetro`. Auditoria completa em
`docs/tecnico/auditoria-produtos-2026-08-16.md` (1.700 produtos: 1.405 OK,
14 ATENCAO, 281 REVISAR -- nenhuma duplicidade de codigo). Divergencia
encontrada e registrada nesse mesmo documento: o arquivo completo de
`ExportWWAcessorios` (~1.174 linhas) nao estava disponivel no ambiente desta
execucao -- hoje existem apenas os 392 acessorios da extracao historica via
API. A base completa sera reconciliada em etapa separada.

Implementado:
- migration `20260816180000_produtos_identidade_tecnica_v1.sql`: colunas
  `codigo`/`codigo_origem`/`origem`/`id_externo_wvetro` (identidade tecnica),
  `peso_kg_m`/`tamanho_barra_mm`/`tamanho_barra_mm_origem` (dados de perfil),
  `dados_origem jsonb` (snapshot congelado dos valores importados),
  `status_validacao` (importado/revisado/validado) + `validado_em/_por_id/_por_nome`
  + `observacao_validacao`, `ncm_origem`/`ncm_status` (pendente/valido/invalido,
  sem corrigir o numero do NCM), tabela `produto_linhas` (N:N produto<->linha,
  RLS permissiva igual ao padrao do projeto), unique index parcial em
  `upper(codigo)` (seguro pois a auditoria confirmou 0 duplicidade), e backfill
  simples via `UPDATE ... SET codigo = split_part(nome, ' - ', 1)` (sem
  depender de lista externa de valores) para os 1.699 produtos com padrao
  "CODIGO - DESCRICAO" em `nome`;
- `scripts/auditoria-produtos-wvetro.sql`: script reutilizavel (rodar de novo
  apos qualquer nova importacao) que classifica cada produto em OK/ATENCAO/REVISAR
  sem corrigir nada automaticamente;
- `lib/tipos.ts` (`Produto`) e `lib/produtos.ts` (`criarProduto`/`atualizarProduto`):
  todos os campos novos adicionados como opcionais, compativel com o formulario
  atual sem quebrar nada;
- `lib/produtoLinhas.ts`: CRUD do vinculo N:N produto<->linha (ainda nao usado
  por nenhuma tela -- ver NEXT_TASK.md);
- `app/cadastro/produtos/page.tsx`: campo de busca por codigo/nome/descricao
  acima da lista de produtos cadastrados, e badge com o codigo ao lado do nome
  em cada card (usa `produto.codigo` quando existir, com fallback para o
  prefixo de `nome` antes de " - " enquanto a migration nao for aplicada em
  producao).

Decisoes de arquitetura tomadas nesta implementacao (ver DECISIONS.md para o
detalhe/motivo):
- `dados_origem jsonb` na propria tabela `produtos` (nao uma tabela
  `produto_origens` separada) -- mais simples e consistente com o padrao leve
  ja usado no projeto; documentado como trade-off deliberado.
- `marca` ja cumpre o papel de "fabricante" do pedido original -- nao foi
  criada coluna duplicada. `codigo_fabricante` e `perda_percentual` tambem nao
  foram criados por falta de dado de origem distinto / necessidade concreta.
- Codigo tecnico ("CODIGO - DESCRICAO" em `nome`) ja aparecia em todo lugar que
  renderiza `produto.nome` (selects de Engenharia > Receitas e Plano de Corte)
  -- confirmado lendo `app/producao/plano-corte/page.tsx` e
  `app/engenharia/receitas/page.tsx`. Por isso o item "codigo tecnico deve
  aparecer em Engenharia/Plano de Corte" do pedido ja estava satisfeito e
  nenhuma mudanca foi necessaria ali.

Pendente antes de declarar isso ativo em producao:
- aplicar `supabase/migrations/20260816180000_produtos_identidade_tecnica_v1.sql`
  via `Supabase Database Control` (`apply` + `APPLY_PRODUCTION`);
- backfill de `tamanho_barra_mm`/`tamanho_barra_mm_origem` a partir da coluna
  "Tamanho" de `ExportWWPerfil (1).xlsx` **nao foi commitado nesta PR** (ficou
  fora por tamanho/escopo -- e uma segunda migration de ~1.300 linhas de
  `VALUES`, gerabel a qualquer momento a partir do mesmo arquivo ja usado para
  peso/NCM/unidade/fabricante);
- vincular `produto_linhas` a alguma UI (hoje so existe o CRUD em
  `lib/produtoLinhas.ts`, nada na tela usa ainda);
- quando a base completa de `ExportWWAcessorios` for reconciliada, reusar a mesma estrutura
  (`codigo`/`origem`/`dados_origem`/`ncm_status`) -- e nao tratar "GERAL"
  (linha) nem codigos de cor numericos como vinculo tecnico automatico.
