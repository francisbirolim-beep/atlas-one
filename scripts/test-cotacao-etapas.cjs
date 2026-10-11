const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const file=path.resolve(__dirname,'../lib/cotacaoEtapas.ts')
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}};new Function('module','exports',js)(m,m.exports)
const {etapaItemCotacao,itensEmEtapa,progressoLotesCotacao}=m.exports
const lote={status:'recebido',itens:Array.from({length:40},(_,i)=>({material_id:String(i),quantidade_cotar:1}))}
assert.equal(itensEmEtapa(lote,'recebido').length,40)
assert.equal(progressoLotesCotacao([lote]).percentualComprado,100)
assert.equal(progressoLotesCotacao([lote]).percentualRecebido,100)
// Retrocesso de cinco perfis, mantendo trinta e cinco onde estavam.
lote.itens=lote.itens.map((item,i)=>({...item,status_etapa:i<5?'cotacao':'recebido'}))
lote.status='cotacao'
assert.equal(itensEmEtapa(lote,'cotacao').length,5)
assert.equal(itensEmEtapa(lote,'recebido').length,35)
let p=progressoLotesCotacao([lote])
assert.deepEqual([p.comprados,p.recebidos,p.total],[35,35,40])
assert.equal(p.percentualRecebido,87.5)
lote.itens=lote.itens.map((item,i)=>i<3?{...item,status_etapa:'comprado'}:item)
p=progressoLotesCotacao([lote])
assert.deepEqual([p.comprados,p.recebidos,p.total],[38,35,40])
assert.equal(itensEmEtapa(lote,'cotacao').length,2)
assert.equal(itensEmEtapa(lote,'comprado').length,3)
assert.equal(etapaItemCotacao({status:'cotacao',itens:[]},{material_id:'x'}),'cotacao')
console.log('PASS: 40 recebidos, retrocesso parcial, três comprados, dois em cotação e 35 recebidos.')
