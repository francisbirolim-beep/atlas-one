const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const fonte = fs.readFileSync(path.join(__dirname, '../lib/whatsappIndicadores.ts'), 'utf8')
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const modulo = { exports: {} }
new Function('module', 'exports', js)(modulo, modulo.exports)
const { calcularIndicadoresWhatsApp } = modulo.exports
const conversas = [
  { id: 'cliente-aberto', responsavel: 'eu', whatsapp_chat_tipo: 'contato', status: 'em_atendimento', ultima_mensagem_em: '2026-10-22T10:00:00Z', nao_lidas: 0, whatsapp_canal_id: 'principal' },
  { id: 'cliente-aguardando', responsavel: 'eu', whatsapp_chat_tipo: 'contato', status: 'aguardando', ultima_mensagem_em: '2026-10-22T10:01:00Z', nao_lidas: 3, whatsapp_canal_id: 'principal' },
  { id: 'cliente-finalizado', responsavel: 'eu', whatsapp_chat_tipo: 'contato', status: 'finalizado', ultima_mensagem_em: '2026-10-22T10:02:00Z', nao_lidas: 0, whatsapp_canal_id: 'principal' },
  { id: 'grupo-aberto', responsavel: 'eu', whatsapp_chat_tipo: 'grupo', status: 'aguardando', ultima_mensagem_em: '2026-10-22T10:03:00Z', nao_lidas: 2, whatsapp_canal_id: 'principal' },
  { id: 'grupo-respondido', responsavel: 'eu', whatsapp_chat_tipo: 'grupo', status: 'em_atendimento', ultima_mensagem_em: '2026-10-22T10:04:00Z', nao_lidas: 0, whatsapp_canal_id: 'principal' },
  { id: 'grupo-finalizado', responsavel: 'eu', whatsapp_chat_tipo: 'grupo', status: 'finalizado', ultima_mensagem_em: '2026-10-22T10:05:00Z', nao_lidas: 0, whatsapp_canal_id: 'principal' },
  { id: 'grupo-sem-mensagem', responsavel: 'eu', whatsapp_chat_tipo: 'grupo', status: 'aguardando', nao_lidas: 0, whatsapp_canal_id: 'principal' },
  { id: 'grupo-de-outro', responsavel: 'outro', whatsapp_chat_tipo: 'grupo', status: 'aguardando', ultima_mensagem_em: '2026-10-22T10:06:00Z', nao_lidas: 9, whatsapp_canal_id: 'principal' },
  { id: 'cliente-outro-canal', responsavel: 'eu', whatsapp_chat_tipo: 'contato', status: 'aguardando', ultima_mensagem_em: '2026-10-22T10:07:00Z', nao_lidas: 1, whatsapp_canal_id: 'pessoal' },
]
const visivel = c => c.responsavel === 'eu'
assert.deepEqual(calcularIndicadoresWhatsApp(conversas, 'principal', visivel), {
  atendimentos: 2, aguardando: 1, grupos: 2, gruposNaoLidos: 1,
})
assert.deepEqual(calcularIndicadoresWhatsApp(conversas, 'todos', visivel), {
  atendimentos: 3, aguardando: 2, grupos: 2, gruposNaoLidos: 1,
})
assert.deepEqual(calcularIndicadoresWhatsApp(conversas, 'pessoal', visivel), {
  atendimentos: 1, aguardando: 1, grupos: 0, gruposNaoLidos: 0,
})
console.log('OK: contadores por conversa, responsáveis, canal e finalização')
