# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
A Engenharia Fase 4 foi concluida no PR #73 e a migration `20260811200000_engenharia_liberacao_producao_v1.sql` foi aplicada e validada no Supabase.

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

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
