const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm')
function load(path,imports={}){
 const exports={}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n in imports?imports[n]:require(n),URL,console})
 return exports
}
const regras=load('lib/contramarcoRegrasCorte.ts')
const m=load('lib/contramarcoComercial.ts',{'./contramarcoRegrasCorte':regras})
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const catalogo=[
 {id:id(1),codigo:'CM060',nome:'Perfil CM060',categoria:'perfil',foto_url:'https://example.invalid/cm060.png'},
 {id:id(2),codigo:'C90',nome:'Conexão',categoria:'acessorio',foto_url:'https://example.invalid/c90.png'},
 {id:id(3),codigo:'G',nome:'Grapa',categoria:'acessorio',foto_url:'https://example.invalid/g.png'},
 {id:id(4),codigo:'CM200',nome:'Perfil CM200',categoria:'perfil',foto_url:'https://example.invalid/cm200.png'},
]
const base={ref:id(10),ambiente:'Sala',tipologia:'Janela de correr',largura_mm:1500,altura_mm:2000,folga_l_mm:20,folga_a_mm:30,
 quantidade:2,confirmada:true,perfil_codigo:'CM060',perfil_id:id(1),conexao_id:id(2),grapa_id:id(3),preco_unit_centavos:25000}
const [i]=m.validarItensCM([base],catalogo)
assert.equal(i.fabricacao_l_mm,1480);assert.equal(i.fabricacao_a_mm,1970);assert.equal(i.confirmada,false)
assert.equal(i.metros_perfil,13.4);assert.equal(i.conexoes,8);assert.equal(i.grapas,28);assert.equal(i.total_centavos,50000)
assert.equal(m.totalCM([i]),50000);assert.equal(m.propostaProntaCM([i]),true);assert.equal(i.materiais.perfil.foto_url,catalogo[0].foto_url)
assert.equal(m.validarItensCM([base],catalogo,[base])[0].confirmada,true)
assert.throws(()=>m.validarItensCM([{...base,largura_mm:2000}],catalogo,[base]),/origem mudou/)
assert.throws(()=>m.validarItensCM([{...base,perfil_codigo:'CM200',perfil_id:id(4)}],catalogo,[base]),/perfil da medição/)
assert.throws(()=>m.validarItensCM([{...base,perfil_id:id(4)}],catalogo),/código/)
assert.throws(()=>m.validarItensCM([{...base,conexao_id:id(1)}],catalogo),/categoria/)
assert.throws(()=>m.validarItensCM([base],catalogo.map(p=>({...p,foto_url:''}))),/foto/)
assert.throws(()=>m.validarItensCM([base,base],catalogo),/duplicada/)
assert.throws(()=>m.validarItensCM([{...base,folga_l_mm:1600}],catalogo),/medidas/)
assert.equal(m.propostaProntaCM(m.validarItensCM([{...base,perfil_id:'',preco_unit_centavos:null}],catalogo)),false)
assert.equal(m.propostaProntaCM(m.validarItensCM([{...base,tipologia:'Especial'}],catalogo)),false)
assert.equal(m.centavosCM('123,45'),12345);assert.equal(m.centavosCM('0,1'),10);assert.equal(m.centavosCM('1.999'),null)
assert.equal(m.posicaoDeOrigemCM({tipo_esquadria:'porta_abrir',largura_mm:1000,altura_mm:2000}).perfil_codigo,'CM200')
assert.throws(()=>m.posicaoDeOrigemCM({tipo_esquadria:'porta_abrir',campos_extras:{contramarco_perfil_codigo:'ESPECIAL'}},true),/especial/)
const api=fs.readFileSync('app/api/clientes/[id]/contramarcos/route.ts','utf8')
assert.match(api,/eq\('versao',atual\.versao\)\.eq\('status',atual\.status\)/)
assert.match(api,/b\.confirmacao!==true/)
assert.doesNotMatch(api,/\.from\('(?:orcamentos|vendas_obras|financeiro_contas_receber|medicoes_finais)'\)\.(?:insert|update|delete)/)
const ui=fs.readFileSync('components/medicao-final/ContramarcoComercialPage.tsx','utf8')
assert.match(ui,/img src=\{p\.foto_url\}/);assert.match(ui,/grid gap-3 sm:grid-cols-2/)
console.log('PASS: preços em centavos, medidas importadas imutáveis, corte original, fotos obrigatórias, receita especial bloqueada, duplicidade e confirmação isolada.')
