# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-15. `main` esta no merge da PR #129, commit `91d4bd97167342dfb76ca24de53947d12a7a63d0`. O status Vercel desse commit esta `success`, portanto o pacote da PR #129 foi aceito pelo deploy de producao.

A branch atual `fix/pos-merge-plano-corte` faz a revisao pos-merge, documenta a primeira receita tecnica real estudada a partir de relatorios W.Vetro e corrige o handoff antes da proxima evolucao do Plano de Corte.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PRs #112 a #118: importacao W.Vetro em Nova Medicao e correcoes do parser.
- PR #119: 3 larguras + 3 alturas e fotos da trena fixas na Medicao Final.
- PR #120: CONTRAMARCO, ARREMATE, CADEIRINHA, CANTONEIRA SIM/NAO, observacao e aviso de vista interna.
- PR #121: ordem mobile por peca consolidada.
- PR #122: medicao parcial, tempo ativo, historico de pausa/retomada e FEITA/EM ABERTO.
- PR #123: Favoritos substitui a barra inferior extensa no mobile.
- PR #124: Voltar e Inicio nas telas internas do mobile.
- PR #125: somente `/producao/medicao-final` permanece como Medicao Final oficial.
- PRs #126 e #127: limpeza da Home.
- PR #129: navegacao essencial, Configuracoes de Orcamento/PDF e Plano de Corte V1.
- Engenharia Fases 1 a 4 concluidas; base de receitas tecnicas da Fase 5 existe.
- Build Validation no GitHub Actions.

## PR #129 — NAVEGACAO / ORCAMENTO / PRODUCAO
Mergeado em `main`:
- navegacao diaria: Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia;
- administracao separada para Master;
- Favoritos mobile simplificados;
- topbar limpa e perfil/logout funcional;
- `/configuracoes/orcamento` com titulo, validade, fotos, preco unitario, assinatura/aceite, observacao e rodape;
- PDF de Orcamento Balcao aplica o padrao configurado;
- `/producao` mostra as etapas tecnicas Medicao Final e Plano de Corte;
- `/producao/plano-corte` pesquisa produto cadastrado, seleciona receita tecnica e cria snapshot editavel do plano;
- permissao do Plano de Corte segue Producao: Master/edicao altera; consulta visualiza; oculto bloqueia.

## BANCO — PLANO DE CORTE
O arquivo `supabase/migrations/20260815100000_plano_corte_producao_v1.sql` esta em `main` e passou no dry-run da PR #129. Ele cria:
- `planos_corte`;
- `plano_corte_componentes`.

IMPORTANTE: o workflow `Supabase Database Control` nao aplica migration automaticamente no merge. `apply` exige `workflow_dispatch` manual com confirmacao `APPLY_PRODUCTION`. Portanto, ate confirmar uma execucao `apply` bem-sucedida, considerar a migration **pendente de aplicacao em producao**, mesmo com o frontend ja deployado.

## REVISAO TECNICA — PORTA DE CORRER 03 FOLHAS SUPREMA
Foi recuperado da biblioteca do usuario o relatorio W.Vetro `app.core.relorientativocortesimplificadoitem(8).pdf` e outros relatorios da mesma tipologia/projeto `*SUCB-PC3-01EF`.

A base detalhada esta em `docs/tecnico/receitas/porta-correr-3f-suprema.md`.

Regras candidatas fortes observadas em amostras reais:
- SU010 = largura do vao - 30 mm;
- TMC = largura do vao - 30 mm;
- SU012 = altura do vao - folga_altura (4 mm nas amostras);
- montantes verticais da folha = altura do vao - 34 mm;
- SU102 vertical = altura do vao - 185 mm;
- vidro altura = altura do vao - 167 mm;
- arremate MP347 face interna: horizontal = largura + 44 mm; vertical = altura + 22 mm nas amostras observadas.

NAO VALIDADO COMO FORMULA UNICA:
- largura da folha/vidro. O mesmo vao 2500 x 2100 gerou folha 771 mm ou 756 mm dependendo da configuracao de mao-de-amigo/reforco. Isso confirma que o motor precisa ser orientado por produto + variaveis, e nao por uma unica formula generica de `porta_correr`.

## DECISAO DE ARQUITETURA DO PLANO DE CORTE
- produto cadastrado e o ponto de entrada;
- receita mestre contem componentes/variantes/formulas validadas;
- variaveis selecionam a variante correta;
- plano e snapshot editavel e nao altera a receita mestre;
- formula pendente nunca gera medida inventada;
- modelo final precisa suportar receitas/variantes orientadas ao produto; a estrutura atual de uma receita ativa por tipologia e apenas base inicial e sera evoluida antes de automatizar formulas complexas.

## ORDEM ATUAL POR PECA — MEDICAO FINAL
1. identificacao da peca;
2. foto da trena LARGURA / ALTURA;
3. Largura Baixo / Meio / Cima;
4. Altura Direita / Meio / Esquerda;
5. Contramarco / Arremate / Cadeirinha / Cantoneira — SIM/NAO;
6. observacao;
7. demais campos configuraveis;
8. fotos adicionais.

## W.VETRO API
Integracao live continua bloqueada ate haver credenciais/ambiente de teste e schemas reais. Regras: server-side, iniciar somente leitura, nao adivinhar payload, Atlas continua fonte da verdade, PDF original preservado e dimensao ausente nunca inventada.

## IMPLEMENTADO MAS AINDA PRECISA VALIDACAO DE USO
- navegacao/Favoritos da PR #129 no iPhone;
- Configuracoes -> Orcamento e PDF com dados reais da empresa;
- Plano de Corte V1 depois de aplicar a migration de banco;
- Medicao Final parcial/tempo/historico em campo;
- persistencia dos quatro SIM/NAO, observacao, fotos e medidas em uso real.

## DIVIDA TECNICA / SEGURANCA
- schema de receita hoje restringe uma receita ativa por `tipologia_id`; isso e insuficiente para o modelo final produto + variantes e deve ser evoluido antes do motor automatico completo;
- formulas condicionais ainda nao possuem sintaxe oficial/evaluador seguro;
- paginas antigas continuam no codigo, apenas fora da navegacao principal;
- Favoritos seguem locais por dispositivo/navegador;
- testes automatizados de regra de negocio ainda nao existem;
- nao usar `migration repair --reverted` sem diagnostico explicito.
