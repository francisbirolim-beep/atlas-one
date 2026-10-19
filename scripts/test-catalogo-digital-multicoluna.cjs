// Diagnóstico offline do Catalogo Digital 2026: nada é gravado no banco Atlas.
const assert=require('node:assert/strict')
const fs=require('node:fs'),ts=require('typescript'),vm=require('vm'),pdf=require('pdf-parse')
const caminho=process.env.CATALOGO_DIGITAL_PDF||process.env.HOME+'/Downloads/Catalogo Digital 2026.pdf'
function load(path){
 const m={exports:{}}
 const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 vm.runInNewContext(js,{module:m,exports:m.exports})
 return m.exports
}
const {textoCatalogoGeometrico}=load('lib/ai/catalogoPdfTexto.ts')
const {extrairCartoesGeometricos,codigoColadoDeOutrasColunas}=load('lib/ai/catalogoCartoesGeometria.ts')
const {localizarCodigoCatalogo}=load('lib/ai/catalogoImagemCodigo.ts')
assert.equal(codigoColadoDeOutrasColunas('F42-012F42-014'),true)
assert.equal(codigoColadoDeOutrasColunas('FLG-162FLG-164'),true)
assert.equal(codigoColadoDeOutrasColunas('L-014'),false)
async function main(){
 const paginas=[]
 const r=await pdf(fs.readFileSync(caminho),{pagerender:async p=>{
  const c=await p.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
  const texto=textoCatalogoGeometrico(c.items)
  paginas.push({pagina:paginas.length+1,texto,items:c.items})
  return texto
 }})
 const dados=extrairCartoesGeometricos(paginas)
 function existe(cod,pagina,peso,descricao){
  const item=dados.find(i=>i.codigo===cod)
  assert.ok(item,'Faltando código individual '+cod)
  assert.equal(item.pagina_catalogo,pagina,cod+' página')
  assert.equal(item.peso_kg_m,peso,cod+' peso')
  assert.match(item.descricao,new RegExp(descricao,'i'),cod+' descricao')
  assert.equal(item.origem_extracao,'cartao_pdf_geometrico')
  return item
 }
 existe('F42-007',75,1.206,'travessa')
 existe('F42-012',75,.853,'batente')
 existe('F42-014',75,.314,'remate')
 existe('FLG-162',62,1.108,'montante')
 existe('FLG-164',62,.160,'baguete')
 for(const [pagina,codigo] of [[75,'F42-012'],[75,'F42-014'],[62,'FLG-162'],[62,'FLG-164']]){
   const pg=paginas[pagina-1]
   const tokens=pg.items.filter(i=>i?.str&&i?.transform).map(i=>({str:i.str,x:Number(i.transform[4]),y:Number(i.transform[5]),w:Number(i.width||0),h:Number(i.height||10)}))
   const local=localizarCodigoCatalogo(tokens,codigo)
   assert.equal(local.ocorrencias,1,'Não localizou desenho individual '+codigo+' na página '+pagina)
 }
 assert.ok(!dados.some(i=>i.codigo.includes('F42-012F42')),'Não pode criar código colado')
 assert.ok(!dados.some(i=>i.codigo.includes('FLG-162FLG')),'Não pode criar código colado')
 console.log(JSON.stringify({paginas:r.numpages,cartoes_geometricos:dados.length,
  pagina_75:dados.filter(i=>i.pagina_catalogo===75).map(i=>[i.codigo,i.descricao,i.peso_kg_m]),
  pagina_62:dados.filter(i=>i.pagina_catalogo===62).map(i=>[i.codigo,i.descricao,i.peso_kg_m])},null,2))
 assert.ok(dados.length>=300,'Cartões com peso vertical legível: '+dados.length)
 console.log('PASS: PDF real com códigos, descrições, pesos e páginas separados; sem alteração de banco.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
