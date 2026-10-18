import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require=createRequire(import.meta.url)
const ts=require('typescript')
function loadTs(path){
 const module={exports:{}}
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,require,Date,Promise,crypto:require('node:crypto').webcrypto})
 return module.exports
}
const { datasDoMes, estadoInicialMarketing, prepararCalendarioLocal, MAX_ARQUIVO } = loadTs('lib/marketing/rascunhosLocais.ts')
const { validarEditorial, ehUUID, revisaoValida, dataEditorialValida } = loadTs('lib/marketing/editorialRegras.ts')

assert.equal(datasDoMes('2026-11').length, 30)
assert.equal(datasDoMes('2028-02').length, 29)
assert.equal(datasDoMes('2026-02').length, 28)
assert.equal(datasDoMes('invalid').length, 0)
assert.equal(MAX_ARQUIVO, 30 * 1024 * 1024)
const inicial = estadoInicialMarketing()
assert.equal(inicial.campanhaPausada, true)
assert.equal(inicial.posts.length, 0)
const proibida = { id: 'm1', nome: 'sem-permissao.jpg', tipo: 'image/jpeg', tamanho: 1, criadoEm: '2026-10-17', obra: 'Obra 1', autorizado: false }
assert.equal(prepararCalendarioLocal('2026-11', [proibida], []).length, 0, 'mídia não autorizada nunca gera post')
const liberada = { ...proibida, autorizado: true }
const gerados = prepararCalendarioLocal('2026-11', [liberada], [])
assert.equal(gerados.length, 30)
assert.ok(gerados.every(p => p.status === 'rascunho'))
assert.ok(gerados.every(p => p.midiaId === liberada.id))
assert.equal(prepararCalendarioLocal('2026-11', [liberada], gerados).length, 30, 'geração do mês precisa ser idempotente')
const aprovado = { ...gerados[0], status: 'aprovado' }
const repetidos = prepararCalendarioLocal('2026-11', [liberada], [aprovado, ...gerados.slice(1)])
assert.equal(repetidos.filter(p => p.status === 'aprovado').length, 1, 'regerar mês deve preservar aprovação')
console.log('Marketing Inteligente: 9 verificações de calendário, autorização e segurança aprovadas.')

const bom = { titulo: 'Porta de correr Suprema', legenda: 'Esquadrias sob medida.', canal: 'instagram', data_planejada: '2026-11-12' }
assert.deepEqual(JSON.parse(JSON.stringify(validarEditorial(bom))), bom)
assert.equal(validarEditorial({...bom, canal:'whatsapp'}), null, 'canal fora da lista')
assert.equal(validarEditorial({...bom, titulo:' '}), null, 'titulo vazio')
assert.equal(validarEditorial({...bom, legenda:'a'.repeat(4001)}), null, 'legenda grande')
assert.equal(validarEditorial({...bom, data_planejada:'2026-02-30'}), null, 'data impossivel')
assert.equal(dataEditorialValida('2028-02-29'),true)
assert.equal(dataEditorialValida('2026-02-29'),false)
assert.equal(revisaoValida(1),true)
assert.equal(revisaoValida(-1),false)
assert.equal(revisaoValida(1.5),false)
assert.equal(ehUUID('b01eaa8f-96b3-4ac8-ab04-baa09a6152ee'),true)
assert.equal(ehUUID('../../outro-cliente'),false)
