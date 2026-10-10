const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const src=fs.readFileSync('lib/producaoMedicaoCard.ts','utf8')
const modulo={exports:{}}
new Function('module','exports',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(modulo,modulo.exports)
const {vincularCardAMedicao,idMedicaoDoCard,temMarcadorMedicaoDoCard}=modulo.exports
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
const medicoes=[{id:b,orcamento_id:'orc-123'},{id:a,orcamento_id:'orc-123'}]
assert.equal(vincularCardAMedicao({orcamento_id:'orc-123',descricao:'Medição final [medicao:'+a+']'},medicoes)?.id,a,'Marcador prevalece sobre orçamento')
assert.equal(vincularCardAMedicao({orcamento_id:'orc-123',descricao:'Medição final [medicao:'+b+']'},medicoes)?.id,b,'Cada card aponta para sua medição')
assert.equal(vincularCardAMedicao({descricao:'[medicao:'+a+']'},medicoes)?.id,a,'Card sem orçamento com marcador')
assert.equal(vincularCardAMedicao({orcamento_id:'orc-123',descricao:'card legado'},medicoes)?.id,b,'Compatibilidade com card sem marcador')
assert.equal(vincularCardAMedicao({orcamento_id:'orc-123',descricao:'[medicao:33333333-3333-4333-8333-333333333333]'},medicoes),null,'Marcador órfão nunca cai na medição errada')
assert.equal(vincularCardAMedicao({orcamento_id:'orc-123',descricao:'[medicao:inválida]'},medicoes),null,'Marcador malformado bloqueia fallback')
assert.equal(vincularCardAMedicao({descricao:'card avulso'},medicoes),null)
assert.equal(idMedicaoDoCard({descricao:'[medicao:'+a.toUpperCase()+']'}),a)
assert.equal(temMarcadorMedicaoDoCard({descricao:'[medicao:inválida]'}),true)
assert.equal(temMarcadorMedicaoDoCard({descricao:'sem marcador'}),false)
console.log('PASS: múltiplos cards da mesma venda apontam para medição correta, inclusive marcador órfão.')
