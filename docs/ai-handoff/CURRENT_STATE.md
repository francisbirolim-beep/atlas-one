# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Nao assuma que algo esta implementado so porque aparece em documentacao. Antes de alterar codigo, verifique o estado real do repositorio (arquivos em lib/ e app/, tabelas no Supabase). Ao concluir uma implementacao relevante, atualize este arquivo, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, direto no codigo (branch main) e no banco (Supabase project urtqbvjpwnrfaayolymt).

## FUNCIONANDO (validado em producao)
- Login/autenticacao simples via lib/auth.ts (tabela usuarios, sem Supabase Auth nativo).
- Kanban de orcamentos (app/kanban/page.tsx) com colunas dinamicas, drag-and-drop, historico.
- Cadastro de clientes, fornecedores, produtos.
- Orcamento rapido e orcamento balcao (criacao de itens/esquadrias).
- Checklist de medicao final por tipologia (campos extras: numero/texto/foto, obrigatorio, com validacao ao salvar).
- Medicao final: marcar item como medido (campo medido/medido_em/medido_por), reabrir para editar.
- Tipologias dinamicas: tabela tipologias no banco, CRUD via lib/tipologias.ts, usado em kanban, orcamento-rapido, medicao-final (telas atualizadas na tarefa mais recente).
- Automacoes de setor (fan-out): ao mover card de coluna, pode criar item em kanban de setor (lib/automacoesSetor.ts).
- Automacoes de orcamento -> tarefas (lib/automacoes.ts / automacoes_orcamento).
- Importacao de itens de orcamento via PDF (lib/pdfOrcamentoImport.ts + app/api/importar-itens-orcamento).
- Modulo de IA/agente (lib/agente.ts, lib/ai/*, tabelas agentes_ia, agente_conversas, agente_mensagens, agente_memorias, ia_uso_log) — existe e tem rotas em app/api/agente/*, mas NAO foi auditado a fundo nesta verificacao. Tratar como IMPLEMENTADO MAS NAO VALIDADO ate confirmar uso real.
- Backup/restore (lib/backup.ts, lib/backupServer.ts, app/api/backup, app/api/restaurar-backup).

## IMPLEMENTADO MAS NAO VALIDADO
- Categoria porta/janela na tabela tipologias (campo categoria) — existe e e preenchido ao criar tipologia nova, mas lib/calculos.ts (formula de area/perimetro) AINDA NAO LE esse campo. Tipologias novas caem na formula de janela por padrao. Risco real de calculo errado de orcamento para tipologias customizadas do tipo porta.
- Modulo de IA/agente (ver acima).
- CRM (app/crm/page.tsx, tabelas crm_interacoes, crm_metas, crm_tarefas) — presente no codigo, uso real nao confirmado nesta sessao.

## PARCIAL
- Nenhuma pendencia parcial de codigo aberta no momento (a tarefa de tipologias dinamicas foi concluida e mergeada — PR #28).
- Havia uma tarefa em andamento (nao commitada, nao mergeada) para criar automaticamente a Medicao Final quando um card entra numa coluna com gera_medicao_final=true. Ver NEXT_TASK.md — o trabalho FOI INTERROMPIDO antes de qualquer commit.

## NAO IMPLEMENTADO
- Nenhum teste automatizado no repositorio (sem pasta __tests__, sem .test./.spec., sem framework de teste no package.json).
- Sem script de lint ou typecheck no package.json (so ha dev/build/start).
- Fase 9c (Historico de precos por produto) e Fase 9d (Importar XML de NF-e) — mencionadas em conversas anteriores como pendentes, nao ha evidencia de implementacao no codigo atual.
- Criacao automatica de Medicao Final ao mover card para coluna "Vendido" (gera_medicao_final=true) — a coluna tem a flag no banco, mas NENHUM lugar do codigo le essa flag para disparar a criacao automatica. Hoje a criacao e 100% manual (botao "+ Nova" na tela /producao/medicao-final, que lista orcamentos "sem medicao" e cria sob demanda).

## PROBLEMAS CONHECIDOS
- Migrations desalinhadas: os arquivos supabase-migration-v*.sql no repositorio vao ate v15. As migrations v16 a v19 (gera_medicao_final em kanban_colunas, coluna obrigatorio em tipologia_campos_extras, tipo_valor 'foto', tabela tipologias) foram aplicadas DIRETO no banco via ferramenta MCP do Supabase e NAO tem arquivo .sql correspondente commitado no repositorio. O schema real do banco esta OK, mas o historico de migrations em arquivo esta incompleto — cuidado ao tentar recriar o banco do zero a partir dos arquivos .sql do repo, vai faltar schema.
- lib/historico.ts / app/historico/page.tsx: tipoLabels hardcoded com 3 de 10 tipologias (bug preexistente, nao critico, listado mas nao corrigido).
- lib/automacoesSetor.ts (rotuloTipo): nomes hardcoded, mas com fallback — nao quebra, so mostra a chave crua para tipologias customizadas.
- lib/pdfOrcamentoImport.ts: heuristica de deteccao de tipologia no PDF nao conhece tipologias customizadas, cai em 'outro' — aceitavel, nao critico.
- Sessao do navegador conectado ao GitHub pode cair (precisou re-login durante esta sessao). Se um proximo agente usar automacao de navegador para editar/commitar, confirme que a sessao do GitHub esta ativa antes de tentar editar arquivos.
