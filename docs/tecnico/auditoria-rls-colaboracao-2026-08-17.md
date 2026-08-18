# Auditoria RLS — colaboração — 2026-08-17

Consulta executada em transação PostgreSQL READ ONLY. Nenhum dado/schema foi alterado.

```text
BEGIN
transaction_read_only=on
--- POLICIES ---
public.evento_convidados | evento_convidados_delete | DELETE | using=((usuario_id = auth.uid()) OR is_dono_evento(evento_id)) | check=
public.evento_convidados | evento_convidados_insert | INSERT | using= | check=is_dono_evento(evento_id)
public.evento_convidados | evento_convidados_select | SELECT | using=((usuario_id = auth.uid()) OR is_dono_evento(evento_id)) | check=
public.evento_convidados | evento_convidados_update | UPDATE | using=((usuario_id = auth.uid()) OR is_dono_evento(evento_id)) | check=((usuario_id = auth.uid()) OR is_dono_evento(evento_id))
public.eventos | eventos_delete | DELETE | using=(usuario_id = auth.uid()) | check=
public.eventos | eventos_insert | INSERT | using= | check=(usuario_id = auth.uid())
public.eventos | eventos_select | SELECT | using=((usuario_id = auth.uid()) OR is_convidado_evento(id)) | check=
public.eventos | eventos_update | UPDATE | using=(usuario_id = auth.uid()) | check=(usuario_id = auth.uid())
public.tarefa_colunas | acesso_total_temporario | ALL | using=true | check=true
public.tarefas | acesso_total_temporario | ALL | using=true | check=true
--- COLUMNS ---
evento_convidados | 1 | id | uuid | nullable=NO | default=gen_random_uuid()
evento_convidados | 2 | evento_id | uuid | nullable=NO | default=
evento_convidados | 3 | usuario_id | uuid | nullable=NO | default=
evento_convidados | 4 | status | text | nullable=NO | default='pendente'::text
evento_convidados | 5 | created_at | timestamp with time zone | nullable=NO | default=now()
eventos | 1 | id | uuid | nullable=NO | default=gen_random_uuid()
eventos | 2 | usuario_id | uuid | nullable=NO | default=
eventos | 3 | titulo | text | nullable=NO | default=
eventos | 4 | descricao | text | nullable=YES | default=
eventos | 5 | local | text | nullable=YES | default=
eventos | 6 | data_inicio | timestamp with time zone | nullable=NO | default=
eventos | 7 | data_fim | timestamp with time zone | nullable=YES | default=
eventos | 8 | created_at | timestamp with time zone | nullable=NO | default=now()
eventos | 9 | recorrencia_tipo | text | nullable=YES | default=
eventos | 10 | recorrencia_valor | integer | nullable=YES | default=
eventos | 11 | regra_origem_id | uuid | nullable=YES | default=
tarefa_colunas | 1 | id | uuid | nullable=NO | default=gen_random_uuid()
tarefa_colunas | 2 | usuario_id | uuid | nullable=NO | default=
tarefa_colunas | 3 | nome | text | nullable=NO | default=
tarefa_colunas | 4 | ordem | integer | nullable=NO | default=0
tarefa_colunas | 5 | created_at | timestamp with time zone | nullable=NO | default=now()
tarefas | 1 | id | uuid | nullable=NO | default=gen_random_uuid()
tarefas | 2 | usuario_id | uuid | nullable=NO | default=
tarefas | 3 | coluna_id | uuid | nullable=NO | default=
tarefas | 4 | titulo | text | nullable=NO | default=
tarefas | 5 | descricao | text | nullable=YES | default=
tarefas | 6 | data_hora | timestamp with time zone | nullable=YES | default=
tarefas | 7 | concluida_em | timestamp with time zone | nullable=YES | default=
tarefas | 8 | created_at | timestamp with time zone | nullable=NO | default=now()
tarefas | 9 | recorrencia_tipo | text | nullable=YES | default=
tarefas | 10 | recorrencia_valor | integer | nullable=YES | default=
tarefas | 11 | regra_origem_id | uuid | nullable=YES | default=
COMMIT
```
