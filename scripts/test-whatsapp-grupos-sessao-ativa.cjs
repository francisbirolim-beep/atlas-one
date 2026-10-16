const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const src = fs.readFileSync('lib/whatsappGruposSessaoAtiva.ts','utf8')
const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const exports = {}
vm.runInNewContext(js,{exports})
const {idsCanaisWhatsAppConectados,filtrarGruposDosCanaisConectados,filtrarConfiguracoesDeGruposVisiveis} = exports
const canais = [
  {id:'atual',gateway_status:'connected'},
  {id:'antigo',gateway_status:'disconnected'},
  {id:'pausado',gateway_status:'paused'},
]
const grupos = [
  {id:'g1',whatsapp_canal_id:'atual'},
  {id:'g2',whatsapp_canal_id:'antigo'},
  {id:'g3',whatsapp_canal_id:'pausado'},
]
const ativos = idsCanaisWhatsAppConectados(canais)
assert.deepEqual([...ativos], ['atual'])
const visiveis = filtrarGruposDosCanaisConectados(grupos, ativos)
assert.deepEqual(visiveis.map(g=>g.id),['g1'])
assert.deepEqual(filtrarConfiguracoesDeGruposVisiveis([{grupo_id:'g1'},{grupo_id:'g2'}],new Set(['g1'])).map(g=>g.grupo_id),['g1'])
assert.equal(filtrarGruposDosCanaisConectados(grupos,idsCanaisWhatsAppConectados([])).length,0)
const route = fs.readFileSync('app/api/integracoes/whatsapp/configuracao/route.ts','utf8')
assert.match(route,/grupos: gruposVisiveis/)
assert.match(route,/\.in\('grupo_id', idsParaAtualizar\)/)
assert.doesNotMatch(route,/\.eq\('tipo', 'orcamento'\)\s*if \(limparAutomacoesError\)/)
console.log('PASS: conectado visivel, desconectado oculto, regras preservadas e exclusao restrita')
