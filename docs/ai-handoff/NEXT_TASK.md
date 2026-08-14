# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
A Engenharia Fase 4 foi concluida no PR #73 e a migration `20260811200000_engenharia_liberacao_producao_v1.sql` foi aplicada e validada no Supabase.

No Kanban comercial, PR #104 restaurou `Iniciar orçamento`, PR #105 organizou as fotos por esquadria, PR #106 separou as fotos de `LARGURA` e `ALTURA` e PR #107 adicionou leitura automatica da trena por IA.

A branch atual `fix/inverter-mapeamento-largura-trena` corrige um erro observado em teste real: na LARGURA, `Baixo` e `Cima` estavam invertidos.

## VALIDAR ANTES DE ENCERRAR A CORRECAO DA TRENA
1. Abrir um pedido de medida final com foto de largura e foto de altura do medidor laser.
2. Abrir o card em `Fazer orçamento` e clicar em `Iniciar orçamento`/`Retornar orçamento`.
3. Confirmar que as fotos continuam visiveis como `LARGURA` e `ALTURA`.
4. Confirmar leitura por IA.
5. Na foto usada no teste de 13/08/2026, a LARGURA deve resultar em `Baixo 1790 / Meio 1791 / Cima 1789` — e nao mais `1789 / 1791 / 1790`.
6. Confirmar que a ALTURA nao mudou com esta correcao e continua preenchendo `Direita -> Meio -> Esquerda` conforme validacao atual.
7. Confirmar conversao para milimetros; ex.: `1.700 m` deve resultar em `1700`.
8. Se a IA nao reconhecer exatamente 3 valores de um eixo, confirmar que nenhum campo daquele eixo foi deslocado/preenchido parcialmente.
9. Salvar, fechar e reabrir o card; confirmar persistencia.
10. Confirmar que falha/indisponibilidade da IA nunca remove as fotos.

## PROXIMA TAREFA — ENGENHARIA FASE 5
Criar a base de receitas tecnicas por tipologia, preparando o MEE sem implementar todo o calculo automatico de uma vez.

Escopo recomendado:
1. cadastro de receita tecnica por tipologia;
2. vincular perfis, acessorios, vidros e reforcos;
3. definir unidades e regras de quantidade por item de receita;
4. permitir versao/ativacao da receita;
5. manter historico e rastreabilidade da receita usada em cada obra;
6. preparar campos para formulas dependentes de largura, altura, quantidade e configuracao da esquadria;
7. criar uma tela de revisao da receita antes de gerar materiais automaticamente.

## DEPOIS DA FASE 5
- implementar calculos/MEE por tipologia;
- gerar lista de materiais;
- gerar lista de corte;
- otimizar barras;
- integrar liberacao tecnica calculada com Producao/Estoque.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64: entrada automatica apos aprovacao da Medicao Final.
- Engenharia Fase 2 PR #66: rota `/engenharia`, KPIs, quatro etapas e detalhe das pecas.
- Engenharia Fase 3 PR #69: conferencia tecnica persistente e bloqueio de liberacao incompleta.
- Engenharia Fase 4 PR #73: liberacao transacional para Producao, registro de quem/quando e card de Producao idempotente; migration aplicada.
- Kanban PR #104: primeira coluna volta a exigir `Iniciar orçamento` e preserva referencias de foto do pedido.
- Kanban PR #105: galeria de fotos coletadas em campo por esquadria.
- Kanban PR #106: fotos de largura e altura separadas e identificadas.
- Kanban PR #107: leitura automatica por IA das fotos da trena e sugestao das seis medidas.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Leitura por IA e sugestao; o colaborador deve conferir as medidas antes de salvar.
- Nao sobrescrever automaticamente medida manual ja preenchida.
- Migration: dry-run em PR antes de apply controlado.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
