const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=function(mod,file){
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 mod._compile(js,file)
}
const {recebimentoConferivelCmv:aceitar}=require('../lib/vendaCmvConferencia.ts')
const p={categoria:'perfil',unidade:'KG',quantidade:110,preco_unitario:8.32}
const g={categoria:'vidro',unidade:'UN',quantidade:10,preco_unitario:100}
const a={categoria:'acessorio',unidade:'PCT',quantidade:3,preco_unitario:80}
for(const x of [p,g,a]) assert.equal(aceitar(x),true,JSON.stringify(x))
assert.equal(aceitar({categoria:'perfil',peso_kg:70.2,preco_kg:15.1}),true,'perfil legado pode ser conferido em kg')
assert.equal(aceitar({categoria:'vidro',peso_kg:40.2,preco_kg:16.8}),false,'vidro legado em kg não pode ser confirmado como peça')
assert.equal(aceitar({categoria:'acessorio',peso_kg:40.2,preco_kg:16.8}),false,'acessório legado em kg não pode ser confirmado como peça')
assert.equal(aceitar({...g,quantidade:1.5}),false,'unidade fracionada inválida')
assert.equal(aceitar({...p,quantidade:1.5}),true,'quilograma fracionado válido')
assert.equal(aceitar({...g,preco_unitario:0}),false,'recebimento sem preço inválido')
assert.equal(aceitar({...g,unidade:'KG',quantidade:2.22}),true,'unidade explícita kg pode ser conferida sem conversão')
assert.equal(aceitar({...g,cancelado_em:'2026-10-19'}),false,'cancelado fora de validação')
const ui=fs.readFileSync('components/clientes/VendaCmvRecebimentos.tsx','utf8')
const api=fs.readFileSync('app/api/vendas/cmv/recebimentos/route.ts','utf8')
assert(ui.includes('pendentesConferencia=registrosCategoria.filter(r=>!r.conferido_em&&recebimentoConferivelCmv(r))'))
assert(api.includes('if((linhas||[]).some(l=>!recebimentoConferivelCmv(l)))'))
assert(api.includes("fn_venda_cmv_validar_recebimentos_v2"))
console.log('PASS: perfil KG, vidro UN, acessório PCT, dados legados, fracionamento, auditoria e validação protegida.')
