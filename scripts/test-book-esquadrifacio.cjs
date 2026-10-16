const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const Module=require('node:module')
function carregarTS(path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m=new Module(path,module);m.filename=path;m.paths=Module._nodeModulePaths(process.cwd());m._compile(js,path);return m.exports}
const catalogo=carregarTS('lib/relatoriosEsquadrifacio.ts')
const book=carregarTS('lib/bookEsquadrifacio.ts')
assert.equal(catalogo.relatoriosEsquadrifacio.length,31)
assert.deepEqual(catalogo.relatoriosEsquadrifacio.map(x=>x.pagina),Array.from({length:31},(_,i)=>i+2))
assert.ok(book.validarPeriodoBook('2026-10-01','2026-10-31'))
assert.ok(!book.validarPeriodoBook('2026-10-31','2026-10-01'))
assert.ok(!book.validarPeriodoBook('2026-01-01','2027-12-31'))
const dataset={
 resumo:{totalContratos:10000,totalBalcao:2200,totalComercial:12200,comprasNf:800,comprasCmv:900},
 mensal:[{mes:'2026-10',contratos:10000,balcao:2200,meta:12000,obras:1}],
 representantes:[{nome:'A',quantidade:1,valor:2200}],
 clientes:[{nome:'Carlos',quantidade:1,valor:10000}],
 clientesMargem:[{nome:'Carlos',contratos:1,valorContratos:10000,custoPrevisto:null,margemPrevista:null}],
 cidades:[{nome:'José Bonifácio',quantidade:1,valor:10000}],
 produtos:[{nome:'Perfil SU007',imagem:null,quantidade:2,total:2200,custoConhecido:null,margemPrevista:null}],
 fornecedores:[{nome:'SUPRA',quantidade:1,valor:800}],
 fornecedoresCmv:[{nome:'SUPRA',quantidade:1,valor:900}],
 notas:[]}
const fin={dre:{receitaObras:10000,receitaBalcao:2200,receitaTotal:12200,cmvPrevisto:5000,margemBrutaProjetada:null,margemPct:null,obras:1,balcao:1,semPrevisao:1},caixa:{meses:[{mes:'2026-10',recebido:400,pago:300}]},classificacao:{gastosPorGrupo:{},pagamentosSemClassificacao:1}}
let disponiveis=0,pendentes=0
for(const report of catalogo.relatoriosEsquadrifacio){
 const r=book.montarVisaoLivro(report,dataset,fin)
 assert.ok(['disponivel','pendente','indisponivel'].includes(r.estado),report.id)
 if(r.estado==='disponivel'){disponiveis++;assert.ok(r.tabela&&r.tabela.colunas.length>=2,report.id)}
 if(r.estado==='pendente'){pendentes++;assert.equal(r.tabela,null)}
 assert.doesNotMatch(r.aviso,/GR&F|GRF/)
}
assert.ok(disponiveis>=15)
assert.ok(pendentes>=6)
const perfil=book.montarVisaoLivro(catalogo.obterRelatorio('analise-por-produto'),dataset,fin)
assert.equal(perfil.tabela.imagens,true)
assert.equal(perfil.tabela.linhas[0][1],null)
const fornec=book.montarVisaoLivro(catalogo.obterRelatorio('compra-por-fornecedor'),dataset,fin)
assert.equal(fornec.tabela.linhas.length,2,'NF e CMV separados para não somar duas vezes')
const dre=book.montarVisaoLivro(catalogo.obterRelatorio('dre-sintetica'),dataset,fin)
assert.ok(dre.tabela.linhas.some(l=>String(l[0]).includes('Lucro líquido')&&l[1]===null),'Não inventa lucro líquido')
const semFin=book.montarVisaoLivro(catalogo.obterRelatorio('dre-sintetica'),dataset,null)
assert.equal(semFin.estado,'indisponivel')
assert.equal(semFin.tabela,null)
const page=fs.readFileSync('app/relatorios/esquadrifacio/book/page.tsx','utf8')
const entrada=fs.readFileSync('app/relatorios/esquadrifacio/page.tsx','utf8')
assert.match(entrada,/Gerar Book do Período/)
assert.match(page,/window\.print\(\)/)
assert.match(page,/@page \{ size:A4 portrait/)
assert.match(page,/break-before:page/)
assert.match(page,/Salvar PDF/)
assert.match(page,/BookPeriodoEsquadrifacio/)
assert.match(page,/relatoriosEsquadrifacio\.map/)
assert.match(page,/Foto pendente/)
assert.equal((page.match(/src="\/branding\/esquadrifacio-logo-r-transparente-escuro.webp"/g)||[]).length,1,'Logo transparente claro no fundo escuro da capa')
assert.equal((page.match(/src="\/branding\/esquadrifacio-logo-r-transparente-claro.webp"/g)||[]).length,3,'Logo transparente escuro nas páginas claras')
assert.doesNotMatch(page,/inline-block max-w-full rounded-xl bg-white p-4 shadow-sm/,'A caixa branca não deve voltar')
assert.equal((page.match(/alt="Logotipo Esquadrifácio®"/g)||[]).length,4,'Toda marca visual exige ®')

assert.doesNotMatch(page,/GR&F|GRF/)
console.log('PASS: book A4, 31 relatórios, período, fontes pendentes, imagens, CMV e DRE sem dados inventados.')
