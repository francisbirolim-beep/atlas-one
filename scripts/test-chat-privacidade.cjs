const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const raiz = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(raiz, 'lib/chatPrivacidade.ts'), 'utf8')
const js = ts.transpileModule(src, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
}}).outputText
const mod = { exports: {} }
new Function('module', 'exports', js)(mod, mod.exports)
const { podeSupervisionarChatInterno, conversaInternaComHistorico } = mod.exports
assert.equal(podeSupervisionarChatInterno({role:'master'}), false)
assert.equal(podeSupervisionarChatInterno({role:'master'}, 'minhas'), false)
assert.equal(podeSupervisionarChatInterno({role:'master'}, 'supervisao'), true)
assert.equal(podeSupervisionarChatInterno({role:'usuario'}, 'supervisao'), false)
assert.equal(podeSupervisionarChatInterno(null, 'supervisao'), false)
assert.equal(conversaInternaComHistorico({ultima_mensagem_em:null}), false)
assert.equal(conversaInternaComHistorico({}), false)
assert.equal(conversaInternaComHistorico({ultima_mensagem_em:'2026-10-24T15:00:00Z'}), true)
const tela = fs.readFileSync(path.join(raiz,'app/whatsapp/page.tsx'),'utf8')
const chat = fs.readFileSync(path.join(raiz,'lib/chatInterno.ts'),'utf8')
assert.ok(tela.includes("listarConversasInternas(id, { modo: 'minhas', apenasComHistorico: true })"))
assert.ok(tela.includes("listarConversasInternas(eu.id, { modo: 'supervisao', apenasComHistorico: true })"))
assert.ok(tela.includes("visaoSupervisao !== 'internas' || eu?.role !== 'master'"))
assert.ok(chat.includes("if (!usuario || usuario.id !== usuarioId) return []"))
console.log('OK: master vê próprias conversas por padrão; supervisão explícita; não participantes bloqueados; históricos vazios ocultos')
