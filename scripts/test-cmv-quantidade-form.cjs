const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const vm = require('node:vm')
const fonte = fs.readFileSync('components/clientes/VendaCmvPainel.tsx', 'utf8')
assert.match(fonte, /name="quantidade" type="number" min=\{unidadeNova==='KG'\?'0\.001':'1'\} step=\{unidadeNova==='KG'\?'any':'1'\} value=\{pesoCompra\}/)
const codigo = fs.readFileSync('lib/vendaCmvUnidades.ts','utf8')
const compilado=ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText
const sandbox = {exports:{},module:{exports:{}}}
sandbox.exports=sandbox.module.exports
vm.runInNewContext(compilado,sandbox)
const {quantidadeCmvValida,unidadePadraoCmv} = sandbox.module.exports
assert.equal(unidadePadraoCmv('vidro'),'UN')
const htmlValido=(valor,unidade)=>{
 const minimo=unidade==='KG'?0.001:1
 if(valor<minimo)return false
 return unidade==='KG'||Number.isInteger((valor-minimo)/1)
}
for(const u of ['UN','PC','PCT']) {
 assert.equal(htmlValido(10,u),true,`${u}: 10 deve passar no navegador`)
 assert.equal(htmlValido(1,u),true)
 assert.equal(htmlValido(10.5,u),false)
 assert.equal(htmlValido(0,u),false)
 assert.equal(quantidadeCmvValida(10,u),true)
 assert.equal(quantidadeCmvValida(10.5,u),false)
}
for(const n of [0.001,10,10.5,2.350]){
 assert.equal(htmlValido(n,'KG'),true)
 assert.equal(quantidadeCmvValida(n,'KG'),true)
}
assert.equal(htmlValido(0,'KG'),false)
assert.equal(quantidadeCmvValida(0,'KG'),false)
console.log('OK: UN/PC/PCT aceitam inteiros (incluindo 10), recusam frações; KG aceita decimais. Frontend e API coerentes.')
