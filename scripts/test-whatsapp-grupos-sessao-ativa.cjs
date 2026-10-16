const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync('lib/whatsappGruposSessaoAtiva.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const moduleExports = {}
vm.runInNewContext(compiled, { exports: moduleExports })
const { idsCanaisWhatsAppConectados, filtrarGruposDosCanaisConectados, filtrarConfiguracoesDeGruposVisiveis } = moduleExports
const canais = [{ id: 'atual', gateway_status: 'connected' }, { id: 'antigo', gateway_status: 'disconnected' }, { id: 'pausado', gateway_status: 'paused' }]
const grupos = [{ id: 'g1', whatsapp_canal_id: 'atual' }, { id: 'g2', whatsapp_canal_id: 'antigo' }, { id: 'g3', whatsapp_canal_id: 'pausado' }]
const conectados = idsCanaisWhatsAppConectados(canais)
assert.deepEqual(Array.from(conectados), ['atual'])
const visiveis = filtrarGruposDosCanaisConectados(grupos, conectados)
assert.deepEqual(Array.from(visiveis, g=>g.id), ['g1'])
assert.deepEqual(Array.from(filtrarConfiguracoesDeGruposVisiveis([{ grupo_id: 'g1' }, { grupo_id: 'g2' }], new Set(['g1'])), c=>c.grupo_id), ['g1'])
assert.equal(filtrarGruposDosCanaisConectados(grupos, idsCanaisWhatsAppConectados([])).length, 0)
const route = fs.readFileSync('app/api/integracoes/whatsapp/configuracao/route.ts','utf8')
assert.match(route, /\.in\('grupo_id', idsParaAtualizar\)/)
assert.match(route, /grupos: gruposVisiveis/)
console.log('OK: grupos de números desconectados ocultos; automações existentes preservadas por escopo de salvamento')
