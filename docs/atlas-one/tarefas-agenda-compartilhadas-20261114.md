# Atlas One — tarefas compartilhadas e recorrências (14/11/2026)

## Escopo
- Tarefa manual: título, instruções, prioridade, data/hora, busca e seleção de vários responsáveis.
- Cartões sincronizados para criador e responsáveis, com etapas e conclusão compartilhadas.
- Comentários e movimentações registram usuário, data, hora, histórico e prazo.
- Lembrete com OK, entendi, adiamento e conclusão.
- Calendário com participantes e recorrências diária, semanal, mensal, n-ésimo dia útil e anual.
- Preservadas quatro colunas, cores e filtro mensal do Kanban Pessoal; voz em fase posterior.

## Publicação segura
**Esta branch não foi aplicada à produção.**
1. Aplicar as migrations 20261114140000 e 20261114142000, nesta ordem, em ambiente isolado.
2. Testar RLS entre usuários e empresas; movimentação, comentários, conclusão compartilhada.
3. Testar repetição sem duplicatas, prazo vencido, convites e retomada de falhas.
4. Verificar CRON_SECRET e a rotina /api/rotinas/recorrencias (03:10 UTC, 00:10 São Paulo).
5. Conferir visual com contas autenticadas, sem alterações em outros módulos.
6. Publicar apenas após homologação do banco e build completo.

## Dias úteis
Exclui fins de semana e feriados nacionais fixos. Feriados municipais, estaduais, bancários e móveis exigem cadastro na tabela atlas_feriados. O 5º dia útil de novembro de 2026 é 09/11/2026, considerando o feriado nacional de 02/11. O financeiro deve confirmar o critério legal de contagem aplicável.

## Testes
- npm run typecheck: aprovado.
- node scripts/test-atlas-recorrencia.cjs: aprovado com 5º dia útil, feriados e fuso.
- npm run build: compilação passou, coleta de páginas bloqueada por variáveis de ambiente ausentes nesta cópia isolada.
- Migrações ainda não executadas no banco em ambiente de homologação.

Regra: não modificar a Home já aprovada, o Kanban comercial ou tarefas antigas.