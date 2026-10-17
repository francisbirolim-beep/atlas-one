const fs = require('node:fs')
const assert = require('node:assert/strict')
const sql = fs.readFileSync('supabase/migrations/20261017142821_agenda_tarefas_lembretes_v1.sql', 'utf8')
const home = fs.readFileSync('components/system/HomeOperationsWorkspace.tsx', 'utf8')
const tarefas = fs.readFileSync('app/tarefas/page.tsx', 'utf8')
const prefs = fs.readFileSync('app/configuracoes/notificacoes/page.tsx', 'utf8')
function contem(texto, padrao, mensagem) { assert.ok(padrao.test(texto), mensagem) }

// Não gerar dezenas de cobranças sobre tarefas anteriores ao primeiro deploy.
contem(sql, /and t\.lembretes_inicio_em is not null/, 'Tarefas legadas não devem entrar em cobrança automática')
contem(sql, /and e\.lembretes_inicio_em is not null/, 'Agenda legada não deve entrar em cobrança automática')
contem(sql, /before insert or update of data_hora,avisos_minutos,repetir_pendente_minutos/, 'Nova tarefa ou reagendamento deve ativar avisos')

// Nenhuma tarefa concluída pode ser cobrada novamente.
contem(sql, /where t\.concluida_em is null/, 'Tarefa concluída não deve ser cobrada')
contem(sql, /where e\.concluido_em is null/, 'Compromisso realizado não deve ser cobrado')

// Eventos idempotentes, incluindo operações repetidas pelo cron/kanban.
contem(sql, /on conflict \(usuario_id,origem_tipo,origem_id\)[\s\S]*?do nothing/g, 'Deduplicação das notificações')
contem(sql, /create unique index if not exists tarefas_orcamento_envio_unico/, 'Uma tarefa por orçamento e vendedor')
contem(sql, /if new\.coluna_id is not distinct from old\.coluna_id then return new/, 'A transição deve ser real')
contem(sql, /where origem_lembrete = 'orcamento_feito_envio'/, 'Gatilho isolado das outras tarefas')
contem(sql, /where empresa_id = new\.empresa_id and orcamento_id = new\.id/, 'Baixa de orçamento enviado restrita à obra e empresa')
contem(sql, /revoke all on function private\.processar_lembretes_atlas\(\) from public, anon, authenticated/, 'Cron não pode ser executado pelo usuário comum')

// Os fluxos principais antigos são mantidos e as opções são configuráveis.
contem(prefs, /tarefas_avisos_minutos/, 'Configuração de tarefas por usuário')
contem(prefs, /agenda_avisos_minutos/, 'Configuração de agenda por usuário')
contem(tarefas, /Adiar ou reagendar/, 'Ações para o usuário')
contem(home, /Avisos deste compromisso/, 'Personalização por compromisso')
contem(home, /concluirCompromisso/, 'Baixa de agenda')
contem(home, /avisosMinutos: avisosTarefa/, 'Cadastro da tarefa com antecedências personalizadas')
console.log('PASS: preferências separadas, overrides por item, idempotência, sem cobrança de legados, conclusão e Kanban sem duplicação.')
