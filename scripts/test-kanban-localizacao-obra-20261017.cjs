const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const transpile = path => ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod1={exports:{}}
new Function('module','exports',transpile('lib/enderecoObra.ts'))(mod1,mod1.exports)
const mod={exports:{}}
new Function('module','exports','require',transpile('lib/kanbanEnderecoObra.ts'))(mod,mod.exports,(path)=>{
  assert.equal(path,'./enderecoObra')
  return mod1.exports
})
const {enderecoObraNoKanban}=mod.exports
const legado=enderecoObraNoKanban({id:'x',nome:'Casa',endereco:'Rua Teste, 190 - CEP 15200-000',cidade:'José Bonifácio',observacoes:'Localização: -21.052812,-49.690112'})
assert.match(legado.texto,/Rua Teste, 190/)
assert.match(legado.texto,/CEP 15200-000/)
assert.equal(legado.localizacaoConfirmada,null)
assert.ok(legado.mapaConferencia.includes('search/'))
assert.ok(legado.rota.includes('Rua%20Teste'))
const confirmado=enderecoObraNoKanban({id:'y',nome:'Casa',endereco:'Rua B',numero_endereco:'14',bairro:'Centro',cidade:'José Bonifácio',cep:'15200000',observacoes:'Localização: -21.05,-49.69\nLocalização conferida: Sim'})
assert.equal(confirmado.localizacaoConfirmada,'-21.050000,-49.690000')
assert.equal(confirmado.mapaConferencia,null)
assert.ok(confirmado.rota.includes('destination=-21.050000%2C-49.690000'))
assert.match(confirmado.texto,/Rua B, 14 · Centro/)
const rejeitado=enderecoObraNoKanban({id:'z',nome:'Casa',cidade:'José Bonifácio',observacoes:'GPS rejeitado pelo usuário: -21.05,-49.69'})
assert.equal(rejeitado.rota,null)
assert.equal(rejeitado.mapaConferencia,null)
const componente=fs.readFileSync('components/system/KanbanPageFixed.tsx','utf8')
for (const token of ['carregarObrasDosCards(lista)', 'kanban-localizacao-obra', 'Abrir cadastro do cliente', 'Conferir ponto GPS no mapa', 'Abrir rota no mapa']) assert.ok(componente.includes(token),token)
const geo=fs.readFileSync('app/api/geocodificacao/reversa/route.ts','utf8')
assert.ok(geo.includes('address.city_district'))
const pagina=fs.readFileSync('app/orcamento-rapido/page.tsx','utf8')
for (const token of ['precisaoGps','numeroSugeridoGps','Usar número sugerido','enableHighAccuracy: true']) assert.ok(pagina.includes(token),token)
console.log('PASS: Kanban vincula obra/endereço, permite mapear GPS legado sem confirmar, preserva rejeição e sugere dados sem inventar número.')
