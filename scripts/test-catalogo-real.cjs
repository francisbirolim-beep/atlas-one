// Teste offline com o PDF real: nao altera produtos nem valida imagens.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const pdf = require('pdf-parse')
const ts = require('typescript')
const vm = require('node:vm')
function moduloTs(arquivo, dependencias = {}) {
 const mod = {exports:{}}
 const js = ts.transpileModule(fs.readFileSync(arquivo,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require:nome=>dependencias[nome]||require(nome)},{filename:arquivo})
 return mod.exports
}
const geometria = moduloTs('lib/ai/catalogoTabelaGeometria.ts')
const leitor = moduloTs('lib/ai/catalogoPdfTexto.ts')
const {pesoDecimalCatalogo} = moduloTs('lib/ai/catalogoPeso.ts')
for (const [entrada, esperado] of [['0.375',0.375],['0,375',0.375],['1.270',1.27],['1,270',1.27],['1.234,567',1234.567],['1,234.567',1234.567]]) {
 assert.equal(pesoDecimalCatalogo(entrada), esperado, 'Peso decimal: '+entrada)
}
assert.equal(pesoDecimalCatalogo('sem peso'), null)
const {podeAtualizarCandidatoCatalogo,dadosReanaliseCatalogo} = moduloTs('lib/ai/catalogoReanalise.ts')
for (const status of ['corrigido','aprovado','aplicado','rejeitado']) {
 assert.equal(podeAtualizarCandidatoCatalogo({status}),false,'Decisao humana alterada: '+status)
}
assert.equal(podeAtualizarCandidatoCatalogo({status:'pendente',dados:{revisado_manualmente:true}}),false)
assert.equal(podeAtualizarCandidatoCatalogo({status:'pendente',validado_em:'2026-10-17'}),false)
assert.equal(podeAtualizarCandidatoCatalogo({status:'pendente',dados:{arquivado_em:'2026-10-17'}}),false)
assert.equal(podeAtualizarCandidatoCatalogo({status:'pendente',dados:{}}),true)
const foto = dadosReanaliseCatalogo({imagem_confirmada:true,imagem_item_url:'foto-homologada',imagem_codigo_validado:'P064',peso_kg_m:0.375},{imagem_item_url:'imagem-automatica',peso_kg_m:0.375,linha:'Linha 30'})
assert.equal(foto.imagem_item_url,'foto-homologada')
assert.equal(foto.linha,'Linha 30')
assert.equal(foto.imagem_codigo_validado,'P064')
const {extrairLinhasCatalogo} = moduloTs('lib/ai/catalogoLinhas.ts',{'./catalogoTabelaGeometria':geometria})
const arquivo = process.env.CATALOGO_FELD_PDF || path.join(process.env.HOME||'','Downloads','Catalogo Feld.pdf')
assert.ok(fs.existsSync(arquivo),'PDF Feld original indisponivel. Informe CATALOGO_FELD_PDF.')
async function testar(){
 const paginas=[]
 await pdf(fs.readFileSync(arquivo),{pagerender:async pagina=>{
  const conteudo=await pagina.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false})
  const texto=leitor.textoCatalogoGeometrico(conteudo.items)
  paginas.push({pagina:paginas.length+1,texto,items:conteudo.items})
  return texto
 }})
 const produtos=extrairLinhasCatalogo(paginas)
 assert.ok(paginas.length>=100,'Faltam paginas do catalogo')
 assert.ok(produtos.length>=450,'Leitura parcial das tabelas')
 assert.equal(new Set(produtos.map(p=>p.codigo)).size,produtos.length,'Codigos duplicados')
 for (const [codigo, paginas] of [['P227','10,104'],['P256','11,104'],['PR003','56,110']]) {
  assert.equal(produtos.find(p=>p.codigo===codigo)?.paginas_referencia.join(','),paginas,'Referencias repetidas perdidas: '+codigo)
 }
 for(const p of produtos){
  assert.equal(p.categoria,'perfil','Categoria: '+p.codigo)
  assert.equal(p.unidade,'KG','Unidade: '+p.codigo)
  assert.ok(Number.isFinite(p.peso_kg_m)&&p.peso_kg_m>0&&p.peso_kg_m<50,'Peso: '+p.codigo)
  assert.ok(Number.isInteger(p.pagina_catalogo)&&p.pagina_catalogo>0,'Pagina: '+p.codigo)
 }
 function checar(codigo,peso,pagina,campo,medida){
  const p=produtos.find(x=>x.codigo===codigo)
  assert.ok(p,'Sem produto: '+codigo)
  assert.equal(p.peso_kg_m,peso,'Peso decimal incorreto: '+codigo)
  assert.equal(p.pagina_catalogo,pagina,'Pagina: '+codigo)
  if(campo)assert.equal(p.medidas_mm[campo],medida,'Medida: '+codigo)
 }
 checar('L-1002',0.076,4,'A',12.7)
 checar('CT-128',0.436,4,'e',2)
 checar('BAR-013',0.135,4,'B',3.18)
 checar('TUB-4002',0.161,5,'A',15.88)
 checar('P064',0.375,14)
 assert.equal(produtos.find(p=>p.codigo==='P064').linha,'Linha 30')
 assert.ok(produtos.some(p=>p.medidas_polegadas.A),'Sem polegadas')
 console.log('PASS: '+paginas.length+' paginas, '+produtos.length+' produtos separados; peso decimal, mm, polegadas e Linha 30 conferidos.')
 console.log('OBS: a imagem de cada item ainda precisa de verificacao visual e aprovacao.')
}
testar().catch(e=>{console.error(e);process.exitCode=1})
