# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Branch: `feat/atlas-professional-producao-v1`.

Objetivo: concluir a sexta onda do redesign profissional sem alterar a logica do Kanban de Producao.

Escopo implementado:
1. AppShell identifica somente `/producao` com `atlas-producao-professional`;
2. nova camada `app/atlas-producao-professional.css`;
3. cabecalho legado ocultado no shell;
4. toolbar, colunas, cards, modais e mobile refinados;
5. drag-and-drop e CRUD existentes preservados.

### Proxima acao obrigatoria
1. abrir PR;
2. aguardar Build Validation;
3. corrigir no mesmo branch se houver erro;
4. se passar, mergear na `main`;
5. iniciar branch separada para Engenharia.

## REDESIGN PROFISSIONAL JA NA MAIN
- PR #57: Home/Topbar/KPIs;
- PR #58: Sidebar ERP;
- PR #59: Kanban Comercial;
- PR #60: Central/Pesquisa de Orcamentos;
- PR #61: Medicao Final.

## DEPOIS DA PRODUCAO
1. Engenharia;
2. demais modulos antigos;
3. validacao funcional da Confirmacao de Venda;
4. regras condicionais/foto obrigatoria da Medicao Final;
5. liberacao persistente para Engenharia;
6. PDF W.Vetro -> Orcamento Atlas estruturado e conferivel.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Vercel continua sujeita a cota diaria; `Build Validation` confirma o build do codigo, mas producao depende do deploy Vercel.
- Nao alterar regras durante tarefas puramente visuais.
