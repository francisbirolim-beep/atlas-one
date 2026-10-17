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
const {localizarCodigoCatalogo} = moduloTs('lib/ai/catalogoImagemCodigo.ts')
const {pesoDecimalCatalogo} = moduloTs('lib/ai/catalogoPeso.ts')
const {conferirDadosCatalogo} = moduloTs('lib/ai/catalogoConferencia.ts')
const antigos={status:'pendente',dados:{codigo:'TQ-036',descricao:'Peso',peso_kg_m:null,medidas_mm:{},medidas_polegadas:{},categoria:'outro'}}
const daFonte={codigo:'TQ-036',descricao:'Tubo Quadrado',peso_kg_m:1.28,medidas_mm:{A:76.2,B:1.58},medidas_polegadas:{A:'3”'},categoria:'perfil',unidade:'KG'}
const revisao=conferirDadosCatalogo(antigos,daFonte)
assert.equal(revisao.dados.descricao,'Tubo Quadrado')
assert.equal(revisao.dados.peso_kg_m,1.28)
assert.deepEqual(JSON.parse(JSON.stringify(revisao.dados.medidas_mm)),{A:76.2,B:1.58})
assert.equal(antigos.dados.descricao,'Peso','Consulta jamais deve alterar cadastro anterior')
const imagemConfirmada=conferirDadosCatalogo({...antigos,dados:{...antigos.dados,imagem_confirmada:true,imagem_item_url:'imagem-original',imagem_codigo_validado:'TQ-036'}},daFonte)
assert.equal(imagemConfirmada.dados.peso_kg_m,1.28)
assert.equal(imagemConfirmada.dados.imagem_item_url,'imagem-original','Desenho confirmado preservado')
assert.equal(imagemConfirmada.dados.imagem_codigo_validado,'TQ-036')
assert.equal(conferirDadosCatalogo({...antigos,status:'aprovado'},daFonte),null)
assert.equal(conferirDadosCatalogo({...antigos,dados:{...antigos.dados,revisado_manualmente:true}},daFonte),null)
assert.equal(conferirDadosCatalogo(antigos,{...daFonte,codigo:'TQ-037'}),null)
const conflitante=conferirDadosCatalogo({...antigos,dados:{...antigos.dados,peso_kg_m:9}},daFonte)
assert.equal(conflitante.dados.peso_kg_m,9,'Peso divergente nunca pode ser substituido silenciosamente')
assert.ok(conflitante.divergencias.includes('peso_kg_m'))

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
 const fotos=produtos.map(p=>({produto:p.codigo,pagina:p.pagina_catalogo, resultado:localizarCodigoCatalogo(paginas[p.pagina_catalogo-1].items.filter(i=>i?.str&&i?.transform).map(i=>({str:i.str,x:Number(i.transform[4]),y:Number(i.transform[5]),w:Number(i.width||0)})),p.codigo)}))
 const unicos=fotos.filter(f=>f.resultado.ocorrencias===1)
 const ambig=fotos.filter(f=>f.resultado.ocorrencias>1)
 const semFoto=fotos.filter(f=>f.resultado.ocorrencias===0)
 console.log('RECONHECIMENTO FOTO',JSON.stringify({unicos:unicos.length,ambiguos:ambig.length,nao_localizados:semFoto.length,exemplos_sem_foto:semFoto.slice(0,30).map(p=>p.produto),exemplos_ambiguos:ambig.slice(0,30).map(p=>p.produto)}))
 assert.equal(unicos.length,475,'Quantidade de desenhos identificados por código exato mudou')
 assert.equal(semFoto.length,0,'Alguns códigos não foram localizados no PDF original')
 assert.equal(ambig.length,5,'Casos de código repetido/ambíguo devem exigir revisão manual')
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
 checar('TQ-036',1.28,5,'A',76.2)
 assert.equal(produtos.find(p=>p.codigo==='TQ-036')?.descricao,'Tubo Quadrado')
 assert.equal(produtos.find(p=>p.codigo==='TQ-036')?.medidas_mm.B,1.58)
 assert.equal(produtos.find(p=>p.codigo==='TQ-036')?.medidas_polegadas.A,'3”')
 assert.equal(produtos.find(p=>p.codigo==='TQ-036')?.evidencia_tabela?.startsWith('TQ-036'),true)

 checar('P064',0.375,14)
 assert.equal(produtos.find(p=>p.codigo==='P064').linha,'Linha 30')
 assert.ok(produtos.some(p=>p.medidas_polegadas.A),'Sem polegadas')
 console.log('PASS: '+paginas.length+' paginas, '+produtos.length+' produtos separados; peso decimal, mm, polegadas e Linha 30 conferidos.')
 console.log('OBS: a imagem de cada item ainda precisa de verificacao visual e aprovacao.')
}
testar().catch(e=>{console.error(e);process.exitCode=1})
