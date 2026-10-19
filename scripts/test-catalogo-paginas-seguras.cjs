const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),pdf=require('pdf-parse')
function carregar(arquivo,imports={}){
  const m={exports:{}}
  const s=ts.transpileModule(fs.readFileSync(arquivo,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
  }).outputText
  vm.runInNewContext(s,{module:m,exports:m.exports,require:n=>imports[n]||require(n)})
  return m.exports
}
const geom=carregar('lib/ai/catalogoCartoesGeometria.ts')
const {indexarPaginasSeguras}=carregar('lib/ai/catalogoPaginasSeguras.ts',
  {'./catalogoCartoesGeometria':geom})
const teste=indexarPaginasSeguras([
  {pagina:75,items:[{str:'F42-014'},{str:'F42-012'},{str:'F42-012F42-014'}]},
  {pagina:91,items:[{str:'T-001'},{str:'SU-007'}]},
  {pagina:92,items:[{str:'T-001'}]},
],[
  {codigo:'F42-014',pagina_catalogo:75},
  {codigo:'F42-012',pagina_catalogo:75},
  {codigo:'L-612',pagina_catalogo:4}
])
assert.equal(teste.unicas.get('F42014'),75)
assert.equal(teste.unicas.get('F42012'),75)
assert.equal(teste.unicas.get('L612'),4)
assert.equal(teste.unicas.get('SU007'),91)
assert.equal(teste.ambiguas.has('T001'),true)
assert.equal(teste.unicas.has('T001'),false)
assert.equal(teste.unicas.has('F42012F42014'),false,'Nunca mapear código concatenado')
const route=fs.readFileSync('app/api/ia/central-aprendizado/route.ts','utf8')
const a=route.indexOf('async function remapearCatalogoExistente(')
const b=route.indexOf('async function analisar(',a)
const section=route.slice(a,b)
assert.ok(a>=0&&b>a)
assert.match(section,/indexarPaginasSeguras\(lido\.paginas,extraidos\)/)
assert.match(section,/indice\.ambiguas\.has\(codigo\)/)
assert.match(section,/const paginaAnterior=Number\(c\.dados\?\.pagina_catalogo\|\|0\)/)
assert.match(section,/if\(paginaAnterior>0\)/)
assert.match(section,/\.eq\('status','pendente'\)/)
assert.match(section,/\.eq\('updated_at',c\.updated_at\)/)
const ui=fs.readFileSync('app/atlas-ia/aprendizado/page.tsx','utf8')
assert.match(ui,/Com página identificada/)
assert.match(ui,/Sem página identificada/)
assert.match(ui,/A página indicada não substitui a conferência do desenho técnico/)
assert.match(ui,/CatalogoDetalhes key=\{e\.id\}/)
console.log('PASS: código colado recusado, duplicidade de páginas bloqueada, imagem e cadastros anteriores preservados.')
async function real(){
 let pagina=0,pgs=[]
 const texto=carregar('lib/ai/catalogoPdfTexto.ts')
 await pdf(fs.readFileSync(process.env.HOME+'/Downloads/Catalogo Digital 2026.pdf'),{
   pagerender:async p=>{
     pagina++
     const c=await p.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
     pgs.push({pagina,items:c.items,texto:texto.textoCatalogoGeometrico(c.items)})
     return ' '
   }
 })
 const cartoes=geom.extrairCartoesGeometricos(pgs)
 const idx=indexarPaginasSeguras(pgs,cartoes)
 for(const c of ['F42-014','F42-012','FLG-162','FLG-164']){
   const code=c.replace(/[^A-Z0-9]/g,'')
   assert.equal(idx.unicas.get(code),c.startsWith('F42')?75:62,'Código individual '+c)
 }
 console.log('PASS: PDF Digital 2026 verificado; códigos corretos mantêm páginas únicas, total:',idx.totalCodigos)
}
real().catch(e=>{console.error(e);process.exitCode=1})
