const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const Module=require('node:module')
const src='lib/relatoriosEsquadrifacio.ts'
const compiled=ts.transpileModule(fs.readFileSync(src,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m=new Module(src,module);m.filename=src;m.paths=Module._nodeModulePaths(process.cwd());m._compile(compiled,src)
const items=m.exports.relatoriosEsquadrifacio
assert.equal(items.length,31,'31 páginas analíticas do PDF (33 páginas incluindo capa e encerramento)')
assert.deepEqual(items.map(x=>x.pagina),Array.from({length:31},(_,i)=>i+2))
assert.equal(new Set(items.map(x=>x.id)).size,31)
assert.ok(items.some(x=>x.nome.includes('DRE')&&x.fonte==='dre'))
assert.ok(items.some(x=>x.nome.includes('Caixa')||x.nome.includes('caixa')))
assert.ok(items.some(x=>x.fonte==='abc-clientes'))
assert.ok(items.some(x=>x.fonte==='fornecedores'))
assert.ok(items.some(x=>x.fonte==='pendente'),'Fontes fiscais e orçamento não podem ser inventados')
for(const file of ['app/relatorios/page.tsx','app/consultoria/page.tsx','components/Sidebar.tsx','components/system/MobileNavigationControls.tsx','lib/guias.ts','app/relatorios/esquadrifacio/page.tsx','app/api/relatorios/esquadrifacio/route.ts']){
 const content=fs.readFileSync(file,'utf8')
 assert.doesNotMatch(content,/GR&F|GRF|GR F BRASIL/i,'Sem marca de terceiro nas telas: '+file)
}
for(const file of ['components/Sidebar.tsx','components/system/MobileNavigationControls.tsx','lib/guias.ts','app/relatorios/page.tsx']){
 assert.match(fs.readFileSync(file,'utf8'),/\/relatorios\/esquadrifacio/)
}
const api=fs.readFileSync('app/api/relatorios/esquadrifacio/route.ts','utf8')
assert.match(api,/autorizarRelatorio\(req,u,'esquadrifacio'\)/)
assert.match(api,/\.eq\('empresa_id',empresa\)/)
assert.doesNotMatch(api,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/)
assert.match(api,/fornecedoresCmv/)
assert.match(api,/comprasCmvOrigem/)
assert.match(api,/semCusto/)
assert.match(api,/custoPrevisto/)
const ui=fs.readFileSync('app/relatorios/esquadrifacio/page.tsx','utf8')
assert.match(ui,/Integração de dados necessária/)
assert.match(ui,/Imagem do produto/)
assert.match(ui,/relatoriosEsquadrifacio/)
assert.match(ui,/baixarCsv/)
assert.match(ui,/window\.print/)
console.log('PASS: 31 visões reais do índice, branding Esquadrifácio, Master/tenant, leitura, imagens e fontes pendentes explícitas.')
