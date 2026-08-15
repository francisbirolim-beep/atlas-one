# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/limpeza-home-operacional` no iPhone.

O usuario autorizou uma limpeza maior para retirar da Home elementos duplicados e pouco usados, sem apagar dados ou rotas de forma arriscada.

## IMPLEMENTADO NA BRANCH ATUAL
1. Home mostra somente Hero, Favoritos e Resumo da operação.
2. Remove da Home o bloco `Atenção necessária / Ações rápidas`, que repetia tarefas e atalhos já disponíveis em outros lugares.
3. Não renderiza mais na Home o conteúdo legado de agenda, calendário e tarefas pessoais de `app/page.tsx`.
4. As rotas próprias de tarefas e demais funcionalidades continuam existentes.
5. Remove o link `Ver relatórios` do resumo central.
6. Nenhuma rota, tabela ou dado foi apagado.
7. Nenhuma migration.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir a Home no iPhone e confirmar que a tela termina após o Resumo da operação.
3. Confirmar que não aparecem mais `Atenção necessária`, `Ações rápidas`, `Agenda e produtividade`, calendário ou tarefas na Home.
4. Confirmar que Favoritos continua funcionando.
5. Abrir Medição Final e Kanban pelos Favoritos e confirmar navegação normal.
6. Confirmar que `/tarefas` continua acessível quando necessário.

## DEPOIS DESTA VALIDACAO
- Fazer auditoria da navegação principal e retirar da lista padrão apenas páginas claramente antigas/duplicadas, sempre escondendo antes de apagar.
- Continuar validação da Medição Final em campo: parcial, tempo, histórico, seis medidas, fotos e SIM/NÃO.
- Continuar adicionando os próximos campos da Medição Final.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.

## CUIDADOS
- GitHub e a única fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A única Medição Final operacional deve ser `/producao/medicao-final`.
- Em limpeza de navegação, esconder primeiro quando houver dúvida; só apagar código/dados depois de validar dependências.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensão ausente.
